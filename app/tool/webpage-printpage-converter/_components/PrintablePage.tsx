import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';

interface PrintablePageProps {
  title: string;
  content: string;
}

const PrintablePage: React.FC<PrintablePageProps> = ({ title, content }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // We don't need all the starter kit features for this simple display
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        listItem: false,
        orderedList: false,
        bulletList: false,
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
    ],
    content: content,
    editable: true,
  });

  return (
    <div className="printable-section mb-8 p-6 border border-[rgb(var(--color-border-soft))] rounded-lg bg-white shadow-md">
      <h2 className="text-2xl font-bold mb-4 border-b border-[rgb(var(--color-border-base))] pb-2">{title}</h2>
      <EditorContent editor={editor} className="prose max-w-none" />
    </div>
  );
};

export default PrintablePage;