pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
    plugins {
        id("com.android.application") version "8.9.1"
        id("org.jetbrains.kotlin.android") version "2.1.21"
        id("org.jetbrains.kotlin.jvm") version "2.1.21"
        id("org.jetbrains.kotlin.plugin.compose") version "2.1.21"
        id("org.jetbrains.kotlin.plugin.serialization") version "2.1.21"
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "RoomScanInspectorAndroid"

// `core` is plain Kotlin/JVM (no Android SDK needed) and holds everything that
// must behave identically to the iPhone app: the project.json schema, units,
// timebase, bookmarks, alignment, plan math and exports.
include(":core")

// Pass -PcoreOnly=true to build/test only the shared core on a machine without
// the Android SDK.
if (providers.gradleProperty("coreOnly").orNull != "true") {
    include(":app")
}
