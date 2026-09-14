import { describe, it, expect } from 'vitest';
import { parseYouTubeUrl, parseServicePlaylist, addTracks, initialLibrary, validateLibrary } from './library.js';

describe('browser playlist links', () => {
  it('accepts supported YouTube video links and rejects other hosts and playlist-only links', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk&list=abc')).toBe('jfKfPfyJRdk');
    expect(parseYouTubeUrl('https://youtu.be/jfKfPfyJRdk?t=3')).toBe('jfKfPfyJRdk');
    expect(parseYouTubeUrl('https://youtube.com/shorts/jfKfPfyJRdk')).toBe('jfKfPfyJRdk');
    expect(parseYouTubeUrl('https://youtube.com/playlist?list=abc')).toBeNull();
    expect(parseYouTubeUrl('https://youtube.com.evil.test/watch?v=jfKfPfyJRdk')).toBeNull();
  });
  it('deduplicates a batch of videos and preserves the existing playlist', () => {
    const playlist = initialLibrary().playlists[0];
    const next = addTracks(playlist, 'https://youtu.be/jfKfPfyJRdk\nhttps://youtu.be/5qap5aO4i9A');
    expect(next.tracks).toHaveLength(3);
    expect(playlist.tracks).toHaveLength(2);
    expect(() => addTracks(next, 'https://youtu.be/jfKfPfyJRdk')).toThrow(/already/);
  });
  it('accepts only official Spotify and Apple Music playlist URLs', () => {
    expect(parseServicePlaylist('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=x', 'spotify')).toContain('/embed/playlist/');
    expect(parseServicePlaylist('https://music.apple.com/us/playlist/favorites-mix/pl.123abc', 'apple')).toContain('embed.music.apple.com');
    expect(parseServicePlaylist('https://evil.test/playlist/37i9dQZF1DXcBWIGoYBM5M', 'spotify')).toBeNull();
  });
  it('rejects damaged saved libraries', () => {
    expect(() => validateLibrary({ playlists: [{ id: 'x', name: 'a', tracks: [{ id: '<script>', title: 'bad' }] }], bookmarks: [] })).toThrow();
  });
});
