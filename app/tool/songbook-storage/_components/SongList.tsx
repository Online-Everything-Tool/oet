'use client';

import React from 'react';
import type { Song } from '../_hooks/useSongbookStorage';
import Button from '../../_components/form/Button';
import { PencilSquareIcon, TrashIcon, PlusCircleIcon } from '@heroicons/react/24/outline';

interface SongListProps {
  songs: Song[];
  selectedSongId: string | null;
  onSelectSong: (id: string) => void;
  onDeleteSong: (id: string) => void;
  onInitiateEditSong: (id: string) => void;
  onInitiateAddSong: () => void;
}

export default function SongList({
  songs,
  selectedSongId,
  onSelectSong,
  onDeleteSong,
  onInitiateEditSong,
  onInitiateAddSong,
}: SongListProps) {
  return (
    <div className="border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
      <div className="p-3 border-b border-[rgb(var(--color-border-base))]">
        <Button
          variant="primary"
          onClick={onInitiateAddSong}
          fullWidth
          iconLeft={<PlusCircleIcon className="h-5 w-5" />}
        >
          Add New Song
        </Button>
      </div>
      {songs.length === 0 ? (
        <p className="p-4 text-center text-sm text-[rgb(var(--color-text-muted))]">
          No songs yet. Click "Add New Song" to start.
        </p>
      ) : (
        <ul className="divide-y divide-[rgb(var(--color-border-base))] max-h-[60vh] overflow-y-auto">
          {songs.map(song => (
            <li
              key={song.id}
              className={`p-3 hover:bg-[rgb(var(--color-bg-component))] transition-colors duration-150 ${
                song.id === selectedSongId ? 'bg-[rgb(var(--color-bg-component))] ring-1 ring-[rgb(var(--color-border-focus))]' : ''
              }`}
            >
              <div className="flex justify-between items-center">
                <button
                  onClick={() => onSelectSong(song.id)}
                  className="flex-grow text-left focus:outline-none"
                  title={`View ${song.title}`}
                >
                  <h3 className="font-medium text-sm text-[rgb(var(--color-text-base))] truncate">
                    {song.title || 'Untitled Song'}
                  </h3>
                  {song.artist && (
                    <p className="text-xs text-[rgb(var(--color-text-muted))] truncate">
                      {song.artist}
                    </p>
                  )}
                </button>
                <div className="flex-shrink-0 flex gap-1 ml-2">
                  <Button
                    variant="neutral-outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onInitiateEditSong(song.id); }}
                    title="Edit Song"
                    className="!p-1.5"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="danger-outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onDeleteSong(song.id); }}
                    title="Delete Song"
                    className="!p-1.5"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}