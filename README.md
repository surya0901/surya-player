# Surya Player

A pixel-art music player for the web. [Try the live demo](https://surya0901.github.io/surya-player/) or run the desktop app locally.

Built by [Surya Gopinath](https://github.com/surya0901).

The demo opens with a starter YouTube playlist. Choose **YouTube** to create playlists and paste video links; the playlists stay in your browser. Choose **Spotify** or **Apple Music** to paste a shared playlist link for a preview, or connect your own account (see setup below) to browse and play your real playlists in full. Selecting a playlist opens a compact pixel-art vinyl player based on the original desktop design, with a tap-to-jump queue behind the settings gear.

The browser demo uses the blue turntable. Press **Next** or **Previous** to skip tracks — real skip control for YouTube and connected Spotify/Apple Music accounts, or a hand-off to the service's own player for unauthenticated Spotify/Apple links. On YouTube, hold the vinyl to temporarily slow the song, drag it to scrub, or tap the speed badge to change playback speed. Connected Spotify accounts play full tracks through the vinyl controls directly, with drag-to-scrub and no ads — that requires the visitor's account to have Premium (see below). Apple Music library songs likewise play through the vinyl controls when connected.

## Run the browser demo locally

Requires Node.js 22 or newer.

```bash
git clone https://github.com/surya0901/surya-player.git
cd surya-player
npm ci --ignore-scripts
npm run vite
```

Open `http://127.0.0.1:5173/`. To check a production build, run `npm test` and `npm run build`.

## Set up your own account connections

Without any setup, the demo already works: paste a public Spotify or Apple Music playlist link for a preview-only embed, or build a YouTube playlist (full playback, no login needed). The steps below are only for wiring up **real, full-length, ad-free playback** through a visitor's own logged-in account — this requires your own developer credentials for each service, since they're tied to your Spotify/Apple developer account.

### Spotify (real full-track playback via the Web Playback SDK)

1. Create an app at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. In its **Settings → Redirect URIs**, add these exact URIs (no trailing-slash differences — Spotify matches exact strings):
   ```
   http://127.0.0.1:5173/
   https://<your-github-username>.github.io/surya-player/
   ```
3. Copy the **Client ID** and set it as `VITE_SPOTIFY_CLIENT_ID` — either in a local `.env` file, or as a GitHub Actions repository **variable** if you're deploying via the included workflow.
4. Spotify apps start in **Development Mode**, which only lets allow-listed accounts connect. In **Settings → User Management**, add the email of anyone you want to be able to log in (including yourself).
5. **Whoever connects needs Spotify Premium.** This is a rule enforced by Spotify's Web Playback SDK, not something this app can bypass — a free account can authorize but won't get full-length audio.

No client secret is involved: this uses the PKCE OAuth flow, safe to run entirely in the browser, with tokens kept in `sessionStorage`.

### Apple Music (browse + play your library)

1. Generate a MusicKit private key and developer token, signed with your Apple Developer account (see [APPLE_MUSIC_SETUP.md](APPLE_MUSIC_SETUP.md) for the exact steps to create the key).
2. Set the signed token as `VITE_APPLE_MUSIC_DEVELOPER_TOKEN` — locally in `.env.local`, or as a GitHub Actions repository **secret** for deployment. The signed token itself ships in the browser bundle, which is expected for MusicKit; **never commit the `.p8` signing key file** — only the signed token derived from it.
3. Whoever connects needs an active Apple Music subscription for full playback; the token only grants library access.
4. Tokens expire — plan to regenerate and redeploy before yours does.

### YouTube (browse + play your own playlists)

Paste-a-link playback needs zero setup. Connecting your own account additionally lets you import your own playlists — the easiest of the three to set up: no client secret, no subscription requirement, no long-lived tokens to manage.

1. In the [Google Cloud Console](https://console.cloud.google.com/), create (or pick) a project and enable the **YouTube Data API v3** under **APIs & Services → Library**.
2. Under **APIs & Services → Credentials → Create Credentials → OAuth client ID**, choose **Web application**.
3. Under **Authorized JavaScript origins**, add:
   ```
   http://127.0.0.1:5173
   https://<your-github-username>.github.io
   ```
   (Origins only — no path, no trailing slash. This is different from Spotify's redirect URIs.)
4. Copy the **Client ID** and set it as `VITE_YOUTUBE_CLIENT_ID` — locally in `.env`, or as a GitHub Actions repository **variable** for deployment.
5. If your OAuth consent screen is in **Testing** mode, add the email of anyone who should be able to connect under **Audience → Test users**; publish the app to allow anyone.

This uses Google Identity Services' token model, built for exactly this case (browser-only, no backend): it hands back a short-lived (~1 hour) access token directly, with no client secret and no refresh token to protect. A visitor just reconnects if their session runs out.

The demo never routes one service's audio through another (e.g. never plays a Spotify track via a YouTube stream) — each service always plays through its own official player or SDK.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` tests, builds, and deploys each push to `main`. In repository **Settings → Pages**, choose **GitHub Actions** as the build and deployment source. The live site will be `https://surya0901.github.io/surya-player/` after the first successful deployment. Spotify and Apple account connections remain optional; the link-based demo works immediately.

## Desktop version

The original Electron player and its pixel art assets remain in this repository. `npm run dev` launches the desktop shell and Vite together; see [SPOTIFY_SETUP.md](SPOTIFY_SETUP.md), [APPLE_MUSIC_SETUP.md](APPLE_MUSIC_SETUP.md), [YOUTUBE_SETUP.md](YOUTUBE_SETUP.md), and [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for its original setup. The browser demo is the default Vite entry point; Electron loads the separate `desktop.html` entry.
