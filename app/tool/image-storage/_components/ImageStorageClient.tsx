// FILE: app/tool/image-storage/_components/ImageStorageClient.tsx
'use client';

import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useHistory } from '../../../context/HistoryContext';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import { type LibraryImage } from '@/app/lib/db';

interface ImageStorageClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function ImageStorageClient({ toolTitle, toolRoute }: ImageStorageClientProps) {
  const [storedImagesMetadata, setStoredImagesMetadata] = useState<LibraryImage[]>([]);
  const [imageObjectUrls, setImageObjectUrls] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, { type: 'copy' | 'download' | 'error'; message: string } | null>>({});
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());

  const { addHistoryEntry } = useHistory();
  const { addImage, getImage, deleteImage, listImages, clearAllImages } = useImageLibrary();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const managedUrlsRef = useRef<Map<string, string>>(new Map());

  // --- Helper Functions (setItemFeedback, revokeManagedUrls, updateObjectUrls) ---
  const setItemFeedback = useCallback((id: string, type: 'copy' | 'download' | 'error' | null, message: string = '') => {
    setFeedbackState(prev => ({ ...prev, [id]: type ? { type, message } : null }));
    if (type && type !== 'error') {
      setTimeout(() => {
        setFeedbackState(prev => (prev[id]?.type === type ? { ...prev, [id]: null } : prev));
      }, 2000);
    }
  }, []);

  const revokeManagedUrls = useCallback(() => {
    managedUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    managedUrlsRef.current.clear();
  }, []);

  const updateObjectUrls = useCallback((images: LibraryImage[]) => {
    revokeManagedUrls();
    const newUrlMap = new Map<string, string>();
    images.forEach(img => {
      if (img.id && typeof img.id === 'string') {
        const blobToUse = img.thumbnailBlob || img.blob;
        if (blobToUse) {
            try {
                const url = URL.createObjectURL(blobToUse);
                newUrlMap.set(img.id, url);
                managedUrlsRef.current.set(img.id, url);
            } catch (e) { console.error(`[ImageStorage] Error creating Object URL for ID ${img.id}:`, e); }
        }
      }
    });
    setImageObjectUrls(newUrlMap);
  }, [revokeManagedUrls]);

  // --- loadAndDisplayImages ---
  const loadAndDisplayImages = useCallback(async (limit = 20) => {
    setError(null);
    setIsLoading(prev => prev === false ? false : true);
    try {
      const images = await listImages(limit);
      const validImages = images.filter(img => typeof img.id === 'string');
      if (validImages.length !== images.length) {
          console.warn("[ImageStorage] Some images returned from listImages had invalid/missing IDs.");
      }
      setStoredImagesMetadata(validImages);
      updateObjectUrls(validImages);
    } catch (err: unknown) {
      console.error('[ImageStorage] Error in loadAndDisplayImages:', err);
      setError('Failed to load stored images.');
      setStoredImagesMetadata([]);
      revokeManagedUrls();
    } finally {
      setIsLoading(false);
    }
  }, [listImages, updateObjectUrls, revokeManagedUrls]);

  // --- Initial Load useEffect ---
  useEffect(() => {
    loadAndDisplayImages();
    return () => {
        revokeManagedUrls();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- saveNewImage ---
  const saveNewImage = useCallback(async (blob: Blob, name: string, type: string, trigger: 'upload' | 'transfer') => {
    const inputDetails: Record<string, unknown> = { fileName: name, fileType: type, fileSize: blob.size, source: trigger };
    let historyOutput: string | Record<string, unknown> = '';
    let status: 'success' | 'error' = 'success';
    let imageId: string | undefined = undefined;

    try {
      imageId = await addImage(blob, name, type);
      historyOutput = { message: `Image "${name}" added successfully.`, imageId: imageId };
      await loadAndDisplayImages();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error saving image.';
      console.error(`Error saving image "${name}":`, err);
      setError(`Failed to save image "${name}". ${message}`);
      status = 'error';
      historyOutput = `Error saving "${name}": ${message}`;
      inputDetails.error = message;
    }

    addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: trigger, input: inputDetails, output: historyOutput, status: status, });
  }, [addImage, loadAndDisplayImages, addHistoryEntry, toolTitle, toolRoute]);

  // --- handleFileChange ---
  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    const promises: Promise<void>[] = [];
    const addedFileNames: string[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        addedFileNames.push(file.name);
        promises.push(saveNewImage(file, file.name || `uploaded-image-${Date.now()}`, file.type, 'upload'));
      } else {
        console.warn(`Skipping non-image file: ${file.name}`);
        setError(prev => (prev ? prev + `; Skipped non-image file: ${file.name}` : `Skipped non-image file: ${file.name}`));
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [saveNewImage]);

  // --- handlePaste (Hardened & Corrected) ---
  const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLDivElement>) => {
    setError(null);
    setIsPasting(true);
    const items = event.clipboardData?.items;
    const promises: Promise<void>[] = [];
    let foundImage = false;

    if (!items) {
        setError('Clipboard data is not accessible.');
        setIsPasting(false);
        return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // Only process items explicitly marked as 'file' by the browser
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const blob = item.getAsFile(); // Standard method
        if (blob) { // Check if getAsFile() succeeded
          foundImage = true;
          promises.push(saveNewImage(blob, blob.name || `pasted-image-${Date.now()}`, blob.type, 'upload'));
        } else {
            // If getAsFile() returned null, log it but don't try getAsBlob()
            console.warn(`[ImageStorage] item.getAsFile() returned null for item type ${item.type}. Skipping this item.`);
        }
      }
    }

    if (!foundImage && items.length > 0) {
       // Updated error message
       setError('Could not find usable image file data in the clipboard. Please try copying an image file directly.');
    } else if (!foundImage) {
       setError('No items found in clipboard.');
    }

    try {
        await Promise.all(promises);
    } catch (e) {
        console.error("Error processing pasted images:", e);
        setError("An error occurred while processing pasted images.");
    } finally {
        setIsPasting(false);
    }
  }, [saveNewImage]);

  // --- Other handlers (Delete, Clear, Copy, Download, SendTo, Click) ---
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeleteSingleImage = useCallback(async (imageId: string) => {
    if (isDeleting) return;
    setIsDeleting(imageId);
    setError(null);
    const imageToDelete = storedImagesMetadata.find(img => img.id === imageId);
    const imageName = imageToDelete?.name || `Image ID ${imageId}`;
    try {
      await deleteImage(imageId);
      setSelectedImageIds(prev => { const newSet = new Set(prev); newSet.delete(imageId); return newSet; });
      await loadAndDisplayImages();
      addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { deletedImageId: imageId, deletedImageName: imageName }, output: { message: `Deleted "${imageName}"` }, status: 'success', });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error deleting image.';
      console.error(`Error deleting image ${imageId}:`, err);
      setError(`Failed to delete "${imageName}". ${message}`);
      addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { deletedImageId: imageId, error: message }, output: `Error deleting "${imageName}": ${message}`, status: 'error', });
    } finally {
      setIsDeleting(null);
    }
  }, [deleteImage, addHistoryEntry, toolTitle, toolRoute, loadAndDisplayImages, isDeleting, storedImagesMetadata]);

  const handleClearAll = useCallback(async () => {
    if (isLoading || isDeleting || storedImagesMetadata.length === 0) return;
    if (!confirm(`Are you sure you want to delete all ${storedImagesMetadata.length} stored images? This cannot be undone.`)) { return; }
    setError(null);
    setIsLoading(true);
    const count = storedImagesMetadata.length;
    try {
        await clearAllImages();
        setStoredImagesMetadata([]);
        revokeManagedUrls();
        setImageObjectUrls(new Map());
        setSelectedImageIds(new Set());
        addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { clearAllCount: count }, output: `Cleared all ${count} images.`, status: 'success', });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error clearing images.';
        console.error("Error clearing all images:", err);
        setError(`Failed to clear all images. ${message}`);
         addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { clearAllCount: count, error: message }, output: `Error clearing images: ${message}`, status: 'error', });
    } finally {
        setIsLoading(false);
    }
  }, [clearAllImages, revokeManagedUrls, addHistoryEntry, toolTitle, toolRoute, storedImagesMetadata.length, isLoading, isDeleting]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCopyImage = useCallback(async (imageId: string) => {
    setError(null); setItemFeedback(imageId, null);
    try {
      const image = await getImage(imageId);
      if (!image?.blob) throw new Error("Image data not found.");
      if (!navigator.clipboard?.write) throw new Error("Clipboard API not available.");
      const clipboardItem = new ClipboardItem({ [image.blob.type]: image.blob });
      await navigator.clipboard.write([clipboardItem]);
      setItemFeedback(imageId, 'copy', 'Copied!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown copy error.';
      console.error(`Failed to copy image ${imageId}:`, err);
      setItemFeedback(imageId, 'error', `Copy failed: ${message}`);
    }
  }, [getImage, setItemFeedback]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDownloadImage = useCallback(async (imageId: string) => {
     setError(null); setItemFeedback(imageId, null);
     try {
        const image = await getImage(imageId);
        if (!image?.blob) throw new Error("Image data not found.");
        const url = URL.createObjectURL(image.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = image.name || `image-${imageId}.${image.blob.type.split('/')[1] || 'png'}`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setItemFeedback(imageId, 'download', 'Downloaded!');
     } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown download error.';
        console.error(`Failed to download image ${imageId}:`, err);
        setItemFeedback(imageId, 'error', `Download failed: ${message}`);
     }
  }, [getImage, setItemFeedback]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSendTo = useCallback((imageId: string) => {
    alert(`"Send To" clicked for image ID: ${imageId}. \nSelected IDs: ${Array.from(selectedImageIds).join(', ')}`);
    console.log("Send To clicked for:", imageId, "Current selection:", selectedImageIds);
  }, [selectedImageIds]);

  const handleImageClick = useCallback((imageId: string) => {
     setSelectedImageIds(prevIds => {
         const newSet = new Set(prevIds);
         if (newSet.has(imageId)) { newSet.delete(imageId); }
         else { newSet.add(imageId); }
         return newSet;
     });
  }, []);

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      {/* Controls */}
      <div className="flex flex-col gap-4 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="flex flex-wrap gap-4 items-center">
            <label htmlFor="imageUpload" className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out ${isLoading || isPasting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {isLoading ? 'Loading...' : (isPasting ? 'Pasting...' : ('Add Image(s)'))}
            </label>
            <input ref={fileInputRef} id="imageUpload" type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={isLoading || isPasting} multiple/>
            {selectedImageIds.size > 0 && ( <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full ml-auto sm:ml-0"> {selectedImageIds.size} Selected </span> )}
            <button type="button" onClick={handleClearAll} disabled={storedImagesMetadata.length === 0 || isLoading || isPasting || isDeleting !== null} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ml-auto"> Clear All Images </button>
        </div>
      </div>

      {/* Persistent Hint */}
      <p className="text-xs text-center text-[rgb(var(--color-text-muted))] -mt-3"> Tip: You can paste images directly into the area below. </p>

      {/* Error Display */}
      {error && ( <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"> {/* Error SVG and text */} </div> )}

      {/* Image Gallery / Paste Area */}
      <div
        onPaste={handlePaste}
        className={`w-full min-h-[300px] p-4 border-2 border-dashed rounded-lg flex flex-col items-center text-center transition-colors duration-200 overflow-y-auto group/pastearea relative ${ isPasting ? 'border-blue-500 bg-blue-50' : 'border-[rgb(var(--color-border-base))] hover:border-blue-400 hover:bg-[rgba(var(--color-bg-subtle)/0.5)]' } bg-[rgb(var(--color-bg-component))]`}
        aria-label="Image gallery and paste area" tabIndex={0} >

        {/* Loading State */}
        {isLoading && storedImagesMetadata.length === 0 && ( <p className="text-lg text-[rgb(var(--color-text-link))] animate-pulse">Loading Stored Images...</p> )}

        {/* Image Grid */}
        {( !isLoading || (isLoading && storedImagesMetadata.length > 0) ) && storedImagesMetadata.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 w-full relative z-0">
            {storedImagesMetadata.map((meta) => {
              const objectUrl = meta.id ? imageObjectUrls.get(meta.id) : null;
              const isThisDeleting = isDeleting === meta.id;
              const isSelected = meta.id ? selectedImageIds.has(meta.id) : false;

              return (
                 <div
                   key={meta.id}
                   onClick={() => meta.id && handleImageClick(meta.id)}
                   className={`relative group border rounded-md shadow-sm overflow-hidden bg-white p-2 flex flex-col items-center gap-1 transition-all duration-150 ease-in-out cursor-pointer ${ isThisDeleting ? 'opacity-50 animate-pulse' : '' } ${ isSelected ? 'border-blue-500 ring-2 ring-blue-500 ring-offset-1' : 'border-transparent hover:border-gray-300' }`}
                   role="button" tabIndex={0} aria-pressed={isSelected}
                   onKeyDown={(e) => { if(meta.id && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleImageClick(meta.id); }}}
                  >
                   <div className="aspect-square w-full flex items-center justify-center bg-gray-100 rounded overflow-hidden pointer-events-none">
                      {objectUrl ? ( <Image src={objectUrl} alt={meta.name || 'Stored image'} width={150} height={150} className="max-w-full max-h-full object-contain" unoptimized={true}/> ) : ( <span className="text-xs text-gray-400 italic p-1">Loading...</span> )}
                   </div>
                   <p className="text-xs text-[rgb(var(--color-text-muted))] truncate w-full pointer-events-none" title={meta.name}> {meta.name || 'Untitled'} </p>
                   <p className="text-[10px] text-gray-400 w-full text-left break-all pointer-events-none"> ID: {meta.id} </p>
                   <div className="absolute top-1 right-1 z-10 flex gap-1 bg-white bg-opacity-80 rounded p-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} >
                       {/* Buttons... */}
                   </div>
                   {isThisDeleting && ( <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center pointer-events-none"> <span className="text-white text-xs">Deleting...</span> </div> )}
                   {feedbackState[meta.id ?? '']?.type === 'error' && ( <div className="absolute inset-x-0 bottom-0 p-1 bg-red-700 text-white text-[10px] text-center truncate pointer-events-none" title={feedbackState[meta.id ?? '']?.message}>{feedbackState[meta.id ?? '']?.message}</div> )}
                   {isSelected && ( <div className="absolute top-1 left-1 z-10 p-0.5 bg-blue-600 rounded-full text-white pointer-events-none"> {/* Checkmark SVG */} </div> )}
                 </div>
              );
            })}
          </div>
        )}

         {/* Empty State Message */}
         {!isLoading && storedImagesMetadata.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-[rgb(var(--color-text-muted))] pointer-events-none group-hover/pastearea:text-blue-600 transition-colors duration-150">
                {isPasting ? ( <> {/* Spinner */} </> ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 group-hover/pastearea:text-blue-400 transition-colors duration-150 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"> {/* Icon SVG */} </svg>
                        <p className="text-xl font-semibold mb-1 group-hover/pastearea:text-blue-700">Paste Image Here</p>
                        <p className="text-sm">or use the &lsquo;Add Image(s)&rsquo; button above.</p>
                        <p className="text-xs mt-3">(Images are stored locally)</p>
                    </>
                )}
            </div>
         )}
      </div>
    </div>
  );
}