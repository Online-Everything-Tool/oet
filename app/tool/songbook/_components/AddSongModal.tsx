// FILE: app/tool/songbook/_components/AddSongModal.tsx
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Button from '../../_components/form/Button';
import Input from '../../_components/form/Input';
import Textarea from '../../_components/form/Textarea';
import {
  XMarkIcon,
  DocumentPlusIcon,
  CloudArrowDownIcon,
  ArrowPathIcon,
  ArrowsPointingInIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { SongData } from './SongbookClient';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSongSaved: () => void;
  toolRoute: string;
  existingSongData?: SongData | null;
  existingFileId?: string | null;
  initialActiveTab?: 'manual' | 'url';
  onTabChange?: (tab: 'manual' | 'url') => void;
}

const DEFAULT_SONG_DATA_FIELDS: Omit<
  SongData,
  'version' | 'lyricsAndChords' | 'title' | 'artist'
> = {
  playbackSpeed: 10,
  key: '',
  capo: undefined,
  notes: '',
  sourceUrl: '',
  originalMimeType: 'application/vnd.oet.songdata+json',
};

export default function AddSongModal({
  isOpen,
  onClose,
  onSongSaved,
  toolRoute,
  existingSongData = null,
  existingFileId = null,
  initialActiveTab = 'manual',
  onTabChange,
}: AddSongModalProps) {
  const { addFile, updateFileBlob } = useFileLibrary();

  const [activeTab, setActiveTabInternal] = useState<'manual' | 'url'>(
    initialActiveTab
  );
  const [isOnline, setIsOnline] = useState(true);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [lyricsAndChords, setLyricsAndChords] = useState('');
  const [songKey, setSongKey] = useState('');
  const [capo, setCapo] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [sourceUrlState, setSourceUrlState] = useState('');

  const [importUrl, setImportUrl] = useState('');
  const [isFetchingFromUrl, setIsFetchingFromUrl] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const lyricsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const isEditing = useMemo(
    () => !!existingSongData && !!existingFileId,
    [existingSongData, existingFileId]
  );

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
      window.addEventListener('online', updateOnlineStatus);
      window.addEventListener('offline', updateOnlineStatus);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', updateOnlineStatus);
        window.removeEventListener('offline', updateOnlineStatus);
      }
    };
  }, []);

  const resetFormFields = (songDataToLoad?: Partial<SongData> | null) => {
    setTitle(songDataToLoad?.title || '');
    setArtist(songDataToLoad?.artist || '');
    setLyricsAndChords(songDataToLoad?.lyricsAndChords || '');
    setSongKey(songDataToLoad?.key || DEFAULT_SONG_DATA_FIELDS.key || '');
    setCapo(
      songDataToLoad?.capo !== undefined
        ? String(songDataToLoad.capo)
        : DEFAULT_SONG_DATA_FIELDS.capo !== undefined
          ? String(DEFAULT_SONG_DATA_FIELDS.capo)
          : ''
    );
    setNotes(songDataToLoad?.notes || DEFAULT_SONG_DATA_FIELDS.notes || '');
    setSourceUrlState(
      songDataToLoad?.sourceUrl || DEFAULT_SONG_DATA_FIELDS.sourceUrl || ''
    );
  };

  useEffect(() => {
    if (isOpen) {
      resetFormFields(existingSongData);
      setImportUrl('');
      setIsFetchingFromUrl(false);
      setFetchError(null);
      setIsSaving(false);
      setSaveError(null);

      let currentInitialTab = isEditing ? 'manual' : initialActiveTab;

      if (!isOnline && currentInitialTab === 'url' && !isEditing) {
        currentInitialTab = 'manual';
      }

      if (activeTab !== currentInitialTab) {
        setActiveTabInternal(currentInitialTab);
      }

      if (currentInitialTab === 'manual') {
        if (isEditing && titleInputRef.current) {
          setTimeout(() => titleInputRef.current?.focus(), 100);
        } else if (!isEditing && lyricsTextareaRef.current) {
          setTimeout(() => lyricsTextareaRef.current?.focus(), 100);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, existingSongData, initialActiveTab, isEditing, isOnline]);

  const handleInternalTabChange = (newTab: 'manual' | 'url') => {
    if (newTab === 'url' && !isOnline) {
      setFetchError('Offline: Import from URL is unavailable.');

      return;
    }
    setFetchError(null);
    setActiveTabInternal(newTab);
    if (onTabChange) {
      onTabChange(newTab);
    }
    if (newTab === 'manual') {
      if (isEditing && titleInputRef.current) {
        setTimeout(() => titleInputRef.current?.focus(), 100);
      } else if (!isEditing && lyricsTextareaRef.current) {
        setTimeout(() => lyricsTextareaRef.current?.focus(), 100);
      }
    }
  };

  useEffect(() => {
    if (!isOnline && activeTab === 'url' && !isEditing) {
      handleInternalTabChange('manual');
      setFetchError('Offline: Import from URL is unavailable.');
    }
  }, [isOnline, activeTab, isEditing]);

  const generateFilename = (): string => {
    const t = title.trim() || 'untitled';
    const a = artist.trim() || 'unknown_artist';
    const cleanTitle = t
      .replace(/[^\w\s.-]/gi, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
    const cleanArtist = a
      .replace(/[^\w\s.-]/gi, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
    return `${cleanArtist}_${cleanTitle}.songdata.json`;
  };

  const handleSaveSong = async () => {
    if (!lyricsAndChords.trim()) {
      setSaveError('Lyrics & Chords content cannot be empty.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);

    const songDataToSave: SongData = {
      version: 1,
      title: title.trim() || null,
      artist: artist.trim() || null,
      lyricsAndChords: lyricsAndChords,
      playbackSpeed:
        existingSongData?.playbackSpeed ||
        DEFAULT_SONG_DATA_FIELDS.playbackSpeed,
      fontSize: existingSongData?.fontSize,
      key: songKey.trim() || undefined,
      capo: capo.trim() ? parseInt(capo, 10) : undefined,
      notes: notes.trim() || undefined,
      sourceUrl: sourceUrlState.trim() || undefined,
      originalMimeType:
        existingSongData?.originalMimeType ||
        'application/vnd.oet.songdata+json',
    };

    const songBlob = new Blob([JSON.stringify(songDataToSave, null, 2)], {
      type: 'application/vnd.oet.songdata+json',
    });

    try {
      if (isEditing && existingFileId) {
        await updateFileBlob(existingFileId, songBlob, false);
      } else {
        const filename = generateFilename();
        await addFile(
          songBlob,
          filename,
          'application/vnd.oet.songdata+json',
          false,
          toolRoute
        );
      }
      onSongSaved();
      onClose();
    } catch (err) {
      console.error('Error saving song:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save song.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFetchFromUrl = async () => {
    if (!isOnline) {
      setFetchError('Cannot fetch from URL: You are currently offline.');
      return;
    }
    const trimmedUrl = importUrl.trim();
    if (!trimmedUrl) {
      setFetchError('Please enter a URL.');
      return;
    }

    const ugDomainPattern =
      /^(https?:\/\/)?(www\.)?(tabs\.ultimate-guitar\.com|ultimate-guitar\.com)/i;
    if (!ugDomainPattern.test(trimmedUrl)) {
      setFetchError(
        'Please enter a valid Ultimate Guitar URL (e.g., tabs.ultimate-guitar.com or ultimate-guitar.com).'
      );
      return;
    }

    setIsFetchingFromUrl(true);
    setFetchError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
      console.log(
        `[AddSongModal] Calling /api/songbook for URL: ${trimmedUrl}`
      );
      const response = await fetch(`${apiUrl}/api/songbook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[AddSongModal] Error from scraping API:', data);
        setFetchError(
          data.details || data.error || 'Failed to fetch song data from URL.'
        );
        setIsFetchingFromUrl(false);
        return;
      }

      console.log('[AddSongModal] Successfully fetched data:', data);

      setTitle(data.song || '');
      setArtist(data.artist || '');
      setLyricsAndChords(data.chords || '');
      setSourceUrlState(data.requestedUrl || trimmedUrl);

      setSongKey(DEFAULT_SONG_DATA_FIELDS.key || '');
      setCapo(
        DEFAULT_SONG_DATA_FIELDS.capo !== undefined
          ? String(DEFAULT_SONG_DATA_FIELDS.capo)
          : ''
      );
      setNotes(DEFAULT_SONG_DATA_FIELDS.notes || '');

      handleInternalTabChange('manual');
      if (lyricsTextareaRef.current) {
        setTimeout(() => lyricsTextareaRef.current?.focus(), 100);
      }
    } catch (error) {
      const err = error as Error;
      console.error(
        '[AddSongModal] Network or other error fetching from URL:',
        err
      );
      setFetchError(`An error occurred: ${err.message}`);
    } finally {
      setIsFetchingFromUrl(false);
    }
  };

  const handleCollapseWhitespace = () => {
    setLyricsAndChords((prevLyrics) => {
      if (!prevLyrics) return '';
      const text = prevLyrics.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const resultBuilder: string[] = [];
      let i = 0;
      while (i < text.length) {
        if (text[i] === '\n') {
          resultBuilder.push('\n');
          if (i + 1 < text.length && text[i + 1] === '\n') {
            i += 2;
          } else {
            i += 1;
          }
        } else {
          resultBuilder.push(text[i]);
          i += 1;
        }
      }
      return resultBuilder.join('');
    });
    lyricsTextareaRef.current?.focus();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-song-modal-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
          <h2
            id="add-song-modal-title"
            className="text-xl font-semibold text-gray-800"
          >
            {isEditing ? 'Edit Song' : 'Add New Song'}
          </h2>
          <Button
            variant="link"
            size="sm"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </Button>
        </div>

        {!isEditing && (
          <div className="p-2 border-b border-gray-200 bg-gray-50 flex flex-shrink-0">
            <Button
              variant={activeTab === 'manual' ? 'primary' : 'neutral-outline'}
              onClick={() => handleInternalTabChange('manual')}
              className={`flex-1 rounded-r-none ${activeTab === 'manual' ? 'z-10 !border-r-transparent' : 'hover:bg-gray-100'}`}
              size="sm"
            >
              Enter Manually
            </Button>
            {isOnline && (
              <Button
                variant={activeTab === 'url' ? 'primary' : 'neutral-outline'}
                onClick={() => handleInternalTabChange('url')}
                className={`flex-1 rounded-l-none -ml-px ${activeTab === 'url' ? 'z-10' : 'hover:bg-gray-100'}`}
                size="sm"
              >
                Import from URL
              </Button>
            )}
            {!isOnline && (
              <div
                className="flex-1 rounded-l-none -ml-px px-3 py-1.5 text-sm text-center text-gray-400 bg-gray-100 border border-gray-300 border-l-transparent cursor-not-allowed flex items-center justify-center"
                title="Import from URL is unavailable offline"
              >
                <NoSymbolIcon className="h-4 w-4 mr-1.5 text-gray-400" />
                Import from URL
              </div>
            )}
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-grow space-y-4 min-h-[300px]">
          {activeTab === 'manual' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  ref={titleInputRef}
                  label="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Song Title"
                />
                <Input
                  label="Artist"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Artist Name"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label
                    htmlFor="lyrics-textarea"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Lyrics & Chords
                  </label>
                  <Button
                    variant="neutral-outline"
                    size="sm"
                    onClick={handleCollapseWhitespace}
                    title="Collapse excessive blank lines"
                    iconLeft={<ArrowsPointingInIcon className="h-4 w-4 mr-1" />}
                  >
                    Collapse Spaces
                  </Button>
                </div>
                <Textarea
                  id="lyrics-textarea"
                  ref={lyricsTextareaRef}
                  value={lyricsAndChords}
                  onChange={(e) => setLyricsAndChords(e.target.value)}
                  placeholder="Paste or type lyrics and chords here..."
                  rows={10}
                  textareaClassName="font-mono text-sm leading-relaxed"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Key (e.g., G, Am, C#m)"
                  value={songKey}
                  onChange={(e) => setSongKey(e.target.value)}
                />
                <Input
                  label="Capo"
                  value={capo}
                  onChange={(e) => setCapo(e.target.value)}
                  type="text"
                  placeholder="e.g. 3 or none"
                />
              </div>
              <Textarea
                label="Notes / Strumming Pattern"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
              <Input
                label="Source URL (Optional)"
                value={sourceUrlState}
                onChange={(e) => setSourceUrlState(e.target.value)}
                type="url"
                placeholder="https://..."
              />
            </>
          )}

          {activeTab === 'url' && !isEditing && isOnline && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-gray-600">
                Enter a URL from Ultimate Guitar to attempt to import song data.
                This feature relies on an external scraping service.
              </p>
              <Input
                label="Song URL from Ultimate Guitar"
                value={importUrl}
                onChange={(e) => {
                  setImportUrl(e.target.value);
                  setFetchError(null);
                }}
                placeholder="https://tabs.ultimate-guitar.com/..."
                type="url"
                disabled={isFetchingFromUrl}
              />
              {fetchError && (
                <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  {fetchError}
                </p>
              )}
              <Button
                onClick={handleFetchFromUrl}
                isLoading={isFetchingFromUrl}
                disabled={isFetchingFromUrl || !importUrl.trim()}
                loadingText="Fetching..."
                iconLeft={
                  isFetchingFromUrl ? (
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  ) : (
                    <CloudArrowDownIcon className="h-5 w-5" />
                  )
                }
                variant="secondary"
                fullWidth
              >
                Fetch Song Data
              </Button>
            </div>
          )}
          {activeTab === 'url' && !isEditing && !isOnline && (
            <div className="py-4 text-center text-gray-500">
              <NoSymbolIcon className="h-12 w-12 mx-auto text-gray-400 mb-2" />
              <p className="font-semibold">Import from URL is Offline</p>
              <p className="text-sm">
                This feature requires an internet connection.
              </p>
            </div>
          )}
        </div>

        {activeTab === 'manual' && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end items-center gap-3 flex-shrink-0">
            {saveError && (
              <p className="text-sm text-red-600 mr-auto px-2 py-1 bg-red-100 border border-red-200 rounded">
                {saveError}
              </p>
            )}
            <Button variant="neutral" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveSong}
              isLoading={isSaving}
              disabled={isSaving || !lyricsAndChords.trim()}
              loadingText={isEditing ? 'Updating...' : 'Saving...'}
              iconLeft={
                isSaving ? (
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                ) : (
                  <DocumentPlusIcon className="h-5 w-5" />
                )
              }
            >
              {isEditing ? 'Update Song' : 'Save Song To Library'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
