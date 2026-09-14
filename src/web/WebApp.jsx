import { useEffect, useMemo, useState } from 'react';
import PopoutPlayer from './PopoutPlayer.jsx';
import { STORAGE_KEY, addTracks, initialLibrary, parseServicePlaylist, readLibrary } from './library.js';
import { connectSpotify, disconnectSpotify, finishSpotifyLogin, spotifyConfigured, spotifyConnected, spotifyPlaylists, spotifyPlaylistTracks } from './spotify.js';
import { connectYouTube, disconnectYouTube, youtubeConfigured, youtubeConnected, youtubePlaylists, youtubePlaylistTracks } from './youtube.js';
import { login as appleLogin, logout as appleLogout, initMusicKit, getMusicKit } from '../apple/auth.js';
import { fetchMyPlaylists as applePlaylists, fetchPlaylistTracks as appleTracks } from '../apple/api.js';
import blueScene from '../../assets/blue/frame.png';
import blueRecord from '../../assets/blue/record_player.png';
import blueVinyl from '../../assets/animations/record-blue/frame-1.png';
import blueNeedle from '../../assets/animations/blue/needle-playing/frame-1.png';
import './web.css';

const services = [
  { id: 'youtube', label: 'YouTube', icon: '▶', desc: 'Build playlists from video links' },
  { id: 'spotify', label: 'Spotify', icon: '◉', desc: 'Bring a public or connected playlist' },
  { id: 'apple', label: 'Apple Music', icon: '♫', desc: 'Play a shared or library playlist' },
];
const appleConfigured = !!import.meta.env.VITE_APPLE_MUSIC_DEVELOPER_TOKEN;
const clean = value => value.trim().slice(0, 80);
function safeRead() {
  try { return { library: readLibrary(), error: '' }; }
  catch { return { library: initialLibrary(), error: 'Your saved library could not be read. A fresh demo playlist is shown.' }; }
}

export default function WebApp() {
  const initial = useMemo(safeRead, []);
  const [library, setLibrary] = useState(initial.library);
  const [service, setService] = useState('youtube');
  const [selectedId, setSelectedId] = useState(library.playlists[0]?.id || null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [activeAppleTrack, setActiveAppleTrack] = useState(null);
  const [newName, setNewName] = useState('');
  const [videoInput, setVideoInput] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [bookmarkName, setBookmarkName] = useState('');
  const [bookmarkUrl, setBookmarkUrl] = useState('');
  const [activeBookmark, setActiveBookmark] = useState(null);
  const [connectedPlaylists, setConnectedPlaylists] = useState([]);
  const [spotifyReady, setSpotifyReady] = useState(spotifyConnected());
  const [youtubeReady, setYoutubeReady] = useState(youtubeConnected());
  const [appleReady, setAppleReady] = useState(false);
  const [appleLibraryTracks, setAppleLibraryTracks] = useState([]);
  const [appleLibraryName, setAppleLibraryName] = useState('');
  const [spotifyLibraryTracks, setSpotifyLibraryTracks] = useState([]);
  const [spotifyLibraryName, setSpotifyLibraryName] = useState('');
  const [spotifyLibraryUrl, setSpotifyLibraryUrl] = useState('');
  const [spotifyTrackIndex, setSpotifyTrackIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(initial.error);
  const playlist = library.playlists.find(p => p.id === selectedId) || library.playlists[0];
  const current = playlist?.tracks[trackIndex];
  const currentSpotifyTrack = spotifyLibraryTracks[spotifyTrackIndex];
  const visibleBookmarks = library.bookmarks.filter(b => b.service === service);
  const selectedEmbed = activeBookmark && parseServicePlaylist(activeBookmark.url, service);
  const queue = service === 'youtube' && playlist?.tracks.length
    ? playlist.tracks.map((t, i) => ({ key: t.id, title: t.title, active: i === trackIndex, onSelect: () => { setTrackIndex(i); setPlaying(true); } }))
    : service === 'spotify' && spotifyLibraryTracks.length
    ? spotifyLibraryTracks.map((t, i) => ({ key: t.uri, title: t.title, subtitle: t.artist, active: i === spotifyTrackIndex, onSelect: () => { setSpotifyTrackIndex(i); setPlaying(true); } }))
    : service === 'apple' && appleLibraryTracks.length
    ? appleLibraryTracks.map((t, i) => ({ key: t.uri || i, title: t.title, subtitle: t.artist, active: activeAppleTrack?.uri === t.uri, onSelect: () => playAppleTrack(t) }))
    : null;

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(library)); } catch { setNotice('Browser storage is full; new changes may not persist.'); } }, [library]);
  useEffect(() => {
    finishSpotifyLogin().then(ok => {
      if (ok) { setSpotifyReady(true); setService('spotify'); setNotice('Spotify connected. Choose one of your playlists below.'); }
    }).catch(err => { setService('spotify'); setNotice(err.message); });
  }, []);
  useEffect(() => {
    if (service === 'spotify' && spotifyReady) refreshSpotify();
  }, [service, spotifyReady]);
  useEffect(() => {
    if (service === 'youtube' && youtubeReady) refreshYouTube();
  }, [service, youtubeReady]);

  function updatePlaylist(next) { setLibrary(prev => ({ ...prev, playlists: prev.playlists.map(p => p.id === next.id ? next : p) })); }
  function createPlaylist(event) {
    event.preventDefault();
    const name = clean(newName);
    if (!name) return setNotice('Give your playlist a name.');
    if (library.playlists.length >= 100) return setNotice('The library can hold up to 100 playlists.');
    const id = crypto.randomUUID();
    setLibrary(prev => ({ ...prev, playlists: [...prev.playlists, { id, name, tracks: [] }] }));
    setSelectedId(id); setTrackIndex(0); setNewName(''); setNotice(`Created “${name}”. Add a YouTube link below.`);
  }
  function addVideo(event) {
    event.preventDefault();
    if (!playlist) return setNotice('Create a playlist first.');
    try {
      const next = addTracks(playlist, videoInput, videoTitle);
      updatePlaylist(next); setTrackIndex(playlist.tracks.length); setPlayerOpen(true); setVideoInput(''); setVideoTitle(''); setNotice(`Added ${next.tracks.length - playlist.tracks.length} video${next.tracks.length - playlist.tracks.length === 1 ? '' : 's'} to “${playlist.name}”.`);
    } catch (err) { setNotice(err.message); }
  }
  function removePlaylist() {
    if (!playlist || playlist.id === 'starter' && library.playlists.length === 1) return setNotice('Create another playlist before removing the last one.');
    const remaining = library.playlists.filter(p => p.id !== playlist.id);
    setLibrary(prev => ({ ...prev, playlists: remaining })); setSelectedId(remaining[0]?.id || null); setTrackIndex(0); setNotice('Playlist removed.');
  }
  function removeTrack(index) {
    if (!playlist) return;
    updatePlaylist({ ...playlist, tracks: playlist.tracks.filter((_, i) => i !== index) });
    setTrackIndex(i => Math.max(0, Math.min(i, playlist.tracks.length - 2))); setNotice('Video removed.');
  }
  function choosePlaylist(id) { setSelectedId(id); setTrackIndex(0); setPlayerOpen(true); setNotice(''); }
  function step(delta) {
    if (service === 'youtube' && playlist?.tracks.length) return setTrackIndex(i => (i + delta + playlist.tracks.length) % playlist.tracks.length);
    if (service === 'spotify' && spotifyLibraryTracks.length) return setSpotifyTrackIndex(i => (i + delta + spotifyLibraryTracks.length) % spotifyLibraryTracks.length);
  }
  function saveBookmark(event) {
    event.preventDefault();
    const url = bookmarkUrl.trim();
    if (!parseServicePlaylist(url, service)) return setNotice(`Paste a valid ${service === 'apple' ? 'Apple Music' : 'Spotify'} playlist link.`);
    if (library.bookmarks.some(b => b.url === url)) return setNotice('This playlist is already saved.');
    const item = { id: crypto.randomUUID(), service, name: clean(bookmarkName) || `Shared ${service === 'apple' ? 'Apple Music' : 'Spotify'} playlist`, url };
    setLibrary(prev => ({ ...prev, bookmarks: [...prev.bookmarks, item] }));
    setActiveBookmark(item); setPlayerOpen(true); setBookmarkName(''); setBookmarkUrl(''); setNotice('Playlist saved in this browser.');
  }
  async function refreshSpotify() {
    setBusy(true);
    try { setConnectedPlaylists(await spotifyPlaylists()); setNotice(''); }
    catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }
  async function refreshYouTube() {
    setBusy(true);
    try { setConnectedPlaylists(await youtubePlaylists()); setNotice(''); }
    catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }
  async function chooseYouTubePlaylist(item) {
    setBusy(true);
    try {
      const tracks = await youtubePlaylistTracks(item.id);
      const id = `yt-${item.id}`;
      const imported = { id, name: item.name, tracks };
      setLibrary(prev => ({ ...prev, playlists: [...prev.playlists.filter(p => p.id !== id), imported] }));
      setSelectedId(id); setTrackIndex(0); setPlayerOpen(true);
      setNotice(tracks.length ? `Imported “${item.name}” from your YouTube account.` : 'This playlist has no playable videos.');
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }
  async function chooseSpotifyPlaylist(item) {
    setBusy(true);
    try {
      const tracks = await spotifyPlaylistTracks(item.id);
      setSpotifyLibraryTracks(tracks); setSpotifyLibraryName(item.name); setSpotifyLibraryUrl(item.url); setSpotifyTrackIndex(0);
      setActiveBookmark(null); setPlayerOpen(true);
      setNotice(tracks.length ? 'Choose a song below or press play.' : 'This playlist has no playable tracks.');
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }
  async function connectApple() {
    if (!appleConfigured) return setNotice('Apple Music library connection needs a MusicKit developer token. Shared playlist links work now.');
    setBusy(true);
    try {
      await initMusicKit(); await appleLogin(); setAppleReady(true);
      const items = await applePlaylists();
      setConnectedPlaylists(items);
      setNotice('Apple Music connected. Library playlists are shown below.');
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }
  async function chooseAppleLibrary(item) {
    setBusy(true);
    try { setAppleLibraryTracks(await appleTracks(item.id)); setAppleLibraryName(item.name); setActiveBookmark(null); setNotice('Choose a song below to play it with Apple Music.'); }
    catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }
  async function playAppleTrack(track) {
    if (!track.catalogId) return setNotice('Apple Music cannot play this library-only track on the web.');
    try { await getMusicKit().setQueue({ song: track.catalogId, startPlaying: true }); await getMusicKit().play(); setActiveAppleTrack(track); setPlayerOpen(true); setPlaying(true); setNotice(`Playing “${track.title}” with Apple Music.`); }
    catch (err) { setNotice(err.message); }
  }
  function closePlayer() {
    setPlayerOpen(false); setPlaying(false);
    if (service === 'apple' && activeAppleTrack) getMusicKit()?.pause().catch(() => {});
  }
  function switchService(id) { closePlayer(); setService(id); setActiveBookmark(null); setActiveAppleTrack(null); setConnectedPlaylists([]); setSpotifyLibraryTracks([]); setSpotifyLibraryName(''); setNotice(''); }
  return <div className="web-app blue">
    <header className="site-header"><a className="brand" href="./" aria-label="Surya Player home"><span>✳</span> surya<span className="brand-accent">player</span></a><div className="header-right"><span className="live-dot" /> interactive music demo <a className="github-link" href="https://github.com/surya0901/surya-player" target="_blank" rel="noreferrer">View code ↗</a></div></header>
    <main className="workspace">
      <section className="intro"><div className="eyebrow">A LITTLE MUSIC CORNER · BY SURYA</div><h1>Your playlists,<br/><em>your kind of player.</em></h1><p>Bring your favorite playlist to a turntable you can touch. Swap records, drag the vinyl to scrub, and slow down a YouTube song with your hand.</p><div className="feature-tags"><span>✦ Drag to scrub</span><span>✦ Hold to slow</span><span>✦ Watch records swap</span></div></section>
      <div className="workspace-grid">
        <div className="left-column">
          <div className="service-heading"><span className="step-number">01</span><div><h2>Choose your music</h2><p>Three ways to make this space yours</p></div></div>
          <div className="service-tabs" role="tablist" aria-label="Music service">{services.map(s => <button key={s.id} role="tab" aria-selected={service === s.id} className={`service-card ${service === s.id ? 'selected' : ''}`} onClick={() => switchService(s.id)}><span className="service-icon">{s.icon}</span><span className="service-text"><strong>{s.label}</strong><small>{s.desc}</small></span><span className="service-arrow">↗</span></button>)}</div>
          <section className="library-card">
            {service === 'youtube' ? <>
              <div className="card-top"><div><span className="step-number">02</span><h2>Make a playlist</h2></div><span className="chip">SAVED IN YOUR BROWSER</span></div>
              <form className="create-row" onSubmit={createPlaylist}><label className="sr-only" htmlFor="new-playlist">New playlist name</label><input id="new-playlist" placeholder="Name your next playlist..." value={newName} onChange={e => setNewName(e.target.value)} maxLength={80}/><button className="solid-button">+ Create</button></form>
              <div className="connect-row"><div><strong>Connect your YouTube account</strong><small>{youtubeConfigured ? 'Browse and import your own playlists' : 'Developer setup needed for account sign-in'}</small></div>{youtubeReady ? <button className="outline-button" onClick={() => { disconnectYouTube(); setYoutubeReady(false); setConnectedPlaylists([]); }}>Disconnect</button> : <button className="outline-button" onClick={() => connectYouTube().then(() => setYoutubeReady(true)).catch(err => setNotice(err.message))} disabled={!youtubeConfigured}>Connect</button>}</div>
              {youtubeReady && <div className="connected-list"><div className="section-line"><strong>Your YouTube playlists</strong><button onClick={refreshYouTube} disabled={busy}>{busy ? 'Loading…' : 'Refresh'}</button></div>{connectedPlaylists.length ? connectedPlaylists.map(p => <button key={p.id} className="connected-item" onClick={() => chooseYouTubePlaylist(p)}>{p.name}<span>↗</span></button>) : <p className="empty-state">No playlists found yet.</p>}</div>}
              <div className="playlist-pills" aria-label="Your playlists">{library.playlists.map(p => <button key={p.id} className={`playlist-pill ${playlist?.id === p.id ? 'active' : ''}`} onClick={() => choosePlaylist(p.id)}>{p.name} <span>{p.tracks.length}</span></button>)}</div>
              {playlist && <div className="playlist-editor"><div className="editor-heading"><div><span className="micro-label">NOW EDITING</span><h3>{playlist.name}</h3></div><button className="text-danger" onClick={removePlaylist}>Remove playlist</button></div>
                <form onSubmit={addVideo} className="add-form"><label htmlFor="video-links">Add a YouTube video link</label><textarea id="video-links" placeholder={'https://www.youtube.com/watch?v=...\nPaste several links, one per line'} value={videoInput} onChange={e => setVideoInput(e.target.value)} rows={2}/><div className="form-tail"><input aria-label="Video title (optional, for one link)" placeholder="Title (optional for one link)" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} maxLength={200}/><button className="solid-button">Add to playlist</button></div></form>
                <div className="track-list">{playlist.tracks.length ? playlist.tracks.map((t, i) => <div key={t.id} className={`track-row ${trackIndex === i ? 'current' : ''}`}><button className="track-select" onClick={() => { setTrackIndex(i); setPlayerOpen(true); }} aria-label={`Open player for ${t.title}`}><span className="track-index">{String(i + 1).padStart(2, '0')}</span><span className="track-title">{t.title}</span></button><button className="remove-track" onClick={() => removeTrack(i)} aria-label={`Remove ${t.title}`}>×</button></div>) : <p className="empty-state">Your playlist is empty. Paste a video link to start the mix.</p>}</div>
              </div>}
            </> : <>
              <div className="card-top"><div><span className="step-number">02</span><h2>Bring a playlist</h2></div><span className="chip">{service === 'spotify' ? 'SPOTIFY' : 'APPLE MUSIC'}</span></div>
              <p className="card-copy">Paste a shared playlist link for a playable preview. You can also connect your account to browse your own playlists when this demo has developer access.</p>
              <form className="bookmark-form" onSubmit={saveBookmark}><label htmlFor="playlist-url">Playlist link</label><input id="playlist-url" type="url" placeholder={service === 'spotify' ? 'https://open.spotify.com/playlist/...' : 'https://music.apple.com/us/playlist/...'} value={bookmarkUrl} onChange={e => setBookmarkUrl(e.target.value)}/><div className="form-tail"><input aria-label="Playlist name (optional)" placeholder="Give it a name (optional)" value={bookmarkName} onChange={e => setBookmarkName(e.target.value)} maxLength={80}/><button className="solid-button">Add playlist</button></div></form>
              <div className="connect-row"><div><strong>Connect your {service === 'spotify' ? 'Spotify' : 'Apple Music'} library</strong><small>{service === 'spotify' ? spotifyConfigured ? 'Full playback needs your account to have Premium' : 'Developer setup needed for account sign-in' : appleConfigured ? 'Full playback needs an active Apple Music subscription' : 'MusicKit developer setup needed'}</small></div>{service === 'spotify' ? spotifyReady ? <button className="outline-button" onClick={() => { disconnectSpotify(); setSpotifyReady(false); setConnectedPlaylists([]); setSpotifyLibraryTracks([]); setSpotifyLibraryName(''); }}>Disconnect</button> : <button className="outline-button" onClick={() => connectSpotify().catch(err => setNotice(err.message))} disabled={!spotifyConfigured}>Connect</button> : appleReady ? <button className="outline-button" onClick={async () => { await appleLogout(); setAppleReady(false); setConnectedPlaylists([]); setAppleLibraryTracks([]); setAppleLibraryName(''); }}>Disconnect</button> : <button className="outline-button" disabled={!appleConfigured || busy} onClick={connectApple}>Connect</button>}</div>
              {(spotifyReady || appleReady) && <div className="connected-list"><div className="section-line"><strong>Your library</strong><button onClick={service === 'spotify' ? refreshSpotify : connectApple} disabled={busy}>{busy ? 'Loading…' : 'Refresh'}</button></div>{connectedPlaylists.length ? connectedPlaylists.map(p => <button key={p.id} className="connected-item" onClick={() => service === 'apple' ? chooseAppleLibrary(p) : chooseSpotifyPlaylist(p)}>{p.name}<span>↗</span></button>) : <p className="empty-state">No playlists found yet.</p>}</div>}
              {service === 'apple' && appleLibraryName && <div className="connected-list"><span className="micro-label">{appleLibraryName}</span>{appleLibraryTracks.map((track, index) => <button key={track.uri || index} className="connected-item" onClick={() => playAppleTrack(track)}>{track.title} · {track.artist}<span>▶</span></button>)}</div>}
              <div className="saved-list"><span className="micro-label">SAVED PLAYLISTS</span>{visibleBookmarks.length ? visibleBookmarks.map(b => <div key={b.id} className="saved-row"><button onClick={() => { setActiveBookmark(b); setPlayerOpen(true); }} className={activeBookmark?.id === b.id ? 'active' : ''}>{b.name}</button><button aria-label={`Remove ${b.name}`} onClick={() => { setLibrary(prev => ({ ...prev, bookmarks: prev.bookmarks.filter(x => x.id !== b.id) })); if (activeBookmark?.id === b.id) setActiveBookmark(null); }}>×</button></div>) : <p className="empty-state">Your saved playlists will appear here.</p>}</div>
            </>}
            {notice && <p className="status-notice" role="status">{notice}</p>}
          </section>
        </div>
        <aside className="player-column"><div className="player-heading"><span className="step-number">03</span><div><h2>Press play</h2><p>A tiny record shop on your screen</p></div></div>
          <div className="player-shell"><div className="pixel-window" style={{ backgroundImage: `url(${blueScene})` }}><div className="pixel-title">surya player <span>✧</span></div><img className="record-base" src={blueRecord} alt=""/><img className={`record-vinyl ${playing ? 'spinning' : ''}`} src={blueVinyl} alt=""/><img className="record-needle" src={blueNeedle} alt=""/></div>
            <div className="player-meta"><span className="micro-label">NOW PLAYING · {service.toUpperCase()}</span><strong>{service === 'youtube' ? current?.title || 'Your next favorite song' : service === 'spotify' && currentSpotifyTrack ? currentSpotifyTrack.title : activeBookmark?.name || 'Choose a playlist'}</strong><span>{service === 'youtube' ? playlist?.name || 'Your playlist' : service === 'spotify' ? spotifyLibraryName || 'Spotify playlist' : 'Apple Music playlist'}</span></div>
            <button type="button" className="open-player-button" onClick={() => setPlayerOpen(true)} aria-label="Open vinyl player">↗ &nbsp; Open vinyl player</button>
          </div>
          <p className="small-print">Open the vinyl player to control playback. Tap the service badge on the player to show Spotify, Apple Music, or YouTube media controls.</p>
        </aside>
      </div>
    </main>{playerOpen && <PopoutPlayer service={service} track={current} spotifyTrack={currentSpotifyTrack} playlistName={service === 'youtube' ? playlist?.name : service === 'spotify' && spotifyLibraryTracks.length ? spotifyLibraryName : activeBookmark?.name || appleLibraryName} embedUrl={selectedEmbed} externalUrl={service === 'spotify' && spotifyLibraryTracks.length ? spotifyLibraryUrl : activeBookmark?.url} appleLibraryTrack={activeAppleTrack} playing={playing} onPlaying={setPlaying} onClose={closePlayer} onStep={step} queue={queue} />}<footer className="site-footer"><span>Made with ☾ and a lot of music.</span><span>Surya Player · 2026</span></footer>
  </div>;
}
