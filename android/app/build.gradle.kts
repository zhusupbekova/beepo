plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "studio.panikka.beepo"
    compileSdk = 37

    defaultConfig {
        applicationId = "studio.panikka.beepo"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    // Sprites and translations are shared with the extension, read straight from extension/data.
    sourceSets {
        getByName("main") {
            assets.directories.add("../../extension/data")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.material3)
    implementation(libs.kotlinx.serialization.json)

    testImplementation(libs.junit)
    // org.json is part of Android but stubbed in local unit tests.
    testImplementation(libs.json)
}
