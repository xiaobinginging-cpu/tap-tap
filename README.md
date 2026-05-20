# tap-tap

> 家里跟练用的节拍器 — a minimal metronome PWA.

A small offline-capable web app I use at home to practice along with. Big BPM
readout, a few buttons, a play/pause. That's it.

## Features

- BPM range **40–240**, default **180**
- `−5 / −1 / +1 / +5` step buttons and a full-range slider
- Play / pause with a visual pulse synced to the beat
- Pure Web Audio click (880 Hz sine, ~50 ms exponential decay) — no audio files
- Installable PWA (works offline once cached)

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- `vite-plugin-pwa` for the service worker + web manifest
- System serif fonts (Songti SC / STSong) — no external font CDN

## Brand notes (so future-me doesn't drift)

- Background: cream `#f5ecd9` with a soft rose dot pattern
- Text: cedar `#6b4f3b`
- Accent: dusty rose `#d4a89b`
- Headers: system serif (Songti SC on Apple, STSong / SimSun on Windows)

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
npm run preview  # preview the built bundle
```

## Anchor — 5/12 周二午休

This is the first thing I built end-to-end in a single sitting (about a 午休) by
talking to **Claude Code directly** — no plan doc, no scaffolding script, no
intermediate handoff. I described what I wanted (the metronome, the BPM range,
the brand, the trial-run framing), Claude Code cloned the repo, scaffolded
Vite + React + Tailwind v4, wrote the Web Audio click, wired up the controls,
built it clean, and pushed to `main`.

Logging it here so the workflow has a foothold: 周二午休, one prompt, one
working PWA on `main`. If it sticks, the next thing gets the same treatment.
