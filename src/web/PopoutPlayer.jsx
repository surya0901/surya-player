import { useEffect, useRef, useState } from 'react';
import YouTubePlayer from './YouTubePlayer.jsx';
import { getMusicKit } from '../apple/auth.js';
import pinkScene from '../../assets/pink/frame.png';
import blueScene from '../../assets/blue/frame.png';
import pinkRecord from '../../assets/pink/record_player.png';
import blueRecord from '../../assets/blue/record_player.png';
import pinkVinyl from '../../assets/animations/record-pink/frame-1.png';
import blueVinyl from '../../assets/animations/record-blue/frame-1.png';
import pinkNeedle from '../../assets/animations/pink/needle-playing/frame-1.png';
import blueNeedle from '../../assets/animations/blue/needle-playing/frame-1.png';

const format = value => { const n = Math.floor(value || 0); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
export default function PopoutPlayer({ service, theme, track, playlistName, embedUrl, appleLibraryTrack, playing, onPlaying, onClose, onStep }) {
  const youtube = useRef(null);
  const close = useRef(null);
  const closeAction = useRef(onClose);
  closeAction.current = onClose;
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const title = service === 'youtube' ? track?.title : appleLibraryTrack?.title || playlistName || 'Your playlist';
  const hasMedia = service === 'youtube' ? !!track : !!embedUrl || !!appleLibraryTrack;
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    close.current?.focus();
    const key = event => { if (event.key === 'Escape') closeAction.current(); };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', key); };
  }, []);
  function toggle() {
    if (service === 'youtube') youtube.current?.toggle();
    else if (appleLibraryTrack && getMusicKit()) {
      const mk = getMusicKit();
      Promise.resolve(playing ? mk.pause() : mk.play()).then(() => onPlaying(!playing)).catch(() => {});
    }
  }
  function seek(event) {
    const seconds = Number(event.target.value);
    youtube.current?.seek(seconds);
    setProgress(p => ({ ...p, current: seconds }));
  }
  return <div className="popout-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="popout-player" role="dialog" aria-modal="true" aria-label="Surya Player">
      <div className="popout-titlebar"><span>✦ surya player</span><span className="popout-titlebar-right">{service === 'youtube' ? 'YOUTUBE' : service === 'spotify' ? 'SPOTIFY' : 'APPLE MUSIC'}<button ref={close} type="button" aria-label="Close player" onClick={onClose}>×</button></span></div>
      <div className="popout-scene pixel-window" style={{ backgroundImage: `url(${theme === 'pink' ? pinkScene : blueScene})` }}>
        <img className="record-base" src={theme === 'pink' ? pinkRecord : blueRecord} alt="" />
        <img className={`record-vinyl ${playing ? 'spinning' : ''}`} src={theme === 'pink' ? pinkVinyl : blueVinyl} alt="" />
        <img className="record-needle" src={theme === 'pink' ? pinkNeedle : blueNeedle} alt="" />
      </div>
      <div className="popout-information"><span className="micro-label">NOW PLAYING · {service.toUpperCase()}</span><strong>{title || 'Your next favorite song'}</strong><span>{service === 'youtube' ? playlistName : appleLibraryTrack?.artist || playlistName || 'Select a playlist'}</span></div>
      <div className="popout-controls">
        {service === 'youtube' && <button type="button" aria-label="Previous song" onClick={() => onStep(-1)} disabled={!track}>⏮</button>}
        {(service === 'youtube' || appleLibraryTrack) && <button type="button" className="popout-main-button" aria-label={playing ? 'Pause music' : 'Play music'} onClick={toggle} disabled={!hasMedia}>{playing ? '❚❚' : '▶'}</button>}
        {service === 'youtube' && <button type="button" aria-label="Next song" onClick={() => onStep(1)} disabled={!track}>⏭</button>}
        {service !== 'youtube' && !appleLibraryTrack && <span className="control-note">Use the {service === 'spotify' ? 'Spotify' : 'Apple Music'} playlist controls below</span>}
      </div>
      {service === 'youtube' && track && <div className="popout-timeline"><span>{format(progress.current)}</span><input aria-label="Seek in song" type="range" min="0" max={Math.max(progress.duration, 1)} value={Math.min(progress.current, progress.duration || 1)} onChange={seek} /><span>{format(progress.duration)}</span></div>}
      <div className="popout-media">
        {service === 'youtube' && track && <YouTubePlayer ref={youtube} key={track.id} track={track} onEnded={() => onStep(1)} onPlaying={onPlaying} onProgress={setProgress} />}
        {service === 'spotify' && embedUrl && <iframe className="spotify-frame" title={`${playlistName} Spotify player`} src={embedUrl} allow="autoplay; encrypted-media; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />}
        {service === 'apple' && embedUrl && <iframe title={`${playlistName} Apple Music player`} src={embedUrl} allow="encrypted-media; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />}
        {!hasMedia && <p className="popout-empty">Add a song or choose a saved playlist to use this player.</p>}
        {appleLibraryTrack && <p className="popout-empty">Playing through your Apple Music library.</p>}
      </div>
      <div className="popout-footer">✦ &nbsp; made for late-night listening <span>ESC TO CLOSE</span></div>
    </section>
  </div>;
}
