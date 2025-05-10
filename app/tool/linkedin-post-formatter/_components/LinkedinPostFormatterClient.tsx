// --- FILE: app/tool/linkedin-post-formatter/_components/LinkedinPostFormatterClient.tsx ---
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent, Node } from '@tiptap/react'; // Added Node
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

// --- Unicode Character Maps (Example - these would be extensive) ---
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
    // Italic numbers are less common and might not render well everywhere
  } as Record<string, string>,
  // Add more maps: boldItalic, script, monospace if needed
};

function applyCharStyle(
  char: string,
  style: keyof typeof UNICODE_MAPS
): string {
  return UNICODE_MAPS[style]?.[char] || char;
}

function convertNodeToUnicode(
  node: any,
  listLevel = 0,
  listItemCounter = 1
): string {
  let text = '';
  if (node.type === 'text' && node.text) {
    let currentText = node.text;
    if (node.marks) {
      // Apply marks - a simple approach, nesting complex styles might need more logic
      let isBold = false;
      let isItalic = false;
      node.marks.forEach((mark: any) => {
        if (mark.type === 'bold') isBold = true;
        if (mark.type === 'italic') isItalic = true;
        // TODO: handle underline and strike if desired (e.g., with combining characters)
      });

      currentText = currentText
        .split('')
        .map((char) => {
          let styledChar = char;
          if (isItalic) styledChar = applyCharStyle(styledChar, 'italic'); // Apply italic first then bold for boldItalic visual
          if (isBold) styledChar = applyCharStyle(styledChar, 'bold');
          return styledChar;
        })
        .join('');
    }
    text += currentText;
  }

  if (node.content) {
    node.content.forEach((childNode: any, index: number) => {
      text += convertNodeToUnicode(childNode, listLevel, index + 1);
    });
  }

  // Add newlines or list prefixes based on block type
  if (node.type === 'paragraph') {
    text += '\n\n'; // LinkedIn prefers double newlines for paragraph breaks
  } else if (node.type === 'listItem') {
    // This is simplified. Real list handling requires knowing parent type.
    // For this pass, we assume bullet for bulletList, number for orderedList from parent context
    // This prefixing should ideally happen *before* processing child content for proper indentation
    // Will be handled in the main traversal.
    text += '\n';
  }
  return text;
}

// --- State Definition ---
interface LinkedinFormatterState {
  contentJson: Record<string, any> | null;
}
const DEFAULT_STATE: LinkedinFormatterState = {
  contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
};

interface LinkedinPostFormatterClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function LinkedinPostFormatterClient({
  toolTitle,
  toolRoute,
}: LinkedinPostFormatterClientProps) {
  const {
    state,
    setState,
    isLoadingState,
    isPersistent,
    togglePersistence,
    errorLoadingState,
  } = useToolState<LinkedinFormatterState>(toolRoute, DEFAULT_STATE);
  const { addHistoryEntry } = useHistory();
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
        editor.commands.setContent(state.contentJson, false);
      }
    }
  }, [editor, isLoadingState, state.contentJson]);

  const generateUnicodeText = useCallback(() => {
    if (!editor) return '';
    const json = editor.getJSON();
    let result = '';
    let listCounter = 1;

    function processContent(content: any[]) {
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
            // Underline and strike are typically not converted to Unicode for LinkedIn
            node.marks.forEach((mark: any) => {
              if (mark.type === 'bold') isBold = true;
              if (mark.type === 'italic') isItalic = true;
            });
            styledText = styledText
              .split('')
              .map((char: any) => {
                let tempChar = char;
                // Apply italic first, then bold, so bold italic is BOLD(ITALIC(char))
                if (isItalic) tempChar = applyCharStyle(tempChar, 'italic');
                if (isBold) tempChar = applyCharStyle(tempChar, 'bold');
                return tempChar;
              })
              .join('');
          }
          result += styledText;
        } else if (node.content) {
          // For other block types that might have content
          processContent(node.content);
        }
      });
    }

    if (json.content) {
      processContent(json.content);
    }
    // Normalize newlines: reduce 3+ newlines to 2, ensure single paragraphs are followed by double.
    // This is a common LinkedIn formatting practice.
    let cleanedResult = result.replace(/\n{3,}/g, '\n\n').trim();
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
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: 'click',
        input: { action: 'copy', characterCount: textToCopy.length },
        output: { message: `Copied ${textToCopy.length} characters.` },
        status: 'success',
        eventTimestamp: Date.now(),
      });
    } catch (err) {
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
      });
    }
  }, [editor, addHistoryEntry, toolRoute, toolTitle, generateUnicodeText]);

  const handleClear = useCallback(async () => {
    // ... (handleClear logic as before, no changes needed to it for Unicode)
    const hadContent = editor && editor.getText().length > 0;
    editor?.commands.clearContent(true);
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
      });
    }
  }, [editor, addHistoryEntry, toolRoute, toolTitle]);

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
      // ... (handleEmojiSelect logic as before)
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
        });
      }
      setIsEmojiModalOpen(false);
    },
    [editor, addHistoryEntry, toolTitle, toolRoute]
  );

  if (isLoadingState && !editor) {
    /* ... loading UI ... */ return (
      <div className="text-center p-4 text-gray-500 italic animate-pulse">
        Loading Editor...
      </div>
    );
  }
  if (errorLoadingState) {
    /* ... error UI ... */ return (
      <div className="p-4 bg-red-100 border border-red-300 text-red-700 rounded">
        Error loading saved state: {errorLoadingState}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar - no changes needed */}
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

      {/* Editor Content Area - no changes needed */}
      <div
        className="border border-[rgb(var(--color-input-border))] rounded-md shadow-sm p-3 min-h-[200px] focus-within:border-[rgb(var(--color-input-focus-border))] focus-within:ring-1 focus-within:ring-[rgb(var(--color-input-focus-border))] bg-white cursor-text flex flex-col"
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none outline-none flex-grow"
        />
      </div>

      {/* Action Buttons & Persistence - no changes needed */}
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
