import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

let spotifyApi;
function loadSpotifyApi() {
  if (!spotifyApi) spotifyApi = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Spotify controls could not load.')), 15000);
    window.onSpotifyIframeApiReady = api => { clearTimeout(timeout); resolve(api); };
    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.onerror = () => { clearTimeout(timeout); spotifyApi = null; reject(new Error('Spotify controls could not load.')); };
    document.head.appendChild(script);
  });
  return spotifyApi;
}

const SpotifyEmbed = forwardRef(function SpotifyEmbed({ embedUrl, onPlaying, onProgress }, ref) {
  const host = useRef(null);
  const controller = useRef(null);
  const callbacks = useRef({ onPlaying, onProgress });
  callbacks.current = { onPlaying, onProgress };
  const [error, setError] = useState('');
  useImperativeHandle(ref, () => ({
    play: () => controller.current?.play(),
    pause: () => controller.current?.pause(),
    seek: seconds => controller.current?.seek(seconds),
  }), []);
  useEffect(() => {
    let cancelled = false;
    setError('');
    const url = embedUrl.replace('/embed/', '/');
    loadSpotifyApi().then(api => {
      if (cancelled) return;
      api.createController(host.current, { url, width: '100%', height: 80 }, instance => {
        if (cancelled) { instance.destroy(); return; }
        controller.current = instance;
        instance.addListener('playback_update', event => {
          const data = event.data || {};
          callbacks.current.onPlaying(data.isPaused === false && !data.isBuffering);
          callbacks.current.onProgress({ current: (data.position || 0) / 1000, duration: (data.duration || 0) / 1000 });
        });
      });
    }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; controller.current?.destroy(); controller.current = null; callbacks.current.onPlaying(false); };
  }, [embedUrl]);
  return <><div className="spotify-api-embed" ref={host} />{error && <p className="mini-drawer-note" role="alert">{error}</p>}</>;
});

export default SpotifyEmbed;
