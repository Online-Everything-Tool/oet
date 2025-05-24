'use client';

import { useCallback } from 'react';
import useToolState from '../../_hooks/useToolState';
import { v4 as uuidv4 } from 'uuid';

export interface Song {
  id: string;
  title: string;
  artist: string;
  lyrics: string;
  chords: string;
  customMetadata: string; // User-defined key-value pairs, as a string (e.g., JSON)
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export type SongFormData = Pick<Song, 'title' | 'artist' | 'lyrics' | 'chords' | 'customMetadata'>;

interface SongbookToolState {
  songs: Song[];
  songbookAsJsonString: string;
}

const DEFAULT_SONGBOOK_STATE: SongbookToolState = {
  songs: [],
  songbookAsJsonString: '[]',
};

export default function useSongbookStorage(toolRoute: string) {
  const {
    state,
    setState: setRawToolState,
    saveStateNow,
    isLoadingState,
    isPersistent,
    togglePersistence,
    clearStateAndPersist: rawClearStateAndPersist,
    errorLoadingState,
  } = useToolState<SongbookToolState>(toolRoute, DEFAULT_SONGBOOK_STATE);

  const updateSongsAndPersist = useCallback((newSongs: Song[], updatedState?: Partial<SongbookToolState>) => {
    setRawToolState({
      songs: newSongs,
      songbookAsJsonString: JSON.stringify(newSongs),
      ...updatedState,
    });
  }, [setRawToolState]);

  const addSong = useCallback((data: SongFormData): Song => {
    const now = new Date().toISOString();
    const newSong: Song = {
      ...data,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    const newSongs = [...state.songs, newSong];
    updateSongsAndPersist(newSongs);
    return newSong;
  }, [state.songs, updateSongsAndPersist]);

  const updateSong = useCallback((id: string, data: Partial<SongFormData>): Song | undefined => {
    let updatedSong: Song | undefined;
    const newSongs = state.songs.map(song => {
      if (song.id === id) {
        updatedSong = {
          ...song,
          ...data,
          updatedAt: new Date().toISOString(),
        };
        return updatedSong;
      }
      return song;
    });
    if (updatedSong) {
      updateSongsAndPersist(newSongs);
    }
    return updatedSong;
  }, [state.songs, updateSongsAndPersist]);

  const deleteSong = useCallback((id: string): void => {
    const newSongs = state.songs.filter(song => song.id !== id);
    updateSongsAndPersist(newSongs);
  }, [state.songs, updateSongsAndPersist]);

  const getSongById = useCallback((id: string): Song | undefined => {
    return state.songs.find(song => song.id === id);
  }, [state.songs]);

  const getAllSongs = useCallback((): Song[] => {
    return state.songs;
  }, [state.songs]);

  const clearAllSongs = useCallback(async () => {
    // This will set songs to [] and songbookAsJsonString to '[]'
    // and persist it as non-temporary.
    await rawClearStateAndPersist();
  }, [rawClearStateAndPersist]);
  
  // Expose saveStateNow for ITDE pre-signal hook
  const ensureStateIsSaved = useCallback(async () => {
    await saveStateNow();
  }, [saveStateNow]);

  return {
    songs: state.songs,
    songbookAsJsonString: state.songbookAsJsonString,
    addSong,
    updateSong,
    deleteSong,
    getSongById,
    getAllSongs,
    clearAllSongs,
    isLoading: isLoadingState,
    isPersistent,
    togglePersistence,
    errorLoadingState,
    ensureStateIsSaved, // For ITDE
  };
}