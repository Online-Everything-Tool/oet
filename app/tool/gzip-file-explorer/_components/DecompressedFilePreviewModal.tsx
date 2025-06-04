import React, { useEffect } from 'react';
import Image from 'next/image';
import Button from '../../_components/form/Button';
import { XCircleIcon } from '@heroicons/react/24/solid';

interface DecompressedFilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string | null;
  previewContentUrlOrText: string | null;
  previewType: 'text' | 'image' | 'unsupported' | 'loading' | null;
  error: string | null;
}

const MAX_TEXT_PREVIEW_SIZE_DISPLAY = 1024 * 100; // 100KB

const DecompressedFilePreviewModal: React.FC<DecompressedFilePreviewModalProps> = ({
  isOpen,
  onClose,
  fileName,
  previewContentUrlOrText,
  previewType,
  error,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  let contentNode: React.ReactNode;
  if (error) {
    contentNode = <div role="alert" className="p-3 bg-red-50 text-red-700 rounded text-sm"><strong className="font-semibold">Error:</strong> {error}</div>;
  } else if (previewType === 'loading') {
    contentNode = <p className="text-center animate-pulse text-[rgb(var(--color-text-muted))]">Loading preview...</p>;
  } else if (previewType === 'text' && previewContentUrlOrText) {
    const displayText = previewContentUrlOrText.length > MAX_TEXT_PREVIEW_SIZE_DISPLAY 
      ? previewContentUrlOrText.substring(0, MAX_TEXT_PREVIEW_SIZE_DISPLAY) + "\n\n--- Content truncated ---"
      : previewContentUrlOrText;
    contentNode = <pre className="text-sm whitespace-pre-wrap break-words max-h-[calc(80vh-120px)] overflow-auto p-1 bg-[rgb(var(--color-bg-subtle))] rounded"><code>{displayText}</code></pre>;
  } else if (previewType === 'image' && previewContentUrlOrText) {
    contentNode = (
      <div className="flex justify-center items-center h-full max-h-[calc(80vh-120px)]">
        <Image
          src={previewContentUrlOrText}
          alt={fileName || 'Image Preview'}
          width={800}
          height={600}
          className="max-w-full max-h-full object-contain"
          unoptimized
        />
      </div>
    );
  } else if (previewType === 'unsupported') {
    contentNode = <p className="text-center text-[rgb(var(--color-text-muted))]">Preview not available for this file type.</p>;
  } else {
    contentNode = <p className="text-center text-[rgb(var(--color-text-muted))]">No content to display.</p>;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
    >
      <div
        className="bg-[rgb(var(--color-bg-component))] rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 px-4 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center bg-[rgb(var(--color-bg-subtle))] rounded-t-lg">
          <h3 id="preview-modal-title" className="text-lg font-semibold text-[rgb(var(--color-text-base))] truncate" title={fileName || ''}>
            {fileName || 'Preview'}
          </h3>
          <Button variant="link" onClick={onClose} className="!p-1">
            <XCircleIcon className="h-6 w-6 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-base))]" />
          </Button>
        </div>
        <div className="p-4 overflow-auto flex-grow min-h-[200px]">
          {contentNode}
        </div>
      </div>
    </div>
  );
};

export default DecompressedFilePreviewModal;