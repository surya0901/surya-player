import { useEffect, useRef, useState } from 'react';
import YouTubePlayer from './YouTubePlayer.jsx';
import SpotifyEmbed from './SpotifyEmbed.jsx';
import { getMusicKit } from '../apple/auth.js';
import blueFrame from '../../assets/blue/frame.png';
import blueOverlay from '../../assets/blue/frame_no_background.png';
import bluePlant from '../../assets/blue/plant.png';
import blueRecord from '../../assets/blue/record_player.png';
import blueVinyl1 from '../../assets/animations/record-blue/frame-1.png';
import blueVinyl2 from '../../assets/animations/record-blue/frame-2.png';
import blueVinyl3 from '../../assets/animations/record-blue/frame-3.png';
import blueVinyl4 from '../../assets/animations/record-blue/frame-4.png';
import blueNeedle from '../../assets/animations/blue/needle-playing/frame-1.png';
import bluePrevious from '../../assets/blue/backwards_button.png';
import blueNext from '../../assets/blue/forwards_button.png';
import bluePlay from '../../assets/blue/play_button.png';
import bluePause from '../../assets/blue/pause_button.png';
import blueProgress from '../../assets/blue/progress_bar.png';
import blueAlbum from '../../assets/blue/album_frame.png';
import blueExit from '../../assets/blue/exit_button.png';

const vinylFrames = [blueVinyl1, blueVinyl2, blueVinyl3, blueVinyl4];
const assets = { frame: blueFrame, overlay: blueOverlay, plant: bluePlant, record: blueRecord, needle: blueNeedle, previous: bluePrevious, next: blueNext, play: bluePlay, pause: bluePause, progress: blueProgress, album: blueAlbum, exit: blueExit };
const time = value => { const n = Math.floor(value || 0); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };

export default function PopoutPlayer({ service, track, playlistName, embedUrl, appleLibraryTrack, playing, onPlaying, onClose, onStep }) {
  const youtube = useRef(null);
  const spotify = useRef(null);
  const closeButton = useRef(null);
  const touch = useRef(null);
  const swapTimer = useRef(null);
  const lastSpotifyTrack = useRef(null);
  const closeAction = useRef(onClose);
  closeAction.current = onClose;
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const [controlsOpen, setControlsOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [braking, setBraking] = useState(false);
  const [scrubPreview, setScrubPreview] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [rates, setRates] = useState([0.5, 1, 1.5]);
  const [vinylFrame, setVinylFrame] = useState(0);
  const title = service === 'youtube' ? track?.title : appleLibraryTrack?.title || playlistName;
  const hasMedia = service === 'youtube' ? !!track : !!embedUrl || !!appleLibraryTrack;
  const serviceName = service === 'apple' ? 'Apple Music' : service === 'spotify' ? 'Spotify' : 'YouTube';
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const key = event => { if (event.key === 'Escape') closeAction.current(); };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', key); clearTimeout(swapTimer.current); };
  }, []);
  useEffect(() => {
    if (!playing || swapping) return;
    // These frames were drawn in perspective for this turntable. Rotating the
    // whole image would tip the record off its platter.
    const interval = setInterval(() => setVinylFrame(frame => (frame + 1) % vinylFrames.length), 400 / (braking ? 0.5 : speed));
    return () => clearInterval(interval);
  }, [playing, swapping, braking, speed]);
  function animateSwap() {
    setSwapping(false);
    requestAnimationFrame(() => setSwapping(true));
    clearTimeout(swapTimer.current);
    swapTimer.current = setTimeout(() => setSwapping(false), 760);
  }
  function changeSong(delta) {
    if (service !== 'youtube') return setControlsOpen(true);
    animateSwap();
    setProgress({ current: 0, duration: 0 });
    onStep(delta);
  }
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
    if (controlsOpen && service === 'youtube' && playing) youtube.current?.pause();
    setControlsOpen(open => !open);
  }
  function cycleSpeed() {
    const allowed = rates.filter(rate => rate >= 0.5 && rate <= 1.5);
    const choices = allowed.length ? allowed : [1];
    const index = choices.findIndex(rate => rate > speed + 0.01);
    const next = choices[index === -1 ? 0 : index];
    setSpeed(next);
    youtube.current?.setRate(next);
  }
  function touchDown(event) {
    if (!hasMedia || service === 'apple') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    touch.current = { x: event.clientX, start: progress.current, moved: false };
    if (service === 'youtube') {
      setControlsOpen(true);
      const slowest = rates.find(rate => rate >= 0.5) || 1;
      youtube.current?.setRate(slowest);
      setBraking(true);
    }
  }
  function touchMove(event) {
    if (!touch.current || !progress.duration) return;
    const distance = event.clientX - touch.current.x;
    if (Math.abs(distance) > 4) touch.current.moved = true;
    if (touch.current.moved) setScrubPreview(Math.max(0, Math.min(progress.duration, touch.current.start + distance * 0.45)));
  }
  function touchUp(event) {
    if (!touch.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const moved = touch.current.moved;
    touch.current = null;
    if (scrubPreview !== null) {
      if (service === 'spotify') spotify.current?.seek(scrubPreview);
      else youtube.current?.seek(scrubPreview);
      setProgress(p => ({ ...p, current: scrubPreview }));
    } else if (!moved) toggle();
    if (service === 'youtube') youtube.current?.setRate(speed);
    setScrubPreview(null);
    setBraking(false);
  }
  function touchCancel() {
    touch.current = null;
    if (service === 'youtube') youtube.current?.setRate(speed);
    setScrubPreview(null);
    setBraking(false);
  }
  return <div className="popout-backdrop mini-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="mini-dialog" role="dialog" aria-modal="true" aria-label="Surya vinyl player">
      <div className={`mini-vinyl service-${service} ${controlsOpen ? 'controls-open' : ''} ${swapping ? 'record-swapping' : ''}`}>
        <img className="mini-layer" src={assets.frame} alt="" />
        <img className="mini-record" src={assets.record} alt="" />
        <img className={`mini-record mini-disc ${braking ? 'braking' : ''}`} src={vinylFrames[vinylFrame]} alt="" />
        <img className={`mini-record mini-needle ${swapping ? 'lifted' : ''}`} src={assets.needle} alt="" />
        <img className="mini-layer mini-overlay" src={assets.overlay} alt="" />
        <img className="mini-layer mini-decoration" src={assets.plant} alt="" />
        <div className="mini-window-title">surya player</div>
        <img className="mini-layer mini-ui" src={assets.exit} alt="" />
        <button ref={closeButton} className="mini-close" aria-label="Close vinyl player" onClick={onClose} />
        <button className="mini-service-pill" onClick={toggleServiceControls} aria-expanded={controlsOpen}>{serviceName.toUpperCase()} {controlsOpen ? '⌃' : '⌄'}</button>
        {service === 'youtube' && <button className="mini-speed" onClick={cycleSpeed} aria-label={`Playback speed ${speed} times. Change speed`}>{speed}x speed</button>}
        {(service === 'youtube' || service === 'spotify' && progress.duration > 0) && <div className="mini-platter-touch" role="button" tabIndex={0} aria-label={service === 'youtube' ? 'Touch and hold the vinyl to slow playback; drag to scrub' : 'Drag the vinyl to scrub the song'} onPointerDown={touchDown} onPointerMove={touchMove} onPointerUp={touchUp} onPointerCancel={touchCancel} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } }} />}
        {scrubPreview !== null && <div className="mini-scrub-note">SCRUB {time(scrubPreview)}</div>}
        <div className="mini-artwork">{service === 'youtube' && track ? <img src={`https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`} alt="" /> : <span>♫</span>}</div>
        <img className="mini-layer mini-album-frame" src={assets.album} alt="" />
        <div className="mini-track"><span>now playing...</span><strong title={title}>{title || 'Your playlist'}</strong><small title={playlistName}>{service === 'youtube' ? playlistName : appleLibraryTrack?.artist || serviceName}</small></div>
        <img className="mini-layer mini-ui mini-transport-art" src={assets.previous} alt="" />
        <img className="mini-layer mini-ui mini-transport-art" src={playing ? assets.pause : assets.play} alt="" />
        <img className="mini-layer mini-ui mini-transport-art" src={assets.next} alt="" />
        <button className="mini-hit mini-prev" aria-label={service === 'youtube' ? 'Previous song' : `Open ${serviceName} previous song control`} onClick={() => changeSong(-1)} disabled={!hasMedia} />
        <button className="mini-hit mini-play" aria-label={service === 'youtube' || service === 'spotify' || appleLibraryTrack ? playing ? 'Pause music' : 'Play music' : `Open ${serviceName} playback controls`} onClick={toggle} disabled={!hasMedia} />
        <button className="mini-hit mini-next" aria-label={service === 'youtube' ? 'Next song' : `Open ${serviceName} next song control`} onClick={() => changeSong(1)} disabled={!hasMedia} />
        <img className="mini-layer mini-ui mini-progress-art" src={assets.progress} alt="" />
        {(service === 'youtube' && track || service === 'spotify' && progress.duration > 0) && <input className="mini-seek" aria-label="Seek in song" type="range" min="0" max={Math.max(progress.duration, 1)} value={Math.min(progress.current, progress.duration || 1)} onChange={seek} />}
        <div className="mini-times"><span>{service === 'youtube' || progress.duration ? time(progress.current) : ''}</span><span>{service === 'youtube' || progress.duration ? time(progress.duration) : ''}</span></div>
        {(service === 'youtube' || service === 'spotify' && progress.duration > 0) && <div className="mini-gesture-hint">{service === 'youtube' ? 'HOLD TO SLOW · DRAG TO SCRUB' : 'DRAG TO SCRUB'}</div>}
        <div className={`mini-service-drawer ${controlsOpen ? 'open' : ''}`} aria-hidden={!controlsOpen}>
        <div className="mini-drawer-head"><strong>{serviceName} playback</strong><button onClick={toggleServiceControls} aria-label="Hide service player">⌃</button></div>
        {service === 'youtube' && track && <YouTubePlayer ref={youtube} key={track.id} track={track} onEnded={() => changeSong(1)} onPlaying={onPlaying} onProgress={setProgress} onRatesReady={setRates} />}
        {service === 'spotify' && embedUrl && <SpotifyEmbed ref={spotify} embedUrl={embedUrl} onPlaying={onPlaying} onProgress={setProgress} onTrackChange={uri => { if (lastSpotifyTrack.current && uri && uri !== lastSpotifyTrack.current) animateSwap(); lastSpotifyTrack.current = uri; }} />}
        {service === 'apple' && embedUrl && <iframe title={`${playlistName} Apple Music player`} src={embedUrl} allow="encrypted-media; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />}
        {appleLibraryTrack && <p className="mini-drawer-note">Playing through your Apple Music library. Use the buttons on the vinyl player.</p>}
        {!hasMedia && <p className="mini-drawer-note">Add a song or choose a saved playlist first.</p>}
        </div>
      </div>
    </section>
  </div>;
}
