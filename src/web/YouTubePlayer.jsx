import { useEffect, useRef, useState } from 'react';
let sdk;
function loadSDK() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!sdk) sdk = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { sdk = null; reject(new Error('YouTube could not load. Check your connection or content blocker and try again.')); }, 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timeout); resolve(window.YT); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { clearTimeout(timeout); sdk = null; script.remove(); reject(new Error('YouTube could not load. Please try again.')); };
    document.head.appendChild(script);
  });
  return sdk;
}
export default function YouTubePlayer({ track, onEnded, onPlaying }) {
  const host = useRef(null);
  const callbacks = useRef({ onEnded, onPlaying });
  callbacks.current = { onEnded, onPlaying };
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false, player;
    setError('');
    callbacks.current.onPlaying(false);
    const mount = document.createElement('div');
    host.current.replaceChildren(mount);
    loadSDK().then(YT => {
      if (cancelled) return;
      player = new YT.Player(mount, {
        width: '100%', height: '100%', videoId: track.id,
        playerVars: { playsinline: 1, origin: location.origin, rel: 0 },
        events: {
          onStateChange: event => {
            callbacks.current.onPlaying(event.data === YT.PlayerState.PLAYING);
            if (event.data === YT.PlayerState.ENDED) callbacks.current.onEnded();
          },
          onError: () => { callbacks.current.onPlaying(false); setError('This video is unavailable here or its owner has disabled embedding. Try another video or open it on YouTube.'); },
        },
      });
    }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; player?.destroy(); callbacks.current.onPlaying(false); };
  }, [track.id, attempt]);
  return <><div className="youtube-screen" ref={host} />{error && <div className="notice" role="alert">{error} <button onClick={() => setAttempt(a => a + 1)}>Retry</button></div>}
    <a className="external-link" href={`https://www.youtube.com/watch?v=${track.id}`} target="_blank" rel="noreferrer">Open on YouTube ↗</a></>;
}
