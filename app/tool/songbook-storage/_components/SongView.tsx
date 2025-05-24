'use client';

import React from 'react';
import type { Song } from '../_hooks/useSongbookStorage';
import Button from '../../_components/form/Button';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { safeParseState, safeStringify } from '@/app/lib/utils';

interface SongViewProps {
  song: Song | null;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function SongView({ song, onEdit, onDelete }: SongViewProps) {
  if (!song) {
    return (
      <div className="p-6 text-center text-[rgb(var(--color-text-muted))] border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-component))]">
        <p>Select a song from the list to view its details, or add a new song.</p>
      </div>
    );
  }

  let displayCustomMetadata = song.customMetadata;
  if (song.customMetadata.trim().startsWith('{') && song.customMetadata.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(song.customMetadata);
      displayCustomMetadata = JSON.stringify(parsed, null, 2);
    } catch (e) {
      // Not valid JSON, display as is
    }
  }


  return (
    <div className="p-4 space-y-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-component))]">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-[rgb(var(--color-text-base))]">{song.title || 'Untitled Song'}</h2>
          {song.artist && <p className="text-sm text-[rgb(var(--color-text-muted))]">By {song.artist}</p>}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="neutral-outline"
            onClick={() => onEdit(song.id)}
            iconLeft={<PencilSquareIcon className="h-5 w-5" />}
          >
            Edit
          </Button>
          <Button
            variant="danger-outline"
            onClick={() => onDelete(song.id)}
            iconLeft={<TrashIcon className="h-5 w-5" />}
          >
            Delete
          </Button>
        </div>
      </div>

      {(song.lyrics || song.chords) && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {song.lyrics && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] mb-1">Lyrics</h3>
              <pre className="p-3 bg-[rgb(var(--color-bg-subtle))] rounded text-sm whitespace-pre-wrap font-sans overflow-x-auto max-h-96">
                {song.lyrics}
              </pre>
            </div>
          )}
          {song.chords && (
             <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] mb-1">Chords</h3>
              <pre className="p-3 bg-[rgb(var(--color-bg-subtle))] rounded text-sm whitespace-pre-wrap font-mono overflow-x-auto max-h-96">
                {song.chords}
              </pre>
            </div>
          )}
        </div>
      )}
      
      {!song.lyrics && !song.chords && (
        <p className="text-sm text-[rgb(var(--color-text-muted))] italic">No lyrics or chords entered for this song.</p>
      )}

      {song.customMetadata && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] mb-1">Custom Metadata</h3>
          <pre className="p-3 bg-[rgb(var(--color-bg-subtle))] rounded text-sm whitespace-pre-wrap font-mono overflow-x-auto max-h-60">
            {displayCustomMetadata}
          </pre>
        </div>
      )}

      <div className="text-xs text-[rgb(var(--color-text-muted))] pt-2 border-t border-[rgb(var(--color-border-base))]">
        <p>Created: {new Date(song.createdAt).toLocaleString()}</p>
        <p>Last Updated: {new Date(song.updatedAt).toLocaleString()}</p>
      </div>
    </div>
  );
}