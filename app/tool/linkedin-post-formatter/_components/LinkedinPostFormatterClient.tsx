// --- FILE: app/tool/linkedin-post-formatter/_components/LinkedinPostFormatterClient.tsx ---
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';

import useToolState from '@/app/tool/_hooks/useToolState';
import EmojiExplorerModal from '@/app/tool/_components/shared/EmojiExplorerModal';
import Button from '@/app/tool/_components/form/Button';
import {
  ListBulletIcon,
  Bars3BottomLeftIcon,
  XCircleIcon,
  FaceSmileIcon,
  CheckIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/20/solid';

const UNICODE_MAPS = {
  bold: {
    A: '𝗔',
    B: '𝗕',
    C: '𝗖',
    D: '𝗗',
    E: '𝗘',
    F: '𝗙',
    G: '𝗚',
    H: '𝗛',
    I: '𝗜',
    J: '𝗝',
    K: '𝗞',
    L: '𝗟',
    M: '𝗠',
    N: '𝗡',
    O: '𝗢',
    P: '𝗣',
    Q: '𝗤',
    R: '𝗥',
    S: '𝗦',
    T: '𝗧',
    U: '𝗨',
    V: '𝗩',
    W: '𝗪',
    X: '𝗫',
    Y: '𝗬',
    Z: '𝗭',
    a: '𝗮',
    b: '𝗯',
    c: '𝗰',
    d: '𝗱',
    e: '𝗲',
    f: '𝗳',
    g: '𝗴',
    h: '𝗵',
    i: '𝗶',
    j: '𝗷',
    k: '𝗸',
    l: '𝗹',
    m: '𝗺',
    n: '𝗻',
    o: '𝗼',
    p: '𝗽',
    q: '𝗾',
    r: '𝗿',
    s: '𝘀',
    t: '𝘁',
    u: '𝘂',
    v: '𝘃',
    w: '𝘄',
    x: '𝘅',
    y: '𝘆',
    z: '𝘇',
    0: '𝟬',
    1: '𝟭',
    2: '𝟮',
    3: '𝟯',
    4: '𝟰',
    5: '𝟱',
    6: '𝟲',
    7: '𝟳',
    8: '𝟴',
    9: '𝟵',
  } as Record<string, string>,
  italic: {
    A: '𝘈',
    B: '𝘉',
    C: '𝘊',
    D: '𝘋',
    E: '𝘌',
    F: '𝘍',
    G: '𝘎',
    H: '𝘏',
    I: '𝘐',
    J: '𝘑',
    K: '𝘒',
    L: '𝘓',
    M: '𝘔',
    N: '𝘕',
    O: '𝘖',
    P: '𝘗',
    Q: '𝘘',
    R: '𝘙',
    S: '𝘚',
    T: '𝘛',
    U: '𝘜',
    V: '𝘝',
    W: '𝘞',
    X: '𝘟',
    Y: '𝘠',
    Z: '𝘡',
    a: '𝘢',
    b: '𝘣',
    c: '𝘤',
    d: '𝘥',
    e: '𝘦',
    f: '𝘧',
    g: '𝘨',
    h: '𝘩',
    i: '𝘪',
    j: '𝘫',
    k: '𝘬',
    l: '𝘭',
    m: '𝘮',
    n: '𝘯',
    o: '𝘰',
    p: '𝘱',
    q: '𝘲',
    r: '𝘳',
    s: '𝘴',
    t: '𝘵',
    u: '𝘶',
    v: '𝘷',
    w: '𝘸',
    x: '𝘹',
    y: '𝘺',
    z: '𝘻',
  } as Record<string, string>,
};

function applyCharStyle(
  char: string,
  style: keyof typeof UNICODE_MAPS
): string {
  return UNICODE_MAPS[style]?.[char] || char;
}

interface LinkedinFormatterState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentJson: Record<string, any> | null;
}
const DEFAULT_STATE: LinkedinFormatterState = {
  contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
};

interface LinkedinPostFormatterClientProps {
  toolRoute: string;
}

export default function LinkedinPostFormatterClient({
  toolRoute,
}: LinkedinPostFormatterClientProps) {
  const { state, setState, isLoadingState, errorLoadingState } =
    useToolState<LinkedinFormatterState>(toolRoute, DEFAULT_STATE);
  const [isCopied, setIsCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEmojiModalOpen, setIsEmojiModalOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        horizontalRule: false,
        codeBlock: false,
        hardBreak: false,
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
      attributes: { class: 'focus:outline-none prose prose-sm max-w-none' },
    },
  });

  useEffect(() => {
    if (editor && !isLoadingState && state.contentJson) {
      const currentContentJsonString = JSON.stringify(editor.getJSON());
      const loadedContentJsonString = JSON.stringify(state.contentJson);
      if (currentContentJsonString !== loadedContentJsonString) {
        editor.commands.setContent(state.contentJson);
      }
    }
  }, [editor, isLoadingState, state.contentJson]);

  const generateUnicodeText = useCallback(() => {
    if (!editor) return '';
    const json = editor.getJSON();
    let result = '';
    let listCounter = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function processContent(content: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content.forEach((node: any, nodeIndex: number) => {
        if (node.type === 'paragraph') {
          if (
            result.length > 0 &&
            !result.endsWith('\n\n') &&
            !result.endsWith('\n• ') &&
            !result.match(/\n\d+\.\s$/)
          ) {
            if (!result.endsWith('\n')) result += '\n';
            result += '\n';
          }
          if (node.content) processContent(node.content);
        } else if (node.type === 'bulletList') {
          if (result.length > 0 && !result.endsWith('\n\n')) {
            if (!result.endsWith('\n')) result += '\n';
            result += '\n';
          }
          if (node.content) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            node.content.forEach((listItem: any) => {
              result += '• ';
              if (listItem.content) processContent(listItem.content);
              if (!result.endsWith('\n')) result += '\n';
            });
          }
          if (nodeIndex < content.length - 1) result += '\n';
        } else if (node.type === 'orderedList') {
          if (result.length > 0 && !result.endsWith('\n\n')) {
            if (!result.endsWith('\n')) result += '\n';
            result += '\n';
          }
          listCounter = 1;
          if (node.content) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            node.content.forEach((listItem: any) => {
              result += `${listCounter}. `;
              if (listItem.content) processContent(listItem.content);
              if (!result.endsWith('\n')) result += '\n';
              listCounter++;
            });
          }
          if (nodeIndex < content.length - 1) result += '\n';
        } else if (node.type === 'text' && node.text) {
          let styledText = node.text;
          if (node.marks) {
            let isBold = false;
            let isItalic = false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            node.marks.forEach((mark: any) => {
              if (mark.type === 'bold') isBold = true;
              if (mark.type === 'italic') isItalic = true;
            });
            styledText = styledText
              .split('')
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((char: any) => {
                let tempChar = char;

                if (isItalic) tempChar = applyCharStyle(tempChar, 'italic');
                if (isBold) tempChar = applyCharStyle(tempChar, 'bold');
                return tempChar;
              })
              .join('');
          }
          result += styledText;
        } else if (node.content) {
          processContent(node.content);
        }
      });
    }

    if (json.content) {
      processContent(json.content);
    }

    const cleanedResult = result.replace(/\n{3,}/g, '\n\n').trim();
    return cleanedResult;
  }, [editor]);

  const handleCopy = useCallback(async () => {
    if (!editor) return;
    const textToCopy = generateUnicodeText();
    if (!textToCopy) {
      setActionError('Nothing to copy.');
      return;
    }
    setActionError(null);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setActionError(`Could not copy text: ${message}`);
    }
  }, [editor, generateUnicodeText]);

  const handleClear = useCallback(async () => {
    editor?.commands.clearContent(true);
    setActionError(null);
    setIsCopied(false);
  }, [editor]);

  const toggleBold = useCallback(
    () => editor?.chain().focus().toggleBold().run(),
    [editor]
  );
  const toggleItalic = useCallback(
    () => editor?.chain().focus().toggleItalic().run(),
    [editor]
  );
  const toggleUnderline = useCallback(
    () => editor?.chain().focus().toggleUnderline().run(),
    [editor]
  );
  const toggleStrike = useCallback(
    () => editor?.chain().focus().toggleStrike().run(),
    [editor]
  );
  const toggleBulletList = useCallback(
    () => editor?.chain().focus().toggleBulletList().run(),
    [editor]
  );
  const toggleOrderedList = useCallback(
    () => editor?.chain().focus().toggleOrderedList().run(),
    [editor]
  );
  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      if (editor && emoji) {
        editor.chain().focus().insertContent(emoji).run();
      }
      setIsEmojiModalOpen(false);
    },
    [editor]
  );

  if (isLoadingState && !editor) {
    /* ... loading UI ... */ return (
      <div className="text-center p-4 text-[rgb(var(--color-text-muted))] italic animate-pulse">
        Loading Editor...
      </div>
    );
  }
  if (errorLoadingState) {
    /* ... error UI ... */ return (
      <div className="p-4 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-status-error))] rounded">
        Error loading saved state: {errorLoadingState}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar - no changes needed */}
      <div className="flex flex-wrap gap-1">
        <Button
          onClick={toggleBold}
          variant={
            editor?.isActive('bold') ? 'primary-outline' : 'neutral-outline'
          }
          size="sm"
          title="Bold"
          disabled={!editor?.can().toggleBold()}
        >
          <b className="text-lg">B</b>
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
          <i className="text-lg">I</i>
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
          <u className="text-lg">U</u>
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
          <s className="text-lg">S</s>
        </Button>
        <div className="border-l border-[rgb(var(--color-border-soft))] mx-1 h-6 self-center"></div>
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
          <ListBulletIcon className="h-4 w-4" />
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
          <Bars3BottomLeftIcon className="h-4 w-4" />
        </Button>
        <div className="border-l border-[rgb(var(--color-border-soft))] mx-1 h-6 self-center"></div>
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

      {/* Editor Content Area - no changes needed */}
      <div
        className="border border-[rgb(var(--color-input-border))] rounded-md shadow-sm p-3 min-h-[200px] focus-within:border-[rgb(var(--color-input-focus-border))] bg-white cursor-text flex flex-col"
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none outline-none flex-grow"
        />
      </div>

      {/* Action Buttons & Persistence - no changes needed */}
      <div className="flex flex-wrap items-center justify-end gap-4 pt-3 border-t border-[rgb(var(--color-border-base))]">
        <div className="flex gap-2">
          <Button
            variant="accent2"
            onClick={handleCopy}
            disabled={!editor?.getText().trim()}
            iconLeft={
              isCopied ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                <ClipboardDocumentIcon className="h-5 w-5" />
              )
            }
          >
            Copy
          </Button>
          <Button
            variant="neutral"
            onClick={handleClear}
            disabled={!editor?.getText().trim()}
            iconLeft={<XCircleIcon className="h-5 w-5" />}
          >
            Clear
          </Button>
        </div>
        {actionError && (
          <p className="text-xs text-[rgb(var(--color-status-error))] flex items-center gap-1">
            <XCircleIcon className="h-4 w-4 inline-block" aria-hidden="true" />
            {actionError}
          </p>
        )}
      </div>
      <EmojiExplorerModal
        isOpen={isEmojiModalOpen}
        onClose={() => setIsEmojiModalOpen(false)}
        onEmojiCopied={handleEmojiSelect}
      />
    </div>
  );
}
