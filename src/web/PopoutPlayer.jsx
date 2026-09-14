import { useEffect, useRef, useState } from 'react';
import YouTubePlayer from './YouTubePlayer.jsx';
import SpotifyEmbed from './SpotifyEmbed.jsx';
import { getMusicKit } from '../apple/auth.js';
import pinkFrame from '../../assets/pink/frame.png';
import blueFrame from '../../assets/blue/frame.png';
import pinkOverlay from '../../assets/pink/frame_no_background.png';
import blueOverlay from '../../assets/blue/frame_no_background.png';
import pinkPlant from '../../assets/pink/plant.png';
import bluePlant from '../../assets/blue/plant.png';
import pinkRecord from '../../assets/pink/record_player.png';
import blueRecord from '../../assets/blue/record_player.png';
import pinkVinyl from '../../assets/animations/record-pink/frame-1.png';
import blueVinyl from '../../assets/animations/record-blue/frame-1.png';
import pinkNeedle from '../../assets/animations/pink/needle-playing/frame-1.png';
import blueNeedle from '../../assets/animations/blue/needle-playing/frame-1.png';
import pinkPrevious from '../../assets/pink/backwards_button.png';
import bluePrevious from '../../assets/blue/backwards_button.png';
import pinkNext from '../../assets/pink/forwards_button.png';
import blueNext from '../../assets/blue/forwards_button.png';
import pinkPlay from '../../assets/pink/play_button.png';
import bluePlay from '../../assets/blue/play_button.png';
import pinkPause from '../../assets/pink/pause_button.png';
import bluePause from '../../assets/blue/pause_button.png';
import pinkProgress from '../../assets/pink/progress_bar.png';
import blueProgress from '../../assets/blue/progress_bar.png';
import pinkAlbum from '../../assets/pink/album_frame.png';
import blueAlbum from '../../assets/blue/album_frame.png';
import pinkExit from '../../assets/pink/exit_button.png';
import blueExit from '../../assets/blue/exit_button.png';

const artwork = {
  pink: { frame: pinkFrame, overlay: pinkOverlay, plant: pinkPlant, record: pinkRecord, vinyl: pinkVinyl, needle: pinkNeedle, previous: pinkPrevious, next: pinkNext, play: pinkPlay, pause: pinkPause, progress: pinkProgress, album: pinkAlbum, exit: pinkExit },
  blue: { frame: blueFrame, overlay: blueOverlay, plant: bluePlant, record: blueRecord, vinyl: blueVinyl, needle: blueNeedle, previous: bluePrevious, next: blueNext, play: bluePlay, pause: bluePause, progress: blueProgress, album: blueAlbum, exit: blueExit },
};
const time = value => { const n = Math.floor(value || 0); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };

export default function PopoutPlayer({ service, theme, track, playlistName, embedUrl, appleLibraryTrack, playing, onPlaying, onClose, onStep }) {
  const youtube = useRef(null);
  const spotify = useRef(null);
  const closeButton = useRef(null);
  const closeAction = useRef(onClose);
  closeAction.current = onClose;
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const [controlsOpen, setControlsOpen] = useState(false);
  const assets = artwork[theme];
  const title = service === 'youtube' ? track?.title : appleLibraryTrack?.title || playlistName;
  const hasMedia = service === 'youtube' ? !!track : !!embedUrl || !!appleLibraryTrack;
  const serviceName = service === 'apple' ? 'Apple Music' : service === 'spotify' ? 'Spotify' : 'YouTube';
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const key = event => { if (event.key === 'Escape') closeAction.current(); };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', key); };
  }, []);
  function toggle() {
    if (service === 'youtube') {
      setControlsOpen(true);
      youtube.current?.toggle();
    } else if (service === 'spotify') {
      if (playing) spotify.current?.pause();
      else { setControlsOpen(true); spotify.current?.play(); }
    } else if (appleLibraryTrack && getMusicKit()) {
      const mk = getMusicKit();
      Promise.resolve(playing ? mk.pause() : mk.play()).then(() => onPlaying(!playing)).catch(() => {});
    } else setControlsOpen(true);
  }
  function seek(event) {
    const seconds = Number(event.target.value);
    if (service === 'spotify') spotify.current?.seek(seconds);
    else youtube.current?.seek(seconds);
    setProgress(p => ({ ...p, current: seconds }));
  }
  function toggleServiceControls() {
    if (controlsOpen && service === 'spotify' && playing) spotify.current?.pause();
    setControlsOpen(open => !open);
  }
  return <div className="popout-backdrop mini-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="mini-dialog" role="dialog" aria-modal="true" aria-label="Surya vinyl player">
      <div className="mini-vinyl">
        <img className="mini-layer" src={assets.frame} alt="" />
        <img className="mini-record" src={assets.record} alt="" />
        <img className={`mini-record mini-disc ${playing ? 'spinning' : ''}`} src={assets.vinyl} alt="" />
        <img className="mini-record mini-needle" src={assets.needle} alt="" />
        <img className="mini-layer mini-overlay" src={assets.overlay} alt="" />
        <img className="mini-layer mini-decoration" src={assets.plant} alt="" />
        <div className="mini-window-title">surya player</div>
        <img className="mini-layer mini-ui" src={assets.exit} alt="" />
        <button ref={closeButton} className="mini-close" aria-label="Close vinyl player" onClick={onClose} />
        <button className="mini-service-pill" onClick={toggleServiceControls} aria-expanded={controlsOpen}>{serviceName.toUpperCase()} {controlsOpen ? '⌃' : '⌄'}</button>
        <div className="mini-artwork">{service === 'youtube' && track ? <img src={`https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`} alt="" /> : <span>♫</span>}</div>
        <img className="mini-layer mini-album-frame" src={assets.album} alt="" />
        <div className="mini-track"><span>now playing...</span><strong title={title}>{title || 'Your playlist'}</strong><small title={playlistName}>{service === 'youtube' ? playlistName : appleLibraryTrack?.artist || serviceName}</small></div>
        <img className="mini-layer mini-ui" src={assets.previous} alt="" />
        <img className="mini-layer mini-ui" src={playing ? assets.pause : assets.play} alt="" />
        <img className="mini-layer mini-ui" src={assets.next} alt="" />
        <button className="mini-hit mini-prev" aria-label={service === 'youtube' ? 'Previous song' : `Open ${serviceName} previous song control`} onClick={() => service === 'youtube' ? onStep(-1) : setControlsOpen(true)} disabled={!hasMedia} />
        <button className="mini-hit mini-play" aria-label={service === 'youtube' || service === 'spotify' || appleLibraryTrack ? playing ? 'Pause music' : 'Play music' : `Open ${serviceName} playback controls`} onClick={toggle} disabled={!hasMedia} />
        <button className="mini-hit mini-next" aria-label={service === 'youtube' ? 'Next song' : `Open ${serviceName} next song control`} onClick={() => service === 'youtube' ? onStep(1) : setControlsOpen(true)} disabled={!hasMedia} />
        <img className="mini-layer mini-ui" src={assets.progress} alt="" />
        {(service === 'youtube' && track || service === 'spotify' && progress.duration > 0) && <input className="mini-seek" aria-label="Seek in song" type="range" min="0" max={Math.max(progress.duration, 1)} value={Math.min(progress.current, progress.duration || 1)} onChange={seek} />}
        <div className="mini-times"><span>{service === 'youtube' || progress.duration ? time(progress.current) : ''}</span><span>{service === 'youtube' || progress.duration ? time(progress.duration) : ''}</span></div>
      </div>
      <div className={`mini-service-drawer ${service === 'spotify' ? 'spotify-drawer' : ''} ${controlsOpen ? 'open' : ''}`} aria-hidden={!controlsOpen}>
        <div className="mini-drawer-head"><strong>{serviceName} playback</strong><button onClick={toggleServiceControls} aria-label="Hide service player">⌃</button></div>
        {service === 'youtube' && track && <YouTubePlayer ref={youtube} key={track.id} track={track} onEnded={() => onStep(1)} onPlaying={onPlaying} onProgress={setProgress} />}
        {service === 'spotify' && embedUrl && <SpotifyEmbed ref={spotify} embedUrl={embedUrl} onPlaying={onPlaying} onProgress={setProgress} />}
        {service === 'apple' && embedUrl && <iframe title={`${playlistName} Apple Music player`} src={embedUrl} allow="encrypted-media; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />}
        {appleLibraryTrack && <p className="mini-drawer-note">Playing through your Apple Music library. Use the buttons on the vinyl player.</p>}
        {!hasMedia && <p className="mini-drawer-note">Add a song or choose a saved playlist first.</p>}
      </div>
    </section>
  </div>;
}
