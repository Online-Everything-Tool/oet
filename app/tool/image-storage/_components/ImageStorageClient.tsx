// FILE: app/tool/image-storage/_components/ImageStorageClient.tsx
'use client';

import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useHistory, TriggerType } from '../../../context/HistoryContext';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import type { StoredFile } from '@/src/types/storage';
import FileDropZone from '../../_components/storage/FileDropZone';
import FileGridView from '../../_components/storage/FileGridView';

interface ImageStorageClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function ImageStorageClient({ toolTitle, toolRoute }: ImageStorageClientProps) {
  const [storedImages, setStoredImages] = useState<StoredFile[]>([]);
  const [imageObjectUrls, setImageObjectUrls] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, { type: 'copy' | 'download' | 'error'; message: string } | null>>({});

  const { addHistoryEntry } = useHistory();
  const { addImage, getImage, deleteImage, listImages, clearAllImages } = useImageLibrary();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const managedUrlsRef = useRef<Map<string, string>>(new Map());

  // --- Helper Functions ---
  const setItemFeedback = useCallback((id: string, type: 'copy' | 'download' | 'error' | null, message: string = '') => {
    setFeedbackState(prev => ({ ...prev, [id]: type ? { type, message } : null }));
    if (type && type !== 'error') { setTimeout(() => { setFeedbackState(prev => (prev[id]?.type === type ? { ...prev, [id]: null } : prev)); }, 2000); }
  }, []);

  const revokeManagedUrls = useCallback(() => {
    managedUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    managedUrlsRef.current.clear();
    setImageObjectUrls(new Map());
  }, []);

  const updateObjectUrls = useCallback((images: StoredFile[]) => {
    revokeManagedUrls();
    const newUrlMap = new Map<string, string>();
    images.forEach(img => {
      if (img.id) {
        const blobToUse = img.thumbnailBlob || img.blob;
        if (blobToUse) {
          try { const url = URL.createObjectURL(blobToUse); newUrlMap.set(img.id, url); managedUrlsRef.current.set(img.id, url); }
          catch (e) { console.error(`[ImageStorage] Error creating Object URL for ID ${img.id}:`, e); }
        }
      }
    });
    setImageObjectUrls(newUrlMap);
  }, [revokeManagedUrls]);

  // --- Load images function ---
  const loadAndDisplayImages = useCallback(async (limit = 50) => {
    setError(null);
    setIsLoading(true);
    try { const images = await listImages(limit); setStoredImages(images); updateObjectUrls(images); }
    catch (err: unknown) { console.error('[ImageStorage] Error loading images:', err); setError('Failed to load stored images.'); setStoredImages([]); revokeManagedUrls(); }
    finally { setIsLoading(false); }
  }, [listImages, updateObjectUrls, revokeManagedUrls]);

  useEffect(() => {
    loadAndDisplayImages();
    return () => { revokeManagedUrls(); };
  }, [loadAndDisplayImages, revokeManagedUrls]);

  // --- SAVE IMAGE HELPER ---
  const saveNewImage = useCallback(async (file: File, trigger: TriggerType) => {
    if (!file.type.startsWith('image/')) { setError(`Skipped non-image file: ${file.name}`); return; }
    let historyOutput: string | Record<string, unknown> = ''; let status: 'success' | 'error' = 'success'; let imageId: string | undefined = undefined; const inputDetails: Record<string, unknown> = { fileName: file.name, fileType: file.type, fileSize: file.size, source: trigger };
    try { imageId = await addImage(file, file.name || `image-${Date.now()}`, file.type); historyOutput = { message: `Image "${file.name}" added successfully.`, imageId: imageId }; }
    catch (err) { const message = err instanceof Error ? err.message : 'Unknown error saving image.'; setError(prev => (prev ? `${prev}; Failed to save "${file.name}"` : `Failed to save "${file.name}"`)); status = 'error'; historyOutput = `Error saving "${file.name}": ${message}`; inputDetails.error = message; }
    finally { addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: trigger, input: inputDetails, output: historyOutput, status: status }); }
  }, [addImage, addHistoryEntry, toolTitle, toolRoute]);

   // --- Handler for files added via DropZone or Input ---
   const handleFilesAdded = useCallback(async (files: File[]) => {
       if (!files || files.length === 0) return;
       setError(null); setIsProcessing(true); const trigger: TriggerType = 'upload'; const imageFiles = files.filter(f => f.type.startsWith('image/')); if (imageFiles.length !== files.length) { setError(`Skipped ${files.length - imageFiles.length} non-image file(s).`); } const savePromises = imageFiles.map(file => saveNewImage(file, trigger)); await Promise.all(savePromises);
       // CORRECTED DEPENDENCY USAGE HERE:
       await loadAndDisplayImages();
       setIsProcessing(false);
   }, [saveNewImage, loadAndDisplayImages]); // Corrected dependency list

  // --- Trigger hidden file input ---
  const handleAddClick = () => { fileInputRef.current?.click(); };

  // --- File Input Change Handler ---
  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files; if (files && files.length > 0) { handleFilesAdded(Array.from(files)); } if (event.target) event.target.value = '';
  }, [handleFilesAdded]);

  // --- Delete/Clear Handlers ---
  const handleDeleteSingleImage = useCallback(async (imageId: string) => {
    if (isDeleting) return; setIsDeleting(imageId); setError(null); const imageToDelete = storedImages.find(img => img.id === imageId); const imageName = imageToDelete?.name || `Image ID ${imageId}`;
    try { await deleteImage(imageId); await loadAndDisplayImages(); addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { deletedImageId: imageId, deletedImageName: imageName }, output: { message: `Deleted "${imageName}"` }, status: 'success' }); }
    catch (err) { const message = err instanceof Error ? err.message : 'Unknown error deleting image.'; setError(`Failed to delete "${imageName}". ${message}`); addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { deletedImageId: imageId, error: message }, output: `Error deleting "${imageName}": ${message}`, status: 'error' }); }
    finally { setIsDeleting(null); }
  }, [isDeleting, storedImages, deleteImage, loadAndDisplayImages, addHistoryEntry, toolTitle, toolRoute]);

  const handleClearAll = useCallback(async () => {
    if (isLoading || isProcessing || isDeleting || storedImages.length === 0) return; if (!confirm(`Are you sure you want to delete all ${storedImages.length} stored images? This cannot be undone.`)) return; setError(null); setIsLoading(true); const count = storedImages.length;
    try { await clearAllImages(); setStoredImages([]); revokeManagedUrls(); addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { clearAllCount: count }, output: `Cleared all ${count} images.`, status: 'success' }); }
    catch (err) { const message = err instanceof Error ? err.message : 'Unknown error clearing images.'; setError(`Failed to clear all images. ${message}`); addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { clearAllCount: count, error: message }, output: `Error clearing images: ${message}`, status: 'error' }); }
    finally { setIsLoading(false); }
  }, [isLoading, isProcessing, isDeleting, storedImages.length, clearAllImages, revokeManagedUrls, addHistoryEntry, toolTitle, toolRoute]);

  // --- Action Handlers (Copy/Download/SendTo) ---
   const handleCopyImage = useCallback(async (imageId: string) => {
    setError(null); setItemFeedback(imageId, null); try { const image = await getImage(imageId); if (!image?.blob) throw new Error("Image data not found."); if (!navigator.clipboard?.write) throw new Error("Clipboard API not available."); const clipboardItem = new ClipboardItem({ [image.blob.type]: image.blob }); await navigator.clipboard.write([clipboardItem]); setItemFeedback(imageId, 'copy', 'Copied!'); } catch (err) { const message = err instanceof Error ? err.message : 'Unknown copy error.'; setItemFeedback(imageId, 'error', `Copy failed: ${message}`); }
  }, [getImage, setItemFeedback]);

  const handleDownloadImage = useCallback(async (imageId: string) => {
     setError(null); setItemFeedback(imageId, null); try { const image = await getImage(imageId); if (!image?.blob) throw new Error("Image data not found."); const url = URL.createObjectURL(image.blob); const link = document.createElement('a'); link.href = url; link.download = image.name || `image-${imageId}.${image.blob.type.split('/')[1] || 'png'}`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); setItemFeedback(imageId, 'download', 'Downloaded!'); } catch (err) { const message = err instanceof Error ? err.message : 'Unknown download error.'; setItemFeedback(imageId, 'error', `Download failed: ${message}`); }
  }, [getImage, setItemFeedback]);

  const handleSendTo = useCallback((imageId: string) => { alert(`"Send To" clicked for image ID: ${imageId}. (Not Implemented)`); console.log("Send To clicked for:", imageId); }, []);

   // --- Custom Preview Renderer for FileGridView ---
   const renderImagePreview = useCallback((file: StoredFile): React.ReactNode => {
       const objectUrl = imageObjectUrls.get(file.id); if (objectUrl) { return ( <Image src={objectUrl} alt={file.name || 'Stored image'} width={150} height={150} className="max-w-full max-h-full object-contain" unoptimized={true} /> ); } return <span className="text-xs text-gray-400 italic p-1">Loading...</span>;
   }, [imageObjectUrls]);

  // --- Render Logic ---
  const showLoading = isLoading && storedImages.length === 0;
  const showEmpty = !isLoading && storedImages.length === 0;

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">

      <input ref={fileInputRef} id="imageUploadHidden" type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={isProcessing} multiple />

      <div className="flex flex-wrap gap-4 items-center justify-between p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
            <button type="button" onClick={handleAddClick} disabled={isProcessing} className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgb(var(--color-button-accent2-bg))] transition-colors duration-150 ease-in-out ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                 <span>➕</span> {isProcessing ? 'Processing...' : 'Add Image(s)'}
            </button>
            <button type="button" onClick={handleClearAll} disabled={storedImages.length === 0 || isLoading || isProcessing || isDeleting !== null} className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                 <span>🗑️</span> Clear All Images
             </button>
       </div>

      {error && ( <div role="alert" className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm"> <strong>Error:</strong> {error} </div> )}

      <FileDropZone onFilesAdded={handleFilesAdded} isLoading={isProcessing} className="min-h-[300px]">
        {showLoading && ( <p className="text-center p-4 text-gray-500 italic animate-pulse">Loading Stored Images...</p> )}

        {showEmpty ? null : (
            <FileGridView
                files={storedImages}
                isLoading={isLoading || isProcessing}
                isDeleting={isDeleting}
                feedbackState={feedbackState}
                onSendTo={handleSendTo}
                onCopy={handleCopyImage}
                onDownload={handleDownloadImage}
                onDelete={handleDeleteSingleImage}
                renderPreview={renderImagePreview}
            />
        )}

      </FileDropZone>

    </div>
  );
}