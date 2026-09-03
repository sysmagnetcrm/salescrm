plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.academysales.crm"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.academysales.crm"
        minSdk = 24
        targetSdk = 35
        versionCode = 5
        versionName = "1.5.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("String", "WEB_APP_URL", "\"https://salescrm-theta.vercel.app\"")
        buildConfigField("String", "API_BASE_URL", "\"https://salescrm-7z2o.onrender.com/api\"")
        buildConfigField("String", "CLIENT_VERSION", "\"1.5.0\"")
    }

    signingConfigs {
        create("release") {
            storeFile = file("academysales_release.jks")
            storePassword = "AcademySales@2025"
            keyAlias = "academysales"
            keyPassword = "AcademySales@2025"
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            // Debug also signed with release key so Play Protect accepts sideloading
            signingConfig = signingConfigs.getByName("release")
            buildConfigField("String", "WEB_APP_URL", "\"https://salescrm-theta.vercel.app\"")
            buildConfigField("String", "API_BASE_URL", "\"https://salescrm-7z2o.onrender.com/api\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            buildConfigField("String", "WEB_APP_URL", "\"https://salescrm-theta.vercel.app\"")
            buildConfigField("String", "API_BASE_URL", "\"https://salescrm-7z2o.onrender.com/api\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.webkit:webkit:1.11.0")
}
