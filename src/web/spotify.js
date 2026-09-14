const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
export const spotifyConfigured = !!clientId && !clientId.startsWith('your_');
const redirect = new URL(import.meta.env.BASE_URL, window.location.origin).href;
const key = 'surya-spotify-session';
const flowKey = 'surya-spotify-oauth';
const encode = buffer => btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function spotifyConnected() { return !!sessionStorage.getItem(key); }
export function disconnectSpotify() { sessionStorage.removeItem(key); sessionStorage.removeItem(flowKey); }
export async function connectSpotify() {
  if (!spotifyConfigured) throw new Error('Spotify account connection is not configured. You can still add a public playlist link.');
  const verifier = encode(crypto.getRandomValues(new Uint8Array(48)));
  const state = encode(crypto.getRandomValues(new Uint8Array(24)));
  const challenge = encode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  sessionStorage.setItem(flowKey, JSON.stringify({ verifier, state, created: Date.now() }));
  const params = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirect, scope: 'streaming user-read-email user-read-private playlist-read-private playlist-read-collaborative', code_challenge_method: 'S256', code_challenge: challenge, state });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}
async function exchange(body) {
  const res = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, ...body }) });
  if (!res.ok) { disconnectSpotify(); throw new Error('Spotify authorization expired or was rejected. Please connect again.'); }
  const data = await res.json();
  sessionStorage.setItem(key, JSON.stringify({ ...data, refresh_token: data.refresh_token || body.refresh_token, expires: Date.now() + data.expires_in * 1000 }));
  return data.access_token;
}
let callback;
export function finishSpotifyLogin() {
  if (callback) return callback;
  const params = new URLSearchParams(location.search);
  if (!params.has('code') && !params.has('error')) return Promise.resolve(false);
  callback = (async () => {
    try {
      const flow = JSON.parse(sessionStorage.getItem(flowKey) || 'null');
      if (!flow || flow.state !== params.get('state') || Date.now() - flow.created > 600000) throw new Error('Sign-in could not be verified. Please connect Spotify again.');
      if (params.has('error')) throw new Error('Spotify sign-in was cancelled. You can use a public playlist link instead.');
      await exchange({ grant_type: 'authorization_code', code: params.get('code'), redirect_uri: redirect, code_verifier: flow.verifier });
      return true;
    } finally {
      sessionStorage.removeItem(flowKey);
      history.replaceState({}, '', redirect);
    }
  })();
  return callback;
}
export async function getAccessToken() {
  const stored = JSON.parse(sessionStorage.getItem(key) || 'null');
  if (!stored) throw new Error('Connect Spotify first.');
  return stored.expires > Date.now() + 60000 ? stored.access_token : await exchange({ grant_type: 'refresh_token', refresh_token: stored.refresh_token });
}
async function apiGet(url) {
  const token = await getAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 403) throw new Error('Spotify has restricted this account. The app owner must allow access in the Spotify dashboard. Public playlist links still work.');
  if (res.status === 401) { disconnectSpotify(); throw new Error('Spotify session expired. Please connect again.'); }
  if (res.status === 429) throw new Error('Spotify is receiving too many requests. Please try again later.');
  if (!res.ok) throw new Error('Could not reach Spotify. Please try again.');
  return res.json();
}
export async function spotifyPlaylists() {
  const playlists = [];
  let url = 'https://api.spotify.com/v1/me/playlists?limit=50';
  while (url) {
    if (!url.startsWith('https://api.spotify.com/v1/')) throw new Error('Unexpected Spotify pagination URL.');
    const data = await apiGet(url);
    playlists.push(...data.items.filter(Boolean).map(p => ({ id: p.id, name: p.name, url: `https://open.spotify.com/playlist/${p.id}` })));
    url = data.next;
  }
  return playlists;
}
export async function spotifyPlaylistTracks(playlistId) {
  const tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
  while (url) {
    if (!url.startsWith('https://api.spotify.com/v1/')) throw new Error('Unexpected Spotify pagination URL.');
    const data = await apiGet(url);
    tracks.push(...data.items.filter(item => item?.track?.uri).map(item => ({
      uri: item.track.uri,
      title: item.track.name,
      artist: item.track.artists?.map(a => a.name).join(', '),
      art: item.track.album?.images?.[item.track.album.images.length - 1]?.url,
    })));
    url = data.next;
  }
  return tracks;
}
