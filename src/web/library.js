export const STORAGE_KEY = 'surya-player-web-v1';
const videoId = /^[\w-]{11}$/;
const starterTrack = { id: 'K4DyBUG242c', title: 'On & On · Cartoon, Jéja' };
export function parseYouTubeUrl(input) {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    let id;
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else if (/^\/(shorts|embed|live)\//.test(url.pathname)) id = url.pathname.split('/')[2];
    }
    return videoId.test(id || '') ? id : null;
  } catch { return null; }
}
export function parseServicePlaylist(input, service) {
  try {
    const url = new URL(input.trim());
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    if (service === 'spotify' && url.hostname === 'open.spotify.com') {
      const match = url.pathname.match(/^\/(?:intl-[a-z]+\/)?playlist\/([a-zA-Z0-9]{22})\/?$/);
      return match ? `https://open.spotify.com/embed/playlist/${match[1]}` : null;
    }
    if (service === 'apple' && url.hostname === 'music.apple.com') {
      const match = url.pathname.match(/^\/([a-z]{2})\/playlist\/([^/]+)\/(pl\.[\w-]+)\/?$/);
      return match ? `https://embed.music.apple.com/${match[1]}/playlist/${match[2]}/${match[3]}` : null;
    }
  } catch { /* Invalid link. */ }
  return null;
}
export function initialLibrary() {
  return { playlists: [{ id: 'starter', name: 'A little nostalgia', tracks: [
    starterTrack,
  ] }], bookmarks: [] };
}
export function validateLibrary(data) {
  if (!data || !Array.isArray(data.playlists) || !Array.isArray(data.bookmarks)) throw new Error('Invalid library');
  if (data.playlists.length > 100 || data.bookmarks.length > 100) throw new Error('Library is too large');
  const ids = new Set();
  for (const p of data.playlists) {
    if (typeof p.id !== 'string' || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80 || !Array.isArray(p.tracks) || p.tracks.length > 500) throw new Error('Invalid playlist');
    ids.add(p.id);
    const tracks = new Set();
    for (const t of p.tracks) {
      if (!videoId.test(t.id) || tracks.has(t.id) || typeof t.title !== 'string' || t.title.length > 200) throw new Error('Invalid track');
      tracks.add(t.id);
    }
  }
  for (const b of data.bookmarks) {
    if (typeof b.id !== 'string' || typeof b.name !== 'string' || b.name.length > 80 || !parseServicePlaylist(b.url, b.service)) throw new Error('Invalid saved playlist');
  }
  return data;
}
export function readLibrary(storage = localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return initialLibrary();
  const library = validateLibrary(JSON.parse(raw));
  const starter = library.playlists.find(p => p.id === 'starter');
  if (starter) {
    const legacy = new Set(['jfKfPfyJRdk', '4xDzrJKXOOY']);
    const oldTracks = starter.tracks.filter(t =>
      (legacy.has(t.id) && t.title.startsWith('Lofi Girl · ')) ||
      (t.id === 'dQw4w9WgXcQ' && t.title === 'Never Gonna Give You Up · Rick Astley'));
    if (oldTracks.length) {
      starter.tracks = starter.tracks.filter(t => !oldTracks.includes(t));
      if (!starter.tracks.some(t => t.id === starterTrack.id)) starter.tracks.unshift(starterTrack);
      if (starter.name === 'Late-night rotation') starter.name = 'A little nostalgia';
    }
  }
  return library;
}
export function addTracks(playlist, input, title = '') {
  const lines = input.trim().split(/\s+/).filter(Boolean);
  if (!lines.length) throw new Error('Paste a YouTube video link first.');
  const ids = lines.map(parseYouTubeUrl);
  if (ids.some(id => !id)) throw new Error('Use YouTube video links (watch, youtu.be, Shorts or live). Playlist-only links cannot be added as songs.');
  const existing = new Set(playlist.tracks.map(t => t.id));
  const additions = [...new Set(ids)].filter(id => !existing.has(id));
  if (!additions.length) throw new Error('Those videos are already in this playlist.');
  if (playlist.tracks.length + additions.length > 500) throw new Error('A playlist can hold up to 500 videos.');
  return { ...playlist, tracks: [...playlist.tracks, ...additions.map(id => ({ id, title: lines.length === 1 && title.trim() ? title.trim().slice(0, 200) : `YouTube · ${id}` }))] };
}
