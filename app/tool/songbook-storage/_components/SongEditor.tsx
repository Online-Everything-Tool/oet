'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Song, SongFormData } from '../_hooks/useSongbookStorage';
import Button from '../../_components/form/Button';
import Input from '../../_components/form/Input';
import Textarea from '../../_components/form/Textarea';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface SongEditorProps {
  songToEdit?: Song | null; // null for new song, Song object for editing
  onSave: (data: SongFormData, id?: string) => void;
  onCancel: () => void;
}

const EMPTY_FORM_DATA: SongFormData = {
  title: '',
  artist: '',
  lyrics: '',
  chords: '',
  customMetadata: '',
};

export default function SongEditor({ songToEdit, onSave, onCancel }: SongEditorProps) {
  const [formData, setFormData] = useState<SongFormData>(EMPTY_FORM_DATA);
  const [errors, setErrors] = useState<{ title?: string }>({});

  useEffect(() => {
    if (songToEdit) {
      setFormData({
        title: songToEdit.title,
        artist: songToEdit.artist,
        lyrics: songToEdit.lyrics,
        chords: songToEdit.chords,
        customMetadata: songToEdit.customMetadata,
      });
    } else {
      setFormData(EMPTY_FORM_DATA);
    }
    setErrors({});
  }, [songToEdit]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
      if (name === 'title' && errors.title) {
        setErrors(prev => ({ ...prev, title: undefined }));
      }
    },
    [errors.title]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setErrors({ title: 'Title is required.' });
      return;
    }
    onSave(formData, songToEdit?.id);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-component))]">
      <h2 className="text-lg font-semibold text-[rgb(var(--color-text-base))]">
        {songToEdit ? 'Edit Song' : 'Add New Song'}
      </h2>
      
      <Input
        label="Title"
        id="title"
        name="title"
        value={formData.title}
        onChange={handleChange}
        error={errors.title}
        required
        inputClassName="text-sm"
      />
      <Input
        label="Artist (Optional)"
        id="artist"
        name="artist"
        value={formData.artist}
        onChange={handleChange}
        inputClassName="text-sm"
      />
      <Textarea
        label="Lyrics"
        id="lyrics"
        name="lyrics"
        value={formData.lyrics}
        onChange={handleChange}
        rows={8}
        placeholder="Enter song lyrics here..."
        textareaClassName="text-sm"
      />
      <Textarea
        label="Chords (Optional)"
        id="chords"
        name="chords"
        value={formData.chords}
        onChange={handleChange}
        rows={5}
        placeholder="Enter chords here (e.g., G C D G)..."
        textareaClassName="text-sm"
      />
      <Textarea
        label="Custom Metadata (Optional)"
        id="customMetadata"
        name="customMetadata"
        value={formData.customMetadata}
        onChange={handleChange}
        rows={3}
        placeholder='e.g., {"key": "G", "capo": 2, "tempo": "120bpm"}'
        textareaClassName="text-sm font-mono"
      />
      <div className="flex justify-end gap-3 pt-3 border-t border-[rgb(var(--color-border-base))]">
        <Button
          type="button"
          variant="neutral"
          onClick={onCancel}
          iconLeft={<XCircleIcon className="h-5 w-5" />}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          iconLeft={<CheckCircleIcon className="h-5 w-5" />}
        >
          {songToEdit ? 'Save Changes' : 'Add Song'}
        </Button>
      </div>
    </form>
  );
}