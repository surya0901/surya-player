const clientId = import.meta.env.VITE_YOUTUBE_CLIENT_ID;
export const youtubeConfigured = !!clientId && !clientId.startsWith('your_');
const key = 'surya-youtube-session';

let gisPromise;
function loadGIS() {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (!gisPromise) gisPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { gisPromise = null; reject(new Error('Google sign-in could not load.')); }, 15000);
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => { clearTimeout(timeout); resolve(window.google); };
    script.onerror = () => { clearTimeout(timeout); gisPromise = null; reject(new Error('Google sign-in could not load.')); };
    document.head.appendChild(script);
  });
  return gisPromise;
}

export function youtubeConnected() {
  const stored = JSON.parse(sessionStorage.getItem(key) || 'null');
  return !!stored && stored.expires > Date.now();
}
export function disconnectYouTube() { sessionStorage.removeItem(key); }

// Uses Google Identity Services' token model: a short-lived (~1hr) access
// token obtained directly in the browser, no client secret and no backend.
// It never issues a refresh token by design, so the visitor reconnects
// after it expires — that's fine for a single browsing session.
export async function connectYouTube() {
  if (!youtubeConfigured) throw new Error('YouTube account connection is not configured. You can still add a public playlist link.');
  const google = await loadGIS();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
      callback: response => {
        if (response.error) return reject(new Error(response.error === 'access_denied' ? 'YouTube sign-in was cancelled.' : 'YouTube sign-in failed.'));
        sessionStorage.setItem(key, JSON.stringify({ access_token: response.access_token, expires: Date.now() + (response.expires_in || 3500) * 1000 }));
        resolve(true);
      },
      error_callback: () => reject(new Error('YouTube sign-in failed.')),
    });
    client.requestAccessToken();
  });
}

function getAccessToken() {
  const stored = JSON.parse(sessionStorage.getItem(key) || 'null');
  if (!stored || stored.expires <= Date.now()) throw new Error('Your YouTube session expired. Please connect again.');
  return stored.access_token;
}
async function apiGet(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
  if (res.status === 401) { disconnectYouTube(); throw new Error('YouTube session expired. Please connect again.'); }
  if (res.status === 403) throw new Error('YouTube API quota was hit, or access is restricted for this account. Please try again later.');
  if (!res.ok) throw new Error('Could not reach YouTube. Please try again.');
  return res.json();
}

export async function youtubePlaylists() {
  const playlists = [];
  let url = 'https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50';
  while (url) {
    const data = await apiGet(url);
    playlists.push(...data.items.map(p => ({ id: p.id, name: p.snippet.title })));
    url = data.nextPageToken ? `https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50&pageToken=${data.nextPageToken}` : null;
  }
  return playlists;
}
export async function youtubePlaylistTracks(playlistId) {
  const tracks = [];
  let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50`;
  while (url) {
    const data = await apiGet(url);
    tracks.push(...data.items.filter(item => item.snippet?.resourceId?.videoId).map(item => ({ id: item.snippet.resourceId.videoId, title: item.snippet.title })));
    url = data.nextPageToken ? `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${data.nextPageToken}` : null;
  }
  return tracks;
}
