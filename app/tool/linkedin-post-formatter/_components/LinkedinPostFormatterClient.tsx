// --- FILE: app/tool/linkedin-post-formatter/_components/LinkedinPostFormatterClient.tsx ---
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';

import useToolState from '../../_hooks/useToolState';
import { useHistory } from '../../../context/HistoryContext';
import EmojiExplorerModal from '../../_components/shared/EmojiExplorerModal';

import Button from '../../_components/form/Button';
import Checkbox from '../../_components/form/Checkbox';

import {
  ListBulletIcon,
  Bars3BottomLeftIcon,
  XCircleIcon,
  FaceSmileIcon,
} from '@heroicons/react/20/solid';

// --- State Definition ---
interface LinkedinFormatterState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentJson: Record<string, any> | null;
}

const DEFAULT_STATE: LinkedinFormatterState = {
  contentJson: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [] }],
  },
};
// -----------------------

interface LinkedinPostFormatterClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function LinkedinPostFormatterClient({
  toolTitle,
  toolRoute,
}: LinkedinPostFormatterClientProps) {
  // --- Hooks ---
  const {
    state,
    setState,
    isLoadingState,
    isPersistent,
    togglePersistence,
    clearState,
    errorLoadingState,
  } = useToolState<LinkedinFormatterState>(toolRoute, DEFAULT_STATE);

  const { addHistoryEntry } = useHistory();

  // Local UI state
  const [isCopied, setIsCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const [isEmojiModalOpen, setIsEmojiModalOpen] = useState(false);

  // TipTap Editor Instance Setup
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        horizontalRule: false,
        codeBlock: false,
        bulletList: {},
        orderedList: {},
        listItem: {},
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Start typing your LinkedIn post here...',
      }),
    ],
    content: state.contentJson || DEFAULT_STATE.contentJson,
    editable: true,
    onUpdate: ({ editor }) => {
      setState({ contentJson: editor.getJSON() });
    },
    editorProps: {
      attributes: { class: 'focus:outline-none' },
    },
  });

  // Effect to load persisted state
  useEffect(() => {
    if (editor && !isLoadingState && state.contentJson) {
      const currentContentJsonString = JSON.stringify(editor.getJSON());
      const loadedContentJsonString = JSON.stringify(state.contentJson);
      if (currentContentJsonString !== loadedContentJsonString) {
        if (editor.isEditable) {
          editor.commands.setContent(state.contentJson, false);
        }
      }
    }
  }, [editor, isLoadingState, state.contentJson]);

  // --- Actions ---
  const handleCopy = useCallback(async () => {
    if (!editor) return;
    // TODO: Implement logic to get text WITH Unicode chars
    const textToCopy = editor.getText(); // Placeholder for now
    if (!textToCopy) {
      setActionError('Nothing to copy.');
      return;
    }
    setActionError(null);

    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: 'click',
        input: { action: 'copy', characterCount: textToCopy.length },
        output: { message: `Copied ${textToCopy.length} characters.` },
        status: 'success',
        eventTimestamp: Date.now(),
        outputFileIds: [],
      });
    } catch (err) {
      console.error('Copy failed:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setActionError(`Could not copy text: ${message}`);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: 'click',
        input: { action: 'copy' },
        output: { error: `Could not copy text: ${message}` },
        status: 'error',
        eventTimestamp: Date.now(),
        outputFileIds: [],
      });
    }
  }, [editor, addHistoryEntry, toolRoute, toolTitle]);

  const handleClear = useCallback(async () => {
    const hadContent = editor && editor.getText().length > 0;
    editor?.commands.clearContent(true); // Fires update to clear state via debounce
    setActionError(null);
    setIsCopied(false);
    if (hadContent) {
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: 'click',
        input: { action: 'clear' },
        output: { message: `Content cleared.` },
        status: 'success',
        eventTimestamp: Date.now(),
        outputFileIds: [],
      });
    }
  }, [editor, addHistoryEntry, toolRoute, toolTitle]);

  // --- Toolbar Handlers ---
  const toggleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);
  const toggleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);
  const toggleUnderline = useCallback(() => {
    editor?.chain().focus().toggleUnderline().run();
  }, [editor]);
  const toggleStrike = useCallback(() => {
    editor?.chain().focus().toggleStrike().run();
  }, [editor]);
  const toggleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run();
  }, [editor]);
  const toggleOrderedList = useCallback(() => {
    editor?.chain().focus().toggleOrderedList().run();
  }, [editor]);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      if (editor && emoji) {
        editor.chain().focus().insertContent(emoji).run();
        addHistoryEntry({
          toolName: toolTitle,
          toolRoute: toolRoute,
          trigger: 'click',
          input: { action: 'insertEmoji', emoji: emoji },
          output: { message: `Inserted emoji: ${emoji}` },
          status: 'success',
          eventTimestamp: Date.now(),
          outputFileIds: [],
        });
      }
      setIsEmojiModalOpen(false);
    },
    [editor, addHistoryEntry, toolTitle, toolRoute]
  );

  // --- Render ---
  if (isLoadingState && !editor) {
    return (
      <div className="text-center p-4 text-gray-500 italic animate-pulse">
        Loading Editor...
      </div>
    );
  }

  if (errorLoadingState) {
    return (
      <div className="p-4 bg-red-100 border border-red-300 text-red-700 rounded">
        Error loading saved state: {errorLoadingState}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <Button
          onClick={toggleBold}
          variant={
            editor?.isActive('bold') ? 'primary-outline' : 'neutral-outline'
          }
          size="sm"
          title="Bold"
          disabled={!editor?.can().toggleBold()}
        >
          {' '}
          <b className="text-lg">B</b>{' '}
        </Button>
        <Button
          onClick={toggleItalic}
          variant={
            editor?.isActive('italic') ? 'primary-outline' : 'neutral-outline'
          }
          size="sm"
          title="Italic"
          disabled={!editor?.can().toggleItalic()}
        >
          {' '}
          <i className="text-lg">I</i>{' '}
        </Button>
        <Button
          onClick={toggleUnderline}
          variant={
            editor?.isActive('underline')
              ? 'primary-outline'
              : 'neutral-outline'
          }
          size="sm"
          title="Underline"
          disabled={!editor?.can().toggleUnderline()}
        >
          {' '}
          <u className="text-lg">U</u>{' '}
        </Button>
        <Button
          onClick={toggleStrike}
          variant={
            editor?.isActive('strike') ? 'primary-outline' : 'neutral-outline'
          }
          size="sm"
          title="Strikethrough"
          disabled={!editor?.can().toggleStrike()}
        >
          {' '}
          <s className="text-lg">S</s>{' '}
        </Button>

        <div className="border-l border-gray-300 mx-1 h-6 self-center"></div>

        <Button
          onClick={toggleBulletList}
          variant={
            editor?.isActive('bulletList')
              ? 'primary-outline'
              : 'neutral-outline'
          }
          size="sm"
          title="Bullet List"
          disabled={!editor?.can().toggleBulletList()}
        >
          {' '}
          <ListBulletIcon className="h-4 w-4" />{' '}
        </Button>
        <Button
          onClick={toggleOrderedList}
          variant={
            editor?.isActive('orderedList')
              ? 'primary-outline'
              : 'neutral-outline'
          }
          size="sm"
          title="Numbered List"
          disabled={!editor?.can().toggleOrderedList()}
        >
          {' '}
          <Bars3BottomLeftIcon className="h-4 w-4" />{' '}
        </Button>

        <div className="border-l border-gray-300 mx-1 h-6 self-center"></div>
        <Button
          onClick={() => setIsEmojiModalOpen(true)}
          variant={'neutral-outline'}
          size="sm"
          title="Insert Emoji"
          disabled={!editor?.isEditable}
        >
          <FaceSmileIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor Content Area */}
      <div
        ref={editorWrapperRef}
        className="border border-[rgb(var(--color-input-border))] rounded-md shadow-sm p-3 min-h-[200px] focus-within:border-[rgb(var(--color-input-focus-border))] focus-within:ring-1 focus-within:ring-[rgb(var(--color-input-focus-border))] bg-white cursor-text flex flex-col"
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none outline-none flex-grow"
        />
      </div>

      {/* Action Buttons & Persistence */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-gray-200 mt-2">
        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={handleCopy}
            disabled={!editor?.getText().trim()}
          >
            {isCopied ? 'Copied!' : 'Copy Formatted Text'}
          </Button>
          <Button
            variant="neutral"
            onClick={handleClear}
            disabled={!editor?.getText().trim()}
          >
            Clear
          </Button>
        </div>
        {actionError && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <XCircleIcon className="h-4 w-4 inline-block" aria-hidden="true" />
            {actionError}
          </p>
        )}
        <Checkbox
          label={<span className="text-xs">Remember Content</span>}
          id="persistence-toggle-linkedin"
          checked={isPersistent}
          onChange={togglePersistence}
          disabled={isLoadingState}
        />
      </div>

      <EmojiExplorerModal
        isOpen={isEmojiModalOpen}
        onClose={() => setIsEmojiModalOpen(false)}
        onEmojiSelect={handleEmojiSelect}
      />
    </div>
  );
}
