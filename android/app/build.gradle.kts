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
        versionCode = 3
        versionName = "0.1.0"
    }

    // Upload key for Play (Play App Signing holds the real key). Path and password live in
    // ~/.gradle/gradle.properties as beepoUploadStore / beepoUploadPassword, never in the repo.
    val uploadStore = providers.gradleProperty("beepoUploadStore").orNull
    signingConfigs {
        if (uploadStore != null) create("upload") {
            storeFile = file(uploadStore)
            storePassword = providers.gradleProperty("beepoUploadPassword").get()
            keyAlias = "upload"
            keyPassword = storePassword
        }
    }

    // RevenueCat public SDK keys. Debug uses the Test Store (fake purchases, no Play needed); release
    // needs the Play key (goog_...) as `revenuecatKey` in ~/.gradle/gradle.properties, else Plus stays hidden.
    buildTypes {
        getByName("debug") {
            buildConfigField("String", "REVENUECAT_KEY", "\"test_EsNzBrBJtwFbvnBTGvwtBAcmLhd\"")
        }
        getByName("release") {
            signingConfig = signingConfigs.findByName("upload")
            // R8; the mapping file goes into the bundle and Play picks it up on upload.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            buildConfigField("String", "REVENUECAT_KEY", "\"${providers.gradleProperty("revenuecatKey").getOrElse("")}\"")
        }
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
    implementation(libs.revenuecat.purchases)

    testImplementation(libs.junit)
    // org.json is part of Android but stubbed in local unit tests.
    testImplementation(libs.json)
}
