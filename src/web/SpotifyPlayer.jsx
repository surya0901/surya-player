import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { getAccessToken } from './spotify.js';

let sdkPromise;
function loadSDK() {
  if (window.Spotify?.Player) return Promise.resolve(window.Spotify);
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { sdkPromise = null; reject(new Error('Spotify player could not load.')); }, 15000);
    window.onSpotifyWebPlaybackSDKReady = () => { clearTimeout(timeout); resolve(window.Spotify); };
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.onerror = () => { clearTimeout(timeout); sdkPromise = null; reject(new Error('Spotify player could not load.')); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}
async function api(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`https://api.spotify.com${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (!res.ok && res.status !== 204) throw new Error('Spotify playback request failed.');
  return res;
}

// Uses the Web Playback SDK (real, full-length, ad-free audio) instead of the
// public embed iframe. Requires the connected account to have Premium — that
// restriction is Spotify's, not something this app can work around.
const SpotifyPlayer = forwardRef(function SpotifyPlayer({ uri, onEnded, onPlaying, onProgress, onError }, ref) {
  const playerRef = useRef(null);
  const deviceId = useRef(null);
  const currentUri = useRef(null);
  const startedUri = useRef(null);
  const callbacks = useRef({ onEnded, onPlaying, onProgress, onError });
  callbacks.current = { onEnded, onPlaying, onProgress, onError };
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.resume(),
    pause: () => playerRef.current?.pause(),
    seek: seconds => playerRef.current?.seek(Math.max(0, seconds) * 1000),
  }), []);

  useEffect(() => {
    let cancelled = false, player;
    loadSDK().then(Spotify => {
      if (cancelled) return;
      player = new Spotify.Player({ name: 'Surya Player', getOAuthToken: cb => getAccessToken().then(cb).catch(() => {}), volume: 1 });
      player.addListener('ready', ({ device_id }) => { deviceId.current = device_id; setReady(true); });
      player.addListener('not_ready', () => setReady(false));
      player.addListener('initialization_error', ({ message }) => callbacks.current.onError?.(message));
      player.addListener('authentication_error', () => callbacks.current.onError?.('Spotify session expired. Please connect again.'));
      player.addListener('account_error', () => callbacks.current.onError?.('This Spotify account needs an active Premium subscription to play full tracks here.'));
      player.addListener('playback_error', ({ message }) => callbacks.current.onError?.(message));
      player.addListener('player_state_changed', state => {
        if (!state) return;
        callbacks.current.onPlaying(!state.paused);
        callbacks.current.onProgress({ current: state.position / 1000, duration: state.duration / 1000 });
        const trackUri = state.track_window?.current_track?.uri;
        if (!state.paused && state.position > 500) startedUri.current = trackUri;
        else if (state.paused && state.position === 0 && startedUri.current === trackUri) {
          startedUri.current = null;
          callbacks.current.onEnded?.();
        }
      });
      playerRef.current = player;
      player.connect();
    }).catch(err => callbacks.current.onError?.(err.message));
    return () => { cancelled = true; player?.disconnect(); playerRef.current = null; deviceId.current = null; setReady(false); };
  }, []);

  useEffect(() => {
    if (!ready || !uri || uri === currentUri.current) return;
    currentUri.current = uri;
    startedUri.current = null;
    api(`/v1/me/player/play?device_id=${deviceId.current}`, { method: 'PUT', body: JSON.stringify({ uris: [uri] }) }).catch(err => callbacks.current.onError?.(err.message));
  }, [uri, ready]);

  return null;
});

export default SpotifyPlayer;
