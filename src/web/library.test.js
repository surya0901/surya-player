import { describe, it, expect } from 'vitest';
import { parseYouTubeUrl, parseServicePlaylist, addTracks, initialLibrary, readLibrary, validateLibrary } from './library.js';

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
    const next = addTracks(playlist, 'https://youtu.be/K4DyBUG242c\nhttps://youtu.be/jNQXAC9IVRw');
    expect(next.tracks).toHaveLength(2);
    expect(playlist.tracks).toHaveLength(1);
    expect(() => addTracks(next, 'https://youtu.be/K4DyBUG242c')).toThrow(/already/);
  });
  it('replaces the unavailable starter video without removing videos people added', () => {
    const saved = { playlists: [{ id: 'starter', name: 'A little nostalgia', tracks: [
      { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up · Rick Astley' },
      { id: 'jNQXAC9IVRw', title: 'My saved video' },
    ] }], bookmarks: [] };
    const library = readLibrary({ getItem: () => JSON.stringify(saved) });
    expect(library.playlists[0].tracks.map(track => track.id)).toEqual(['K4DyBUG242c', 'jNQXAC9IVRw']);
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
