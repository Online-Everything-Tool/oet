'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useSongbookStorage, { Song, SongFormData } from '../_hooks/useSongbookStorage';
import SongList from './SongList';
import SongEditor from './SongEditor';
import SongView from './SongView';
import Button from '../../_components/form/Button';
import SendToToolButton from '../../_components/shared/SendToToolButton';
import importedMetadata from '../metadata.json';
import type { ToolMetadata } from '@/src/types/tools';
import { ArrowPathIcon, SunIcon } from '@heroicons/react/24/outline';

interface SongbookStorageClientProps {
  toolRoute: string;
}

const metadata = importedMetadata as ToolMetadata;

export default function SongbookStorageClient({ toolRoute }: SongbookStorageClientProps) {
  const {
    songs,
    addSong,
    updateSong,
    deleteSong,
    getSongById,
    clearAllSongs,
    isLoading,
    ensureStateIsSaved,
    // songbookAsJsonString, // For ITDE, accessed via hook state
  } = useSongbookStorage(toolRoute);

  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [editingSongData, setEditingSongData] = useState<Song | null | 'new'>(null); // null: not editing, 'new': new song, Song: editing existing

  const currentViewSong = useMemo(() => {
    if (!selectedSongId) return null;
    return songs.find(s => s.id === selectedSongId) || null;
  }, [songs, selectedSongId]);

  // Auto-select first song if list is not empty and nothing is selected/editing
  useEffect(() => {
    if (!isLoading && songs.length > 0 && !selectedSongId && editingSongData === null) {
      setSelectedSongId(songs[0].id);
    } else if (!isLoading && songs.length === 0) {
      setSelectedSongId(null);
    }
  }, [songs, isLoading, selectedSongId, editingSongData]);

  const handleSelectSong = useCallback((id: string) => {
    setSelectedSongId(id);
    setEditingSongData(null); // Exit edit mode if any
  }, []);

  const handleInitiateAddSong = useCallback(() => {
    setSelectedSongId(null); // Deselect any current song
    setEditingSongData('new');
  }, []);

  const handleInitiateEditSong = useCallback((id: string) => {
    const songToEdit = getSongById(id);
    if (songToEdit) {
      setSelectedSongId(id); // Keep it selected or select it
      setEditingSongData(songToEdit);
    }
  }, [getSongById]);

  const handleSaveSong = useCallback((data: SongFormData, id?: string) => {
    let savedSong: Song;
    if (id) { // Editing existing song
      const updated = updateSong(id, data);
      if (!updated) return; // Should not happen if id is valid
      savedSong = updated;
    } else { // Adding new song
      savedSong = addSong(data);
    }
    setEditingSongData(null);
    setSelectedSongId(savedSong.id); // Select the newly added/edited song
  }, [addSong, updateSong]);

  const handleCancelEdit = useCallback(() => {
    setEditingSongData(null);
    // If a song was selected before starting 'new' edit, reselect it.
    // If editing an existing song, it remains selected.
    // If no song was selected and 'new' was cancelled, selectedSongId remains null.
    // This logic is implicitly handled by selectedSongId not changing unless explicitly set.
  }, []);

  const handleDeleteSong = useCallback((id: string) => {
    if (window.confirm('Are you sure you want to delete this song? This action cannot be undone.')) {
      deleteSong(id);
      if (selectedSongId === id) {
        setSelectedSongId(null); // Deselect if the deleted song was selected
      }
      if (typeof editingSongData === 'object' && editingSongData?.id === id) {
        setEditingSongData(null); // Exit edit mode if deleting the song being edited
      }
    }
  }, [deleteSong, selectedSongId, editingSongData]);
  
  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to delete ALL songs? This action cannot be undone.')) {
      await clearAllSongs();
      setSelectedSongId(null);
      setEditingSongData(null);
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10 text-[rgb(var(--color-text-muted))]">
        <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" />
        <span>Loading songbook...</span>
      </div>
    );
  }

  const songForEditor = editingSongData === 'new' ? null : editingSongData;

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0">
        <SongList
          songs={songs}
          selectedSongId={selectedSongId}
          onSelectSong={handleSelectSong}
          onDeleteSong={handleDeleteSong} // Can be triggered from list directly
          onInitiateEditSong={handleInitiateEditSong}
          onInitiateAddSong={handleInitiateAddSong}
        />
        <div className="mt-4 flex flex-col gap-2">
           <SendToToolButton
            currentToolDirective={metadata.directive}
            currentToolOutputConfig={metadata.outputConfig}
            onBeforeSignal={ensureStateIsSaved}
            buttonText="Export Songbook"
            className="w-full"
          />
          <Button
            variant="danger"
            onClick={handleClearAll}
            disabled={songs.length === 0}
            iconLeft={<SunIcon className="h-5 w-5" />}
            fullWidth
          >
            Clear All Songs
          </Button>
        </div>
      </div>

      <div className="flex-grow min-w-0">
        {editingSongData !== null ? (
          <SongEditor
            songToEdit={songForEditor}
            onSave={handleSaveSong}
            onCancel={handleCancelEdit}
          />
        ) : (
          <SongView
            song={currentViewSong}
            onEdit={handleInitiateEditSong} // From view, can trigger edit
            onDelete={handleDeleteSong} // From view, can trigger delete
          />
        )}
      </div>
    </div>
  );
}