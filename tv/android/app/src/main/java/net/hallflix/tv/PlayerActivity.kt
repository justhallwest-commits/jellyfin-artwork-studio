package net.hallflix.tv

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import org.json.JSONObject

/**
 * Plays one stream at a time for the HallFlix interface (pre-rolls first, then the title). The
 * interface sends {url, title, subtitle, startMs, subs:[{index,label,lang,url}], subIndex, intro}
 * and gets back progress / ended / stopped / error events.
 */
@OptIn(UnstableApi::class)
class PlayerActivity : Activity() {

    companion object {
        var current: PlayerActivity? = null

        fun load(from: Activity, json: String) {
            val p = current
            if (p != null && !p.isFinishing) p.loadJson(json)
            else from.startActivity(Intent(from, PlayerActivity::class.java).putExtra("json", json))
        }
    }

    private lateinit var player: ExoPlayer
    private lateinit var view: PlayerView
    private lateinit var skipHint: TextView
    private lateinit var title: TextView
    private val handler = Handler(Looper.getMainLooper())
    private var intro = false
    private var endedSent = false
    private var closedByWeb = false

    private val tick = object : Runnable {
        override fun run() {
            if (!intro) report("progress")
            handler.postDelayed(this, 10_000)
        }
    }
    private val hideTitle = Runnable { title.visibility = View.GONE }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        current = this
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_player)
        view = findViewById(R.id.player_view)
        skipHint = findViewById(R.id.skip_hint)
        title = findViewById(R.id.title)

        player = ExoPlayer.Builder(this)
            .setSeekBackIncrementMs(10_000)
            .setSeekForwardIncrementMs(30_000)
            .build()
        view.player = player
        view.controllerShowTimeoutMs = 4000
        view.setShowNextButton(false)
        view.setShowPreviousButton(false)
        view.keepScreenOn = true

        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_ENDED && !endedSent) {
                    endedSent = true
                    report("ended")
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (!intro) report("progress")
            }

            override fun onPlayerError(error: PlaybackException) {
                report("error", error.errorCodeName)
            }
        })

        intent.getStringExtra("json")?.let { loadJson(it) } ?: finish()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.getStringExtra("json")?.let { loadJson(it) }
    }

    fun loadJson(json: String) {
        val o = JSONObject(json)
        val url = o.getString("url")
        intro = o.optBoolean("intro", false)
        endedSent = false

        val subIndex = o.optInt("subIndex", -1)
        val subs = o.optJSONArray("subs")
        val subConfigs = mutableListOf<MediaItem.SubtitleConfiguration>()
        var chosenExternal = false
        if (subs != null) {
            for (i in 0 until subs.length()) {
                val s = subs.getJSONObject(i)
                val chosen = s.optInt("index", -2) == subIndex
                if (chosen) chosenExternal = true
                subConfigs.add(
                    MediaItem.SubtitleConfiguration.Builder(Uri.parse(s.getString("url")))
                        .setMimeType(MimeTypes.TEXT_VTT)
                        .setLanguage(s.optString("lang").ifEmpty { null })
                        .setLabel(s.optString("label"))
                        .setSelectionFlags(if (chosen) C.SELECTION_FLAG_DEFAULT else 0)
                        .build()
                )
            }
        }

        val item = MediaItem.Builder()
            .setUri(url)
            .setMediaMetadata(MediaMetadata.Builder().setTitle(o.optString("title")).setSubtitle(o.optString("subtitle")).build())
            .setSubtitleConfigurations(subConfigs)
        if (url.contains(".m3u8")) item.setMimeType(MimeTypes.APPLICATION_M3U8)

        player.trackSelectionParameters = player.trackSelectionParameters.buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, !chosenExternal)
            .build()
        player.setMediaItem(item.build(), o.optLong("startMs", 0))
        player.prepare()
        player.playWhenReady = true

        skipHint.visibility = if (intro) View.VISIBLE else View.GONE
        view.useController = !intro
        title.text = if (intro) o.optString("title") else listOf(o.optString("title"), o.optString("subtitle")).filter { it.isNotBlank() }.joinToString("  ·  ")
        title.visibility = View.VISIBLE
        handler.removeCallbacks(hideTitle)
        handler.postDelayed(hideTitle, 5000)
    }

    private fun report(name: String, error: String? = null) {
        val data = JSONObject()
            .put("positionMs", if (::player.isInitialized) player.currentPosition else 0)
            .put("paused", if (::player.isInitialized) !player.isPlaying else true)
        if (error != null) data.put("error", error)
        MainActivity.instance?.sendEvent(name, data)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val key = event.keyCode
        if (intro && event.action == KeyEvent.ACTION_DOWN &&
            (key == KeyEvent.KEYCODE_DPAD_RIGHT || key == KeyEvent.KEYCODE_MEDIA_FAST_FORWARD || key == KeyEvent.KEYCODE_MEDIA_NEXT || key == KeyEvent.KEYCODE_DPAD_CENTER || key == KeyEvent.KEYCODE_ENTER)
        ) {
            // skip this pre-roll: the interface moves on to the next one or the title
            if (!endedSent) {
                endedSent = true
                player.pause()
                report("ended")
            }
            return true
        }
        if (key == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_UP) {
                if (!intro && view.isControllerFullyVisible) view.hideController()
                else {
                    report("stopped")
                    closedByWeb = true
                    finish()
                }
            }
            return true
        }
        if (!intro && event.action == KeyEvent.ACTION_DOWN && !view.isControllerFullyVisible) {
            when (key) {
                KeyEvent.KEYCODE_DPAD_LEFT -> { player.seekBack(); view.showController(); return true }
                KeyEvent.KEYCODE_DPAD_RIGHT -> { player.seekForward(); view.showController(); return true }
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> { if (player.isPlaying) player.pause() else player.play(); return true }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    /** The interface closed the player (queue finished, or it chose to stop). */
    fun finishFromWeb() {
        closedByWeb = true
        finish()
    }

    override fun onStart() {
        super.onStart()
        handler.post(tick)
    }

    override fun onStop() {
        handler.removeCallbacks(tick)
        if (!isFinishing) player.pause()
        super.onStop()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        // closed some other way (Home button, system): let the interface know where we got to
        if (!closedByWeb) report("stopped")
        player.release()
        if (current === this) current = null
        super.onDestroy()
    }
}
