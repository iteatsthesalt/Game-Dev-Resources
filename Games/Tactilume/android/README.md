# Tactilume for Android

A small native app that shows `../Tactilume.html` full screen in a WebView and adds what a
browser tab cannot: saving photos and clips to the gallery, sharing them, haptics, keeping the
screen on, the highest refresh rate, drawing under the camera cutout, and Android Back.

The page is not copied into this folder. Every build copies the current `../Tactilume.html`
into the APK, so build the web app first.

## Build

```
cd Games/Tactilume
npm install                          # once
npm run build                        # src/ -> Tactilume.html
bash tools/setup-android-sdk.sh      # once, if there is no Android SDK yet
cd android
ANDROID_HOME=/opt/android-sdk ./gradlew assembleDebug
```

The APK lands in `app/build/outputs/apk/debug/app-debug.apk`. Install it with
`adb install -r app/build/outputs/apk/debug/app-debug.apk`. `./gradlew lintDebug` checks the code.

Needs JDK 17 or newer (21 is used in CI). The Gradle wrapper downloads Gradle itself.

## How it fits together

- `app/build.gradle.kts`: versions, and the task that copies the web app into the assets.
- `MainActivity.kt`: the window (immersive, cutouts, refresh rate, gesture edges), the WebView,
  Back, the microphone and file-picker permissions, and the notices shown when WebView is too
  old or the page keeps stopping.
- `WebClients.kt`: serves the page from the APK at `https://appassets.androidplatform.net` and
  refuses every other request, so nothing leaves the device.
- `NativeBridge.kt`, `FileTransfers.kt`, `MediaSaver.kt`: the `TactilumeNative` messages described
  in `../src/js/CONTRACTS.md` ("Android bridge"), streaming files in and saving them to
  `Pictures/Tactilume` and `Movies/Tactilume`.

When the page is open in a debug build, `chrome://inspect` on a computer shows it for debugging.
