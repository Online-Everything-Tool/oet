import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Button from '../../_components/form/Button';
import { XCircleIcon } from '@heroicons/react/24/outline';
import { isTextBasedMimeType } from '@/app/lib/utils';

interface DecompressedFilePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  fileBlob: Blob | null;
  fileName: string | null;
  fileMimeType: string | null;
}

const MAX_TEXT_PREVIEW_SIZE_BYTES = 1024 * 100; // 100KB

export default function DecompressedFilePreview({
  isOpen,
  onClose,
  fileBlob,
  fileName,
  fileMimeType,
}: DecompressedFilePreviewProps) {
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);

  const previewType = useMemo(() => {
    if (!fileMimeType) return 'unsupported';
    if (isTextBasedMimeType(fileMimeType)) return 'text';
    if (fileMimeType.startsWith('image/')) return 'image';
    return 'unsupported';
  }, [fileMimeType]);

  useEffect(() => {
    if (!isOpen || !fileBlob || !fileMimeType) {
      setPreviewContent(null);
      setPreviewError(null);
      setIsLoadingPreview(false);
      return;
    }

    let objectUrl: string | null = null;
    setIsLoadingPreview(true);
    setPreviewError(null);
    setPreviewContent(null);

    const loadPreview = async () => {
      try {
        if (previewType === 'text') {
          let text = await fileBlob.text();
          if (fileBlob.size > MAX_TEXT_PREVIEW_SIZE_BYTES) {
            text = text.substring(0, MAX_TEXT_PREVIEW_SIZE_BYTES / 2) + // Approx, due to multi-byte chars
                   `\n\n--- Content truncated (displaying first ~${MAX_TEXT_PREVIEW_SIZE_BYTES/1024}KB) ---`;
          }
          setPreviewContent(text);
        } else if (previewType === 'image') {
          objectUrl = URL.createObjectURL(fileBlob);
          setPreviewContent(objectUrl);
        } else {
          setPreviewContent(null); // Handled by 'unsupported' message
        }
      } catch (err) {
        setPreviewError(`Failed to load preview: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setPreviewContent(null);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    loadPreview();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isOpen, fileBlob, fileMimeType, previewType]);

  if (!isOpen) {
    return null;
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
          <h3
            id="preview-modal-title"
            className="text-lg font-semibold text-[rgb(var(--color-text-base))] truncate"
            title={fileName || 'File Preview'}
          >
            {fileName || 'File Preview'}
          </h3>
          <Button variant="link" onClick={onClose} className="!p-1">
            <XCircleIcon className="h-6 w-6 text-gray-500 hover:text-gray-700" />
          </Button>
        </div>
        <div className="p-4 overflow-auto flex-grow min-h-[200px]">
          {isLoadingPreview && (
            <p className="text-center text-[rgb(var(--color-text-muted))] animate-pulse">Loading preview...</p>
          )}
          {previewError && (
            <div role="alert" className="p-2 bg-[rgb(var(--color-bg-error-subtle))] text-[rgb(var(--color-text-error))] rounded text-sm">
              <strong className="font-semibold">Error:</strong> {previewError}
            </div>
          )}
          {!isLoadingPreview && !previewError && (
            <>
              {previewType === 'text' && previewContent && (
                <pre className="text-sm whitespace-pre-wrap break-words max-h-[calc(90vh-120px)] overflow-auto bg-[rgb(var(--color-bg-page))] p-2 rounded border border-[rgb(var(--color-border-base))]">
                  <code>{previewContent}</code>
                </pre>
              )}
              {previewType === 'image' && previewContent && (
                <div className="flex justify-center items-center h-full max-h-[calc(90vh-120px)]">
                  <Image
                    src={previewContent}
                    alt={fileName || 'Image Preview'}
                    width={800}
                    height={600}
                    className="max-w-full max-h-full object-contain"
                    onError={() => setPreviewError('Failed to load image resource.')}
                    unoptimized
                  />
                </div>
              )}
              {previewType === 'unsupported' && (
                <p className="text-center text-[rgb(var(--color-text-muted))]">
                  Preview not available for this file type ({fileMimeType || 'unknown'}).
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}