import javax.inject.Inject

plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "app.tactilume"
    compileSdk {
        version = release(37) { minorApiLevel = 2 }
    }

    defaultConfig {
        applicationId = "app.tactilume"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    lint {
        abortOnError = true
        checkReleaseBuilds = true
    }
}

dependencies {
    implementation(libs.androidx.activity)
    implementation(libs.androidx.core)
    implementation(libs.androidx.webkit)
}

// The web app is built into one file one folder up (npm run build). It is copied into the
// APK at build time rather than kept in the repo twice, so the app always ships the page
// that src/ builds.
abstract class CopyWebApp : DefaultTask() {
    // a file collection rather than @InputFile, so a missing page reaches the clear
    // message below instead of Gradle's generic "file does not exist"
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val page: ConfigurableFileCollection

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @get:Inject
    abstract val files: FileSystemOperations

    @TaskAction
    fun copy() {
        val source = page.singleFile
        if (!source.isFile) {
            throw GradleException(
                "The web app was not found at ${source.absolutePath}.\n" +
                    "Build it first: run 'npm install' (once) and then 'npm run build' in Games/Tactilume, " +
                    "then build the Android app again.",
            )
        }
        files.sync {
            from(source)
            into(outputDir)
            rename { "index.html" }
        }
    }
}

val webApp = rootProject.layout.projectDirectory.file("../Tactilume.html")

// One copy task per variant, registered as a generated asset folder: every task that reads
// assets (merging, lint, packaging) then depends on it without hand-made wiring, and AGP
// gives each variant its own folder under build/generated/assets/.
androidComponents {
    onVariants { variant ->
        val copy = tasks.register<CopyWebApp>("copy${variant.name.replaceFirstChar(Char::uppercase)}WebApp") {
            description = "Copies ../Tactilume.html into the ${variant.name} assets as index.html."
            page.from(webApp)
        }
        variant.sources.assets?.addGeneratedSourceDirectory(copy, CopyWebApp::outputDir)
    }
}
