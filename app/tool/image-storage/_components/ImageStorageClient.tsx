// FILE: app/tool/image-storage/_components/ImageStorageClient.tsx
'use client';

import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import { type LibraryImage } from '@/app/lib/db';

interface ImageStorageClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function ImageStorageClient({ toolTitle, toolRoute }: ImageStorageClientProps) {
  // --- State ---
  const [storedImagesMetadata, setStoredImagesMetadata] = useState<LibraryImage[]>([]);
  const [imageObjectUrls, setImageObjectUrls] = useState<Map<number, string>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  // --- Hooks ---
  const { addHistoryEntry } = useHistory();
  // Removed unused 'getImage' from destructuring
  const { addImage, deleteImage, listImages, clearAllImages } = useImageLibrary();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const managedUrlsRef = useRef<Map<number, string>>(new Map());

  // --- Helper: Revoke managed URLs ---
  const revokeManagedUrls = useCallback(() => {
    console.log('[ImageStorage] Revoking managed URLs:', managedUrlsRef.current.size);
    managedUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    managedUrlsRef.current.clear();
    setImageObjectUrls(new Map());
  }, []);

  // --- Helper: Update Object URLs for a list of images ---
  const updateObjectUrls = useCallback((images: LibraryImage[]) => {
    revokeManagedUrls();
    const newUrlMap = new Map<number, string>();
    images.forEach(img => {
      // Ensure id exists and is a number before using it as a key
      if (img.id !== undefined && typeof img.id === 'number' && img.blob) {
        try {
            const url = URL.createObjectURL(img.blob);
            newUrlMap.set(img.id, url);
            managedUrlsRef.current.set(img.id, url);
        } catch (e) {
            console.error(`[ImageStorage] Error creating Object URL for image ID ${img.id}:`, e);
        }
      } else {
          console.warn('[ImageStorage] Skipping URL creation for image with missing ID or blob:', img);
      }
    });
    setImageObjectUrls(newUrlMap);
    console.log('[ImageStorage] Updated Object URLs map:', newUrlMap.size);
  }, [revokeManagedUrls]);


  // --- Function to Load/Refresh Images ---
  const loadAndDisplayImages = useCallback(async (limit = 20) => {
    setError(null);
    setIsLoading(true);
    try {
      const images = await listImages(limit);
      setStoredImagesMetadata(images);
      updateObjectUrls(images);
    } catch (err) {
      console.error('[ImageStorage] Error loading images:', err);
      setError('Failed to load stored images.');
      setStoredImagesMetadata([]);
      revokeManagedUrls();
    } finally {
      setIsLoading(false);
    }
  }, [listImages, updateObjectUrls, revokeManagedUrls]);


  // --- Initial Load ---
  useEffect(() => {
    console.log('[ImageStorage] Initial load effect running...');
    loadAndDisplayImages();

    return () => {
        console.log('[ImageStorage] Unmounting, revoking URLs...');
        revokeManagedUrls();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAndDisplayImages]);


  // --- Save New Image (Upload/Paste) ---
  const saveNewImage = useCallback(async (blob: Blob, name: string, type: string, trigger: 'upload' | 'transfer') => {
      setError(null);
      let newId: number | undefined;
      let historyStatus: 'success' | 'error' = 'success';
      let historyOutput = 'Image stored successfully.';

      try {
          newId = await addImage(blob, name, type);
          if (newId !== undefined) {
              console.log(`[ImageStorage] Image added with ID: ${newId}. Refreshing list.`);
              await loadAndDisplayImages();
              historyOutput = `Image stored with ID ${newId}`;
          } else {
               throw new Error('Failed to get new ID after adding image.');
          }
      } catch (err) {
           console.error('[ImageStorage] Error saving image:', err);
           const message = err instanceof Error ? err.message : 'Unknown save error';
           setError(`Failed to save image data: ${message}`);
           historyStatus = 'error';
           historyOutput = `Error: ${message}`;
      } finally {
           addHistoryEntry({
               toolName: toolTitle,
               toolRoute: toolRoute,
               trigger: trigger,
               input: { fileName: name, type: type, size: blob.size, ...(historyStatus === 'error' && {error: historyOutput}) },
               output: historyOutput,
               status: historyStatus,
           });
      }
  }, [addImage, loadAndDisplayImages, addHistoryEntry, toolTitle, toolRoute]);


  // --- Handle File Input ---
  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setError(null);
    let successCount = 0;
    const filePromises: Promise<void>[] = [];

    for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
            filePromises.push(
                saveNewImage(file, file.name, file.type, 'upload')
                .then(() => { successCount++; })
                .catch(e => console.error(`Error saving ${file.name}:`, e))
            );
        } else {
             console.warn(`[ImageStorage] Skipping non-image file: ${file.name}`);
             setError(prev => prev ? `${prev}, Skipped non-image file: ${file.name}` : `Skipped non-image file: ${file.name}`);
        }
    }

    await Promise.all(filePromises);

    console.log(`[ImageStorage] Finished processing ${files.length} files, ${successCount} successful.`);
    // loadAndDisplayImages is called within saveNewImage now, no need here unless saveNewImage changes
    // await loadAndDisplayImages(); // Consider if needed depending on saveNewImage implementation detail
    setIsLoading(false);

    if (fileInputRef.current) fileInputRef.current.value = '';

  }, [saveNewImage, loadAndDisplayImages]); // Keep loadAndDisplayImages if saveNewImage might not refresh


  // --- Handle Paste ---
  const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLDivElement>) => {
     setError(null);
     setIsPasting(true);
     console.log('[ImageStorage] Paste event detected.');

     const items = event.clipboardData?.items;
     if (!items) { setIsPasting(false); return; }

     let imageFile: File | null = null;
     for (let i = 0; i < items.length; i++) {
         if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
             imageFile = items[i].getAsFile();
             break;
         }
     }

     if (imageFile) {
         console.log('[ImageStorage] Image file found in clipboard:', imageFile.name, imageFile.type);
         const defaultName = `pasted-image-${Date.now()}.${imageFile.type.split('/')[1] || 'png'}`;
         await saveNewImage(imageFile, imageFile.name || defaultName, imageFile.type, 'transfer');
         // loadAndDisplayImages is called within saveNewImage now
     } else {
         console.log('[ImageStorage] No image file found in clipboard items.');
         // setError("No image found in clipboard data."); // Optional
     }
     setIsPasting(false);

  }, [saveNewImage]); // Removed loadAndDisplayImages dependency


  // --- Handle Delete Single Image ---
  const handleDeleteSingleImage = useCallback(async (id: number) => {
      if (isDeleting !== null) return;
      console.log(`[ImageStorage] Deleting image ID: ${id}`);
      setError(null);
      setIsDeleting(id);
      let historyStatus: 'success' | 'error' = 'success';
      let historyOutput = `Deleted image ID ${id}`;

      try {
          await deleteImage(id);
          // Revoke URL specifically for the deleted image
          const deletedUrl = managedUrlsRef.current.get(id);
          if (deletedUrl) {
              URL.revokeObjectURL(deletedUrl);
              managedUrlsRef.current.delete(id);
              console.log(`[ImageStorage] Revoked URL for deleted image ID: ${id}`);
          }
          // Update state by filtering out the deleted image
          setStoredImagesMetadata(prev => prev.filter(img => img.id !== id));
          setImageObjectUrls(prev => {
              const newMap = new Map(prev);
              newMap.delete(id);
              return newMap;
          });

      } catch (err) {
          console.error(`[ImageStorage] Error deleting image ID ${id}:`, err);
          const message = err instanceof Error ? err.message : 'Unknown delete error';
          setError(`Failed to delete image: ${message}`);
          historyStatus = 'error';
          historyOutput = `Error deleting ID ${id}: ${message}`;
      } finally {
          setIsDeleting(null);
           addHistoryEntry({
               toolName: toolTitle,
               toolRoute: toolRoute,
               trigger: 'click',
               input: { imageId: id },
               output: historyOutput,
               status: historyStatus,
           });
      }
  }, [deleteImage, addHistoryEntry, toolTitle, toolRoute, isDeleting]);


  // --- Handle Clear All ---
  const handleClearAll = useCallback(async () => {
    if (storedImagesMetadata.length === 0) return;
    console.log('[ImageStorage] Clearing all stored images.');
    setError(null);
    setIsLoading(true);
    let historyStatus: 'success' | 'error' = 'success';
    let historyOutput = `Cleared all ${storedImagesMetadata.length} images.`;

    try {
      await clearAllImages();
      revokeManagedUrls();
      setStoredImagesMetadata([]);
      setImageObjectUrls(new Map());
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
        console.error(`[ImageStorage] Error clearing all images:`, err);
        const message = err instanceof Error ? err.message : 'Unknown clear error';
        setError(`Failed to clear stored images: ${message}`);
        historyStatus = 'error';
        historyOutput = `Error clearing images: ${message}`;
    } finally {
        setIsLoading(false);
         addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            trigger: 'click',
            input: { action: 'clearAll', count: storedImagesMetadata.length },
            output: historyOutput,
            status: historyStatus,
        });
    }
  }, [clearAllImages, revokeManagedUrls, addHistoryEntry, toolTitle, toolRoute, storedImagesMetadata.length]);


  // --- JSX Rendering ---
  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <label htmlFor="imageUpload" className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out ${isLoading || isPasting ? 'opacity-50 cursor-not-allowed' : ''}`}>
          {isLoading ? 'Processing...' : (isPasting ? 'Pasting...' : ('Add Image(s)'))}
        </label>
        <input ref={fileInputRef} id="imageUpload" type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={isLoading || isPasting} multiple/>

        <span className="text-sm text-[rgb(var(--color-text-muted))] hidden sm:inline">or paste image</span>

        <button
          type="button"
          onClick={handleClearAll}
          disabled={storedImagesMetadata.length === 0 || isLoading || isPasting || isDeleting !== null}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
        >
          Clear All Images
        </button>
      </div>

      {/* Error Display */}
      {error && (
          <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              <div><strong className="font-semibold">Error:</strong> {error}</div>
          </div>
      )}

      {/* Image Gallery / Paste Area */}
      <div
        onPaste={handlePaste}
        className={`w-full min-h-[300px] p-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-start text-center transition-colors duration-200 overflow-y-auto
                    ${isPasting ? 'border-blue-500 bg-blue-50' : 'border-[rgb(var(--color-input-border))] hover:border-blue-400'}
                    ${storedImagesMetadata.length === 0 ? 'bg-[rgb(var(--color-bg-subtle))] justify-center' : 'bg-[rgb(var(--color-bg-component))] justify-start'} `} // Adjust layout when empty
        aria-label="Image gallery and paste area"
        tabIndex={0}
      >
        {isLoading && storedImagesMetadata.length === 0 && (
          <p className="text-lg text-[rgb(var(--color-text-link))] animate-pulse">Loading Stored Images...</p>
        )}

        {/* Gallery Grid */}
        {!isLoading && storedImagesMetadata.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 w-full">
            {storedImagesMetadata.map((meta) => {
              const objectUrl = meta.id !== undefined ? imageObjectUrls.get(meta.id) : null;
              const isThisDeleting = isDeleting === meta.id;
              return (
                <div key={meta.id ?? Math.random()} className={`relative group border rounded-md shadow-sm overflow-hidden bg-white p-2 flex flex-col items-center gap-1 transition-opacity ${isThisDeleting ? 'opacity-50 animate-pulse' : ''}`}>
                  <div className="aspect-square w-full flex items-center justify-center bg-gray-100 rounded overflow-hidden">
                     {objectUrl ? (
                       // eslint-disable-next-line @next/next/no-img-element -- Using Object URLs
                       <img
                         src={objectUrl}
                         alt={meta.name || 'Stored image'}
                         className="max-w-full max-h-full object-contain"
                       />
                     ) : (
                       <span className="text-xs text-gray-400 italic p-1">Loading...</span>
                     )}
                  </div>
                  <p className="text-xs text-[rgb(var(--color-text-muted))] truncate w-full" title={meta.name}>
                    {meta.name || 'Untitled'}
                  </p>
                  <p className="text-[10px] text-gray-400 w-full text-left">
                     ID: {meta.id ?? 'N/A'}
                  </p>
                   {/* Delete Button (visible on hover) */}
                   {!isThisDeleting && meta.id !== undefined && (
                        <button
                            onClick={() => handleDeleteSingleImage(meta.id!)}
                            title="Delete this image"
                            disabled={isDeleting !== null} // Disable all delete buttons if any is deleting
                            className="absolute top-1 right-1 p-0.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label={`Delete image ${meta.name || meta.id}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                   )}
                   {isThisDeleting && (
                       <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                           <span className="text-white text-xs">Deleting...</span>
                       </div>
                   )}
                </div>
              );
            })}
          </div>
        )}

         {/* Empty State Message */}
         {!isLoading && storedImagesMetadata.length === 0 && (
           <div className="text-[rgb(var(--color-text-muted))] mt-8"> {/* Added margin-top */}
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <p className="mt-2 text-sm font-medium">No images stored.</p>
                <p className="mt-1 text-xs">Add image files or paste one here to store them in your browser.</p>
           </div>
         )}
      </div>

    </div>
  );
}