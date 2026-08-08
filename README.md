# תחרות צפצופים (Whistle Pitch Competition)

A group game, in two flavors: each player takes a turn whistling, the app
measures the highest sustained pitch (averaged over a rolling ~0.5s window)
using autocorrelation-based pitch detection, and a final leaderboard shows
who whistled the highest.

- **Android app** — Kotlin + Jetpack Compose, in `app/`.
- **Mobile web app** — plain HTML/CSS/JS (Web Audio API), at the repo root
  (`index.html`), served directly by GitHub Pages.

## How it works

1. **Setup** – choose the number of players (and optionally rename them).
2. **Turn** – each player in turn presses "התחילו לצפצף", whistles for a few
   seconds, and sees their score in Hz.
3. **Results** – a sorted leaderboard with the winner highlighted.

## Android app

Pitch detection lives in `app/src/main/java/.../audio/`:
- `PitchDetector` — normalized autocorrelation with parabolic interpolation,
  tuned for the 400–10,000 Hz whistle range.
- `AudioCapture` — reads mic frames via `AudioRecord`, tracks a rolling
  ~500ms average pitch, and reports the best (highest) sustained average.

### Building

This is a standard Gradle Android project (min SDK 26, Compose, Material3).

```
./gradlew assembleDebug
```

Requires the Android SDK (set `ANDROID_HOME`/`local.properties`). Open the
project root in Android Studio for the easiest setup — it will prompt to
install any missing SDK components automatically.

## Mobile web app

Static, dependency-free, mobile-first, RTL. Lives in `index.html` +
`assets/`:
- `assets/app.js` — the same autocorrelation pitch-detection algorithm as
  the Android app, ported to JS, running on mic audio captured via the Web
  Audio API (`getUserMedia` + `ScriptProcessorNode`).
- `assets/style.css` — responsive layout with light/dark theming
  (`prefers-color-scheme`).
- `manifest.webmanifest` — lets it be added to a phone's home screen.

Requires HTTPS (or `localhost`) since `getUserMedia` needs a secure context.
Once merged, it's served automatically at the root of this GitHub Pages
site. To try it locally:

```
python3 -m http.server 8000
# open http://localhost:8000
```
