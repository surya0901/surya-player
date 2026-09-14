import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
const YouTubePlayer = forwardRef(function YouTubePlayer({ track, onEnded, onPlaying, onProgress, onRatesReady, onRateChange }, ref) {
  const host = useRef(null);
  const playerRef = useRef(null);
  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
    toggle: () => {
      const player = playerRef.current;
      if (!player) return;
      if (player.getPlayerState() === window.YT?.PlayerState?.PLAYING) player.pauseVideo();
      else player.playVideo();
    },
    seek: seconds => playerRef.current?.seekTo(seconds, true),
    setRate: rate => playerRef.current?.setPlaybackRate(rate),
  }), []);
  const callbacks = useRef({ onEnded, onPlaying, onProgress, onRatesReady, onRateChange });
  callbacks.current = { onEnded, onPlaying, onProgress, onRatesReady, onRateChange };
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false, player;
    const ticker = setInterval(() => {
      if (playerRef.current?.getCurrentTime) callbacks.current.onProgress?.({ current: playerRef.current.getCurrentTime(), duration: playerRef.current.getDuration() });
    }, 500);
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
          onReady: () => { playerRef.current = player; callbacks.current.onRatesReady?.(player.getAvailablePlaybackRates()); },
          onStateChange: event => {
            callbacks.current.onPlaying(event.data === YT.PlayerState.PLAYING);
            if (event.data === YT.PlayerState.PLAYING) callbacks.current.onRatesReady?.(player.getAvailablePlaybackRates());
            if (event.data === YT.PlayerState.ENDED) callbacks.current.onEnded();
          },
          onPlaybackRateChange: event => callbacks.current.onRateChange?.(event.data),
          onError: () => { callbacks.current.onPlaying(false); setError('This video is unavailable here or its owner has disabled embedding. Try another video or open it on YouTube.'); },
        },
      });
    }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; clearInterval(ticker); playerRef.current = null; player?.destroy(); callbacks.current.onPlaying(false); };
  }, [track.id, attempt]);
  return <><div className="youtube-screen" ref={host} />{error && <div className="notice" role="alert">{error} <button onClick={() => setAttempt(a => a + 1)}>Retry</button></div>}
    <a className="external-link" href={`https://www.youtube.com/watch?v=${track.id}`} target="_blank" rel="noreferrer">Open on YouTube ↗</a></>;
});

export default YouTubePlayer;
