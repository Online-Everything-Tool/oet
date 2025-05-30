// FILE: app/tool/songbook/_components/SongbookClient.tsx
'use client';

import React, { useCallback, useState, useMemo } from 'react';
import GenericStorageClient, {
  StorageHookReturnType,
  DefaultItemActionHandlers,
  FeedbackStateEntry,
  CustomPrimaryCreateConfig,
} from '../../_components/storage/GenericStorageClient';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { getFileIconClassName } from '@/app/lib/utils';
import Input from '../../_components/form/Input';
import {
  PlayIcon,
  PencilSquareIcon,
  MusicalNoteIcon,
  TrashIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import Button from '../../_components/form/Button';
import AddSongModal from './AddSongModal';
import PlaySongView from './PlaySongView';

export interface SongData {
  version: 1;
  title: string | null;
  artist: string | null;
  lyricsAndChords: string;
  playbackSpeed: number;
  key?: string;
  capo?: number;
  notes?: string;
  sourceUrl?: string;
  originalMimeType?: string;
  fontSize?: number;
}

interface SongbookClientProps {
  toolRoute: string;
  metadata: ToolMetadata;
}

export default function SongbookClient({
  toolRoute,
  metadata: initialMetadata,
}: SongbookClientProps) {
  const fileLibrary = useFileLibrary();
  const [artistFilter, setArtistFilter] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [isAddSongModalOpen, setIsAddSongModalOpen] = useState(false);
  const [isPlaySongViewOpen, setIsPlaySongViewOpen] = useState(false);
  const [songToPlay, setSongToPlay] = useState<SongData | null>(null);
  const [currentFilePlaying, setCurrentFilePlaying] =
    useState<StoredFile | null>(null);

  const [songToEdit, setSongToEdit] = useState<SongData | null>(null);
  const [fileIdToEdit, setFileIdToEdit] = useState<string | null>(null);

  const acceptedMimeTypesForUpload = useMemo(() => {
    return '.txt,.crd,.pro,.cho,.tab,.srt,application/vnd.oet.songdata+json,text/plain';
  }, []);

  const acceptedMimeTypesForDisplay = useMemo(
    () => new Set(['application/vnd.oet.songdata+json', 'text/plain']),
    []
  );

  const songFileExtensions = useMemo(
    () =>
      new Set([
        '.txt',
        '.crd',
        '.pro',
        '.cho',
        '.tab',
        '.srt',
        '.songdata.json',
      ]),
    []
  );

  const customListFiles = useCallback(
    async (limit?: number, includeTemporary?: boolean) => {
      const allFiles = await fileLibrary.listFiles(
        limit ? limit * 5 : undefined,
        includeTemporary
      );

      const songFiles = allFiles.filter((f) => {
        const isAssociatedWithSongbook = f.toolRoute === toolRoute;
        const type = f.type || '';
        const filename = f.filename || '';
        const extension = filename.includes('.')
          ? filename.substring(filename.lastIndexOf('.')).toLowerCase()
          : '';

        const matchesMime = acceptedMimeTypesForDisplay.has(type);
        const matchesExtension = songFileExtensions.has(extension);

        if (isAssociatedWithSongbook || matchesMime || matchesExtension) {
          if (artistFilter.trim() !== '') {
            const lowerArtistFilter = artistFilter.toLowerCase();
            return filename.toLowerCase().includes(lowerArtistFilter);
          }
          return true;
        }
        return false;
      });
      return limit ? songFiles.slice(0, limit) : songFiles;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      fileLibrary.listFiles,
      toolRoute,
      acceptedMimeTypesForDisplay,
      songFileExtensions,
      artistFilter,
    ]
  );

  const customMarkAllFilesAsTemporary = useCallback(async () => {
    const allRelevantFiles = await customListFiles(undefined, false);
    if (allRelevantFiles.length === 0) return { markedCount: 0, markedIds: [] };

    const idsToMark = allRelevantFiles.map((f) => f.id);
    let markedCount = 0;
    for (const id of idsToMark) {
      const success = await fileLibrary.markFileAsTemporary(id);
      if (success) markedCount++;
    }
    return { markedCount, markedIds: idsToMark };
  }, [fileLibrary.markFileAsTemporary, customListFiles]);

  const songbookStorageHookProvider = useCallback((): StorageHookReturnType => {
    return {
      ...fileLibrary,
      listFiles: customListFiles,
      markAllFilesAsTemporary: customMarkAllFilesAsTemporary,
    };
  }, [fileLibrary, customListFiles, customMarkAllFilesAsTemporary]);

  const handleOpenAddSongModalForNew = useCallback(() => {
    setSongToEdit(null);
    setFileIdToEdit(null);
    setIsAddSongModalOpen(true);
  }, []);

  const primaryCreateConfig: CustomPrimaryCreateConfig = useMemo(
    () => ({
      label: 'Create New Song',
      icon: <MusicalNoteIcon className="h-5 w-5" />,
      onClick: handleOpenAddSongModalForNew,
      buttonVariant: 'accent2',
    }),
    [handleOpenAddSongModalForNew]
  );

  const filterControls = useMemo(
    () => (
      <div className="w-full md:w-1/3">
        <Input
          type="search"
          placeholder="Filter by artist or title..."
          value={artistFilter}
          onChange={(e) => setArtistFilter(e.target.value)}
          label="Filter Songs"
        />
      </div>
    ),
    [artistFilter]
  );

  const handlePlaySong = useCallback(async (file: StoredFile) => {
    if (!file.blob) {
      console.error('No blob data to play song:', file.filename);
      return;
    }
    try {
      const lyricsAndChordsText = await file.blob.text();
      let songData: SongData;
      if (file.type === 'application/vnd.oet.songdata+json') {
        songData = JSON.parse(lyricsAndChordsText) as SongData;
      } else {
        songData = {
          version: 1,
          title:
            file.filename.substring(0, file.filename.lastIndexOf('.')) ||
            file.filename,
          artist: null,
          lyricsAndChords: lyricsAndChordsText,
          playbackSpeed: 10,
          originalMimeType: file.type,
          key: '',
          capo: undefined,
          notes: '',
          sourceUrl: '',
        };
      }
      setCurrentFilePlaying(file);
      setSongToPlay(songData);
      setIsPlaySongViewOpen(true);
    } catch (error) {
      console.error('Error preparing song for playback:', error);
    }
  }, []);

  const handleEditSong = useCallback(async (file: StoredFile) => {
    if (!file.blob) {
      console.error('No blob data to edit song:', file.filename);
      return;
    }
    try {
      const fileContent = await file.blob.text();
      let dataToEdit: SongData;
      if (file.type === 'application/vnd.oet.songdata+json') {
        dataToEdit = JSON.parse(fileContent) as SongData;
      } else {
        dataToEdit = {
          version: 1,
          title:
            file.filename.substring(0, file.filename.lastIndexOf('.')) ||
            file.filename,
          artist: null,
          lyricsAndChords: fileContent,
          playbackSpeed: 10,
          originalMimeType: file.type,
          key: '',
          capo: undefined,
          notes: '',
          sourceUrl: '',
        };
      }
      setSongToEdit(dataToEdit);
      setFileIdToEdit(file.id);
      setIsAddSongModalOpen(true);
    } catch (error) {
      console.error('Error preparing song for editing:', error);
    }
  }, []);

  const itemActionsRenderer = useCallback(
    (
      file: StoredFile,
      defaultActionHandlers: DefaultItemActionHandlers,
      isProcessingItem: boolean,
      _feedbackForItem: FeedbackStateEntry | null
    ): React.ReactNode[] => {
      const actions: React.ReactNode[] = [];
      actions.push(
        <Button
          key={`play-${file.id}`}
          onClick={() => handlePlaySong(file)}
          disabled={isProcessingItem || !file.blob}
          title="Play song"
          variant="primary-outline"
          size="sm"
          className="!p-1"
          iconLeft={<PlayIcon className="h-5 w-5" />}
        />
      );
      actions.push(
        <Button
          key={`edit-${file.id}`}
          onClick={() => handleEditSong(file)}
          disabled={isProcessingItem}
          title="Edit song details"
          variant="neutral-outline"
          size="sm"
          className="!p-1"
          iconLeft={<PencilSquareIcon className="h-5 w-5" />}
        />
      );
      actions.push(
        <Button
          key={`download-${file.id}`}
          onClick={defaultActionHandlers.onDownload}
          disabled={isProcessingItem || !file.blob}
          title="Download song file"
          variant="neutral-outline"
          size="sm"
          className="!p-1"
          iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
        />
      );
      actions.push(
        <Button
          key={`delete-${file.id}`}
          onClick={defaultActionHandlers.onDelete}
          disabled={isProcessingItem}
          title="Delete song"
          variant="danger-outline"
          size="sm"
          className="!p-1"
          iconLeft={<TrashIcon className="h-5 w-5" />}
        />
      );
      return actions;
    },
    [handlePlaySong, handleEditSong]
  );

  const songGridPreviewRenderer = useCallback(
    (file: StoredFile, _previewUrl?: string): React.ReactNode => {
      const displayName = file.filename || 'Untitled Song';
      return (
        <div className="p-2 text-center flex flex-col items-center justify-center h-full">
          <span
            aria-hidden="true"
            className={`${getFileIconClassName(file.filename)} text-3xl mb-1`}
            title={file.type || 'Song file'}
          ></span>
          <p
            className="text-xs font-medium text-gray-700 truncate w-full"
            title={displayName}
          >
            {displayName}
          </p>
        </div>
      );
    },
    []
  );

  const handleSongSavedOrUpdated = useCallback(() => {
    setIsAddSongModalOpen(false);
    setRefreshTrigger((prev) => prev + 1);
    setSongToEdit(null);
    setFileIdToEdit(null);
  }, []);

  return (
    <>
      <GenericStorageClient
        toolRoute={toolRoute}
        itemTypeSingular="Song"
        itemTypePlural="Songs"
        storageHook={songbookStorageHookProvider}
        fileInputAccept={acceptedMimeTypesForUpload}
        libraryFilterForModal={{}}
        defaultLayout="list"
        metadata={initialMetadata}
        renderGridItemPreview={songGridPreviewRenderer}
        enableCopyContent={(file) =>
          file.type === 'application/vnd.oet.songdata+json' ||
          file.type === 'text/plain'
        }
        customPrimaryCreateConfig={primaryCreateConfig}
        customFilterControls={filterControls}
        renderItemActions={itemActionsRenderer}
        customBulkActions={[]}
        externalRefreshTrigger={refreshTrigger}
      />

      <AddSongModal
        isOpen={isAddSongModalOpen}
        onClose={() => {
          setIsAddSongModalOpen(false);
          setSongToEdit(null);
          setFileIdToEdit(null);
        }}
        onSongSaved={handleSongSavedOrUpdated}
        toolRoute={toolRoute}
        existingSongData={songToEdit}
        existingFileId={fileIdToEdit}
      />
      <PlaySongView
        isOpen={isPlaySongViewOpen}
        onClose={() => setIsPlaySongViewOpen(false)}
        songData={songToPlay}
        file={currentFilePlaying}
      />
    </>
  );
}
