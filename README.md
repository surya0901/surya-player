# Surya Player

A pixel-art music player for the web. [Try the live demo](https://surya0901.github.io/surya-player/) or run the desktop app locally.

The demo opens with a starter YouTube playlist. Choose **YouTube** to create playlists and paste video links; the playlists stay in your browser. Choose **Spotify** or **Apple Music** to paste a shared playlist link. Selecting a playlist opens a compact pixel-art vinyl player based on the original desktop design. YouTube has play, pause, skip, and seek buttons on the player. Tap the service badge to expand the official YouTube video or Spotify/Apple Music playlist controls when needed. When account access is configured, Spotify users can browse their own playlists and Apple Music users can browse and play supported library songs.

The browser demo uses the blue turntable. Press **Next** or **Previous** to watch the record swap while the player stays in place. On YouTube, hold the vinyl to temporarily slow the song, drag it to scrub, or tap the speed badge to change playback speed. Spotify supports play/pause and scrubbing through its compact official embed inside the player; its audio speed cannot be changed here. Apple Music shared playlists use Apple's official player inside the window, while connected library songs can be played from the vinyl controls.

## Run the browser demo locally

Requires Node.js 22 or newer.

```bash
git clone https://github.com/surya0901/surya-player.git
cd surya-player
npm ci --ignore-scripts
npm run vite
```

Open `http://127.0.0.1:5173/`. To check a production build, run `npm test` and `npm run build`.

## Account connections

**Spotify.** Create a Spotify app, add `http://127.0.0.1:5173/` and `https://surya0901.github.io/surya-player/` as exact redirect URIs, and put its client ID in `VITE_SPOTIFY_CLIENT_ID` locally or as a GitHub Actions repository **variable**. Spotify’s development mode restricts authenticated users to the app’s allowlist; the app owner must meet Spotify’s developer requirements. Shared playlist embeds work for visitors without OAuth. This integration uses PKCE and browser session storage; no client secret is shipped.

**Apple Music.** MusicKit requires an Apple developer token signed with a private key. Set `VITE_APPLE_MUSIC_DEVELOPER_TOKEN` in `.env.local` or as a GitHub Actions repository **secret** to enable account connection. The signed developer token is included in the browser bundle, as MusicKit requires; **never put the `.p8` signing key in the browser or repository**. Renew the token before it expires. An Apple Music subscription may be needed for full playback. Shared playlist embeds work without this setup.

The demo does not extract music from one service to play it through another. Spotify and Apple Music playback uses their official players. YouTube playback uses the official YouTube player; owners can disable embedding for individual videos.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` tests, builds, and deploys each push to `main`. In repository **Settings → Pages**, choose **GitHub Actions** as the build and deployment source. The live site will be `https://surya0901.github.io/surya-player/` after the first successful deployment. Spotify and Apple account connections remain optional; the link-based demo works immediately.

## Desktop version

The original Electron player and its pixel art assets remain in this repository. `npm run dev` launches the desktop shell and Vite together; see [SPOTIFY_SETUP.md](SPOTIFY_SETUP.md), [APPLE_MUSIC_SETUP.md](APPLE_MUSIC_SETUP.md), [YOUTUBE_SETUP.md](YOUTUBE_SETUP.md), and [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for its original setup. The browser demo is the default Vite entry point; Electron loads the separate `desktop.html` entry.
