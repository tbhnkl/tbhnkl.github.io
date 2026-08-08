# תחרות צפצופים (Whistle Pitch Competition)

Android app (Kotlin + Jetpack Compose) for a group game: each player takes a
turn whistling, the app measures the highest sustained pitch (averaged over
a rolling ~0.5s window) using on-device autocorrelation-based pitch
detection, and a final leaderboard shows who whistled the highest.

## How it works

1. **Setup** – choose the number of players (and optionally rename them).
2. **Turn** – each player in turn presses "התחילו לצפצף", whistles for a few
   seconds, and sees their score in Hz.
3. **Results** – a sorted leaderboard with the winner highlighted.

Pitch detection lives in `app/src/main/java/.../audio/`:
- `PitchDetector` — normalized autocorrelation with parabolic interpolation,
  tuned for the 400–10,000 Hz whistle range.
- `AudioCapture` — reads mic frames via `AudioRecord`, tracks a rolling
  ~500ms average pitch, and reports the best (highest) sustained average.

## Building

This is a standard Gradle Android project (min SDK 26, Compose, Material3).

```
./gradlew assembleDebug
```

Requires the Android SDK (set `ANDROID_HOME`/`local.properties`). Open the
project root in Android Studio for the easiest setup — it will prompt to
install any missing SDK components automatically.
