plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val appVersion = (project.findProperty("hallflixVersion") as String?) ?: "1.0.0"
val parts = appVersion.split(".").map { it.toIntOrNull() ?: 0 } + listOf(0, 0, 0)

android {
    namespace = "net.hallflix.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "net.hallflix.tv"
        minSdk = 21
        targetSdk = 35
        versionCode = parts[0] * 10000 + parts[1] * 100 + parts[2]
        versionName = appVersion
    }

    // The launcher page is shared with the LG and Samsung apps.
    sourceSets["main"].assets.srcDirs("../../launcher")

    signingConfigs {
        create("release") {
            val ks = System.getenv("HALLFLIX_KEYSTORE")
            if (ks != null && file(ks).exists()) {
                storeFile = file(ks)
                storePassword = System.getenv("HALLFLIX_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("HALLFLIX_KEY_ALIAS") ?: "hallflix"
                keyPassword = System.getenv("HALLFLIX_KEY_PASSWORD") ?: System.getenv("HALLFLIX_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            val rel = signingConfigs.getByName("release")
            signingConfig = if (rel.storeFile != null) rel else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }
}

dependencies {
    val media3 = "1.5.1"
    implementation("androidx.media3:media3-exoplayer:$media3")
    implementation("androidx.media3:media3-exoplayer-hls:$media3")
    implementation("androidx.media3:media3-ui:$media3")
}
