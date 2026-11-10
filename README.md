# Cutie – her all-in-one app 💗

One Android app with: Water Buddy (3D animal walks over any app every hour and asks "Have you drunk water?"),
home dashboard with a reacting mascot, skincare + habit checklists with streaks, private diary & mood chart,
period/cycle tracker with predictions, daily love notes + "Open when…" letters from you, special-date
countdowns, wardrobe & outfit planner, wishlist, 5 themes, PIN lock, local reminders, backup/restore.
Everything stays on her phone (no accounts, no internet needed).

## Build the APK (GitHub Actions)
1. Push this folder to your GitHub repo (replace the old files).
2. Actions tab → "Build APK" → open the latest run → download artifact **Cutie-debug-apk** → unzip → install `app-debug.apk`.
3. First launch: tap through the guided setup (notifications → display over other apps → battery). On some phones
   (ColorOS/Oppo etc.) for a sideloaded app: App info → ⋮ → "Allow restricted settings" first.

## Personalise it (no coding)
* **Love notes:** edit `app/src/main/assets/app/data/love_notes.json` (30 daily notes + 8 "Open when…" letters). Change `"from"` too.
* **Special dates:** she can edit them in the app. Defaults (birthday 25 Oct 2002, met 11 Apr, engagement 13 Apr) are in
  `app/src/main/assets/app/app.js` → search `dates:`.
* **Name** ("Cutie") is changeable in Settings → Name.
* Push the change to GitHub, download the new APK, install over the old one (her data is kept).

## Structure
* `assets/app/` – the whole UI (HTML/CSS/JS). `assets/pet/` – 3D walking animals (three.js, procedural).
* `MainActivity.kt` – hosts the UI + `Native` bridge. `OverlayService.kt` – walking buddy over other apps.
* `Reminders.kt`/`NotifReceiver.kt` – skincare, diary, love-note, date and period notifications. `BootReceiver.kt` – re-arms after reboot.
