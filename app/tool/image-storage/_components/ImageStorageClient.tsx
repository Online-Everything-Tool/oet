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
  const [isLoading, setIsLoading] = useState<boolean>(true); // Initial load state
  const [isProcessing, setIsProcessing] = useState<boolean>(false); // State for adding/processing files
  const [error, setError] = useState<string | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set()); // Track selected IDs
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false); // Add bulk deleting state
  const [feedbackState, setFeedbackState] = useState<Record<string, { type: 'copy' | 'download' | 'error'; message: string } | null>>({});

  const { addHistoryEntry } = useHistory();
  const { addImage, getImage, deleteImage, listImages, clearAllImages, loading: libraryLoading, error: libraryError } = useImageLibrary(); // Get loading/error from context

  const fileInputRef = useRef<HTMLInputElement>(null);
  const managedUrlsRef = useRef<Map<string, string>>(new Map());

  // --- Helper Functions ---
  const setItemFeedback = useCallback((id: string, type: 'copy' | 'download' | 'error' | null, message: string = '') => {
    setFeedbackState(prev => ({ ...prev, [id]: type ? { type, message } : null }));
    // Clear non-error feedback after a delay
    if (type && type !== 'error') { setTimeout(() => { setFeedbackState(prev => (prev[id]?.type === type ? { ...prev, [id]: null } : prev)); }, 2000); }
  }, []);

  const revokeManagedUrls = useCallback(() => {
    managedUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    managedUrlsRef.current.clear();
    setImageObjectUrls(new Map()); // Clear the state map as well
  }, []);

   // Updated Object URL handling to use thumbnail if available
   const updateObjectUrls = useCallback((images: StoredFile[]) => {
       // Don't revoke URLs managed elsewhere (like original image in image processing tools)
       // This utility should only manage URLs it creates for *previews* of stored images.
       // Clean up URLs ONLY for files that are no longer in the list.
        const currentIds = new Set(images.map(img => img.id));
        const urlsToRevoke = new Map<string, string>();
        managedUrlsRef.current.forEach((url, id) => {
            if (!currentIds.has(id)) {
                 urlsToRevoke.set(id, url);
                 managedUrlsRef.current.delete(id); // Remove from managed list
            }
        });
        urlsToRevoke.forEach(url => URL.revokeObjectURL(url));

        const newUrlMap = new Map<string, string>();
        images.forEach(img => {
            // Create a new URL only if one doesn't exist or if the blob might have changed (less common)
            if (img.id && !managedUrlsRef.current.has(img.id)) {
                const blobToUse = img.thumbnailBlob || img.blob; // Prefer thumbnail
                if (blobToUse && img.type?.startsWith('image/')) { // Only create for images
                   try {
                       const url = URL.createObjectURL(blobToUse);
                       newUrlMap.set(img.id, url);
                       managedUrlsRef.current.set(img.id, url); // Add to managed list
                   } catch (e) { console.error(`[ImageStorage] Error creating Object URL for ID ${img.id}:`, e); }
                }
            } else if (img.id && managedUrlsRef.current.has(img.id)) {
                // If URL already exists and is managed, just add it to the map for this render
                 newUrlMap.set(img.id, managedUrlsRef.current.get(img.id)!);
            }
        });
         // Combine existing valid URLs with new ones created in this batch
         // This ensures URLs for files that didn't need re-creating are still in the map
         const finalUrlMap = new Map<string, string>(previewObjectUrls); // Start with current state
         newUrlMap.forEach((url, id) => finalUrlMap.set(id, url)); // Add/overwrite with new ones
         setImageObjectUrls(finalUrlMap);
    }, [previewObjectUrls]); // Dependency on previewObjectUrls to merge correctly

  // --- Load images function ---
  const loadAndDisplayImages = useCallback(async (limit = 50) => {
    // setError(null); // Let context handle errors for listing
    setIsLoading(true); // Start local loading state
    try {
      // listImages now handles its own loading/error state and DB access
      const images = await listImages(limit);
      setStoredImages(images);
      updateObjectUrls(images); // Update previews for the loaded images
    } catch (/* error handled by context */) {
        // Explicitly set error if context error exists, or set a generic one if not
         setError(libraryError || 'Failed to load stored images.'); // Use context error or fallback
         setStoredImages([]); // Clear list on error
         revokeManagedUrls(); // Clean up existing URLs
    } finally {
       // We are no longer solely dependent on this try/catch for isLoading
       // We might want a combined loading state: local isLoading + context loading
       // Let's keep local loading for now to reflect *this component's* data fetching
       setIsLoading(false);
    }
  }, [listImages, updateObjectUrls, revokeManagedUrls, libraryError]); // Add libraryError as dependency

  useEffect(() => {
    // Initial load and cleanup on unmount
    loadAndDisplayImages();
    return () => { revokeManagedUrls(); };
     // Add revokeManagedUrls to dependency array as it's used in cleanup
  }, [loadAndDisplayImages, revokeManagedUrls]);


  // --- SAVE IMAGE HELPER ---
  const saveNewImage = useCallback(async (file: File, trigger: TriggerType) => {
    if (!file.type.startsWith('image/')) {
        setError(prev => (prev ? `${prev}; Skipped non-image file: ${file.name}` : `Skipped non-image file: ${file.name}`));
        // Log history entry for skipped file? Optional.
        // For now, just skip and maybe log one general message at the end of handleFilesAdded
        return; // Do not process
    }
    let historyOutput: string | Record<string, unknown> = '';
    let status: 'success' | 'error' = 'success';
    let imageId: string | undefined = undefined;
    const inputDetails: Record<string, unknown> = { fileName: file.name, fileType: file.type, fileSize: file.size, source: trigger };

    try {
        // addImage now handles its own loading/error state and DB access
        imageId = await addImage(file, file.name || `image-${Date.now()}`, file.type);
        historyOutput = { message: `Image "${file.name}" added successfully.`, imageId: imageId };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error saving image.';
        // Append to existing error message if multiple files fail
        setError(prev => (prev ? `${prev}; Failed to save "${file.name}"` : `Failed to save "${file.name}"`));
        status = 'error';
        historyOutput = `Error saving "${file.name}": ${message}`;
        inputDetails.error = message; // Log error details in history input
    } finally {
      // Add history entry for each processed file (success or error)
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: trigger,
        input: inputDetails,
        output: historyOutput,
        status: status,
        eventTimestamp: Date.now() // Add timestamp here
      });
    }
  }, [addImage, addHistoryEntry, toolTitle, toolRoute]); // Dependencies: addImage, addHistoryEntry, toolTitle, toolRoute

   // --- Handler for files added via DropZone or Input ---
   const handleFilesAdded = useCallback(async (files: File[]) => {
       if (!files || files.length === 0) return;
       setError(null); // Clear previous errors before starting
       setIsProcessing(true); // Indicate processing started
       const trigger: TriggerType = 'upload';
       const imageFiles = files.filter(f => f.type.startsWith('image/'));

       if (imageFiles.length !== files.length) {
            // Set error for skipped files, but don't stop processing images
            setError(`Skipped ${files.length - imageFiles.length} non-image file(s).`);
       }

       // Process only the image files
       const savePromises = imageFiles.map(file => saveNewImage(file, trigger));
       await Promise.all(savePromises); // Wait for all save operations to complete

       // After saving/failing to save, reload the displayed list to show changes
       await loadAndDisplayImages(); // This will update storedImages and object URLs

       setIsProcessing(false); // Indicate processing finished
   }, [saveNewImage, loadAndDisplayImages]); // Dependencies: saveNewImage, loadAndDisplayImages

  // --- Trigger hidden file input ---
  const handleAddClick = () => {
      // Check if the input ref exists and is not disabled by current operations
       if (fileInputRef.current && !anyOperationInProgress) {
           fileInputRef.current.click();
       }
  };

  // --- File Input Change Handler ---
  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
        handleFilesAdded(Array.from(files));
    }
    // Always reset the input value so the same file can be selected again
    if (event.target) event.target.value = '';
  }, [handleFilesAdded]); // Dependency: handleFilesAdded

  // --- Selection Handlers ---
  const handleToggleSelection = (fileId: string) => {
    // Do not allow selection changes during bulk delete
    if (isBulkDeleting) return;
    setSelectedFileIds(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(fileId)) {
        newSelection.delete(fileId);
      } else {
        newSelection.add(fileId);
      }
      return newSelection;
    });
  };

  // --- Delete/Clear Handlers ---
  const handleDeleteSingleImage = useCallback(async (imageId: string) => {
    if (isBulkDeleting || isLoading || isProcessing) return; // Prevent single delete during any operation
    setIsProcessing(true); // Indicate operation is running
    setError(null); // Clear previous errors
    setItemFeedback(imageId, null); // Clear any existing feedback for this item

    let imageName = `Image ID ${imageId}`; // Default name if fetch fails
    let status: 'success' | 'error' = 'success';
    let historyOutput: string | Record<string, unknown> = { message: `Deleted image.` };
    const inputDetails: Record<string, unknown> = { deletedImageId: imageId };

    try {
        // Fetch the image details first to get the name for history/feedback
        const imageToDelete = await getImage(imageId);

        if (!imageToDelete) {
             // If image doesn't exist, log error and return, no DB operation needed
             const msg = `Attempted to delete non-existent or invalid image ID: ${imageId}`;
             console.warn(`[ImageStorage] ${msg}`);
             setError(msg);
             status = 'error';
             historyOutput = `Error: ${msg}`;
             inputDetails.error = msg;
             setItemFeedback(imageId, 'error', `Delete failed: Not found.`);
             return; // Exit function early
        }

        imageName = imageToDelete.name || imageName; // Use the fetched name
        inputDetails.deletedImageName = imageName; // Add name to history input

        // Perform the deletion
        await deleteImage(imageId);

        // Update local state directly or reload. reload is simpler for now.
        // Note: deleteImage in context provider *should* update its state,
        // which this component reads. A full reload confirms state sync.
        await loadAndDisplayImages(); // Reload the displayed list

        // History logging for success
         historyOutput = { message: `Deleted "${imageName}"` };
         status = 'success';


    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error deleting image.';
        console.error(`[ImageStorage] Error deleting "${imageName}" (ID: ${imageId}):`, err);
        setError(`Failed to delete "${imageName}". ${message}`);
        status = 'error';
        historyOutput = `Error deleting "${imageName}": ${message}`;
        inputDetails.error = message; // Log error details in history input
        setItemFeedback(imageId, 'error', `Delete failed: ${message}`); // Set error feedback on the item
    } finally {
        setIsProcessing(false); // End processing state
        // Add history entry for the delete attempt (success or failure)
        addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            trigger: 'click', // Trigger type for a button click
            input: inputDetails,
            output: historyOutput,
            status: status,
            eventTimestamp: Date.now() // Add event timestamp
        });
    }
     // No setItemFeedback('download') here - that was likely a copy/paste error
  }, [isBulkDeleting, isLoading, isProcessing, getImage, deleteImage, loadAndDisplayImages, addHistoryEntry, toolTitle, toolRoute, setItemFeedback]); // Dependencies: State variables used *before* async calls, and functions/props used inside.

  const handleBulkDeleteSelected = useCallback(async () => {
       if (selectedFileIds.size === 0 || isLoading || isProcessing || isBulkDeleting) return;
        if (!confirm(`Are you sure you want to delete ${selectedFileIds.size} selected image(s)? This cannot be undone.`)) return;

       setIsBulkDeleting(true); // Enter bulk delete mode
       setIsProcessing(true); // Also indicate processing is happening
       setError(null); // Clear previous errors
       setFeedbackState({}); // Clear all feedback for items

       const idsToDelete = Array.from(selectedFileIds);
       let historyOutput: string | Record<string, unknown> = { message: `Attempted to delete ${idsToDelete.length} selected images.` };
       let status: 'success' | 'error' = 'success';
       const inputDetails: Record<string, unknown> = { attemptedDeleteCount: idsToDelete.length, idsToDelete: idsToDelete };

       try {
           // deleteImage in the context provider now handles the DB operation
           // Calling it in a loop is fine, but better to have a bulk delete method if Dexie supports it efficiently.
           // Current deleteImage is per-ID. Let's use clearAllImages for bulk delete if it fits.
           // Looking at clearAllImages, it clears ALL permanent images. That's not what we want for selected.
           // We need to delete specific IDs. Dexie supports bulkDelete.
           // We should add a bulkDeleteImages method to ImageLibraryContext (or FileLibraryContext)
           // For now, let's use the deleteImage(id) in a loop, accepting it might be less performant for very large numbers.

           const deletionPromises = idsToDelete.map(id => deleteImage(id).catch(err => {
               console.error(`[ImageStorage] Failed to bulk delete ID ${id}:`, err);
               // Log error for this specific ID
               setItemFeedback(id, 'error', `Delete failed: ${err instanceof Error ? err.message : String(err)}`);
               return { id, error: err instanceof Error ? err.message : String(err) }; // Return error result
           }));

           const results = await Promise.all(deletionPromises);
           const failedDeletions = results.filter(r => r && 'error' in r);

           if (failedDeletions.length === 0) {
               console.log(`[ImageStorage] Successfully deleted ${idsToDelete.length} selected images.`);
               historyOutput = { message: `Deleted ${idsToDelete.length} selected image(s).` };
               status = 'success';
           } else {
               const successCount = idsToDelete.length - failedDeletions.length;
               const errorMsg = `Failed to delete ${failedDeletions.length} of ${idsToDelete.length} selected image(s).`;
               console.error(`[ImageStorage] ${errorMsg}`);
               setError(errorMsg); // Set component-level error
               status = 'error';
               historyOutput = `Error deleting selected images. ${successCount} succeeded, ${failedDeletions.length} failed.`;
               inputDetails.failedDeletions = failedDeletions.map(f => f.id);
           }

           // After deletion attempts, reload the displayed list
           await loadAndDisplayImages(); // This will update storedImages and object URLs

           setSelectedFileIds(new Set()); // Clear selection regardless of success

       } catch (err) {
            // This catch block would only be for errors *before* the deletion loop starts
            const message = err instanceof Error ? err.message : 'Unknown error during bulk delete setup.';
            console.error("[ImageStorage] Unexpected error during bulk delete:", err);
            setError(`An unexpected error occurred during bulk deletion: ${message}`);
            status = 'error';
            historyOutput = `Unexpected error during bulk delete: ${message}`;
            inputDetails.error = message;
       } finally {
           setIsBulkDeleting(false); // Exit bulk delete mode
           setIsProcessing(false); // End processing state
           // Add history entry for the bulk delete action
           addHistoryEntry({
                toolName: toolTitle,
                toolRoute: toolRoute,
                trigger: 'click', // Trigger type for a button click
                input: inputDetails,
                output: historyOutput,
                status: status,
                eventTimestamp: Date.now() // Add event timestamp
            });
       }
  }, [selectedFileIds, isLoading, isProcessing, isBulkDeleting, deleteImage, loadAndDisplayImages, addHistoryEntry, toolTitle, toolRoute, setItemFeedback]); // Dependencies

  const handleClearAll = useCallback(async () => {
    if (isLoading || isProcessing || isBulkDeleting || storedImages.length === 0) return;
    // Use the clearAllImages function from context
    if (!confirm(`Are you sure you want to delete all ${storedImages.length} stored images? This cannot be undone.`)) return;

    setError(null); // Clear previous errors
    setIsLoading(true); // Show loading state
    setIsProcessing(true); // Show processing state
    setIsBulkDeleting(true); // Engage bulk delete mode for visual feedback
    setFeedbackState({}); // Clear all item feedback

    let historyOutput: string | Record<string, unknown> = `Attempted to clear all ${storedImages.length} images.`;
    let status: 'success' | 'error' = 'success';
    const inputDetails: Record<string, unknown> = { attemptedClearCount: storedImages.length };


    try {
      // clearAllImages now handles its own loading/error state and DB access
      await clearAllImages(); // Clear all permanent images via context hook

      // Optimistically update local state
      setStoredImages([]);
      setSelectedFileIds(new Set()); // Clear selections
      revokeManagedUrls(); // Clean up all associated object URLs

      console.log(`[ImageStorage] Cleared all images via context.`);
      historyOutput = `Cleared all ${inputDetails.attemptedClearCount} images.`; // Use attempted count in success message
      status = 'success';

    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error clearing images.';
        console.error("[ImageStorage] Error clearing all images:", err);
        setError(`Failed to clear all images. ${message}`); // Set component-level error
        status = 'error';
        historyOutput = `Error clearing all images: ${message}`;
        inputDetails.error = message; // Log error details in history input
        // Reload the list on failure to show which images might remain
        await loadAndDisplayImages(); // Reload the displayed list
    } finally {
       setIsLoading(false); // End loading state
       setIsProcessing(false); // End processing state
       setIsBulkDeleting(false); // Exit bulk delete mode
       // Add history entry for the clear all action
        addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            trigger: 'click', // Trigger type for a button click
            input: inputDetails,
            output: historyOutput,
            status: status,
            eventTimestamp: Date.now() // Add event timestamp
        });
    }
  }, [isLoading, isProcessing, isBulkDeleting, storedImages.length, clearAllImages, revokeManagedUrls, addHistoryEntry, toolTitle, toolRoute, loadAndDisplayImages]); // Dependencies

  // --- Action Handlers (Copy/Download/SendTo) ---
   const handleCopyFileContent = useCallback(async (imageId: string) => {
    if (anyOperationInProgress) return;
    setError(null); setItemFeedback(imageId, null);
    try {
        const image = await getImage(imageId); // Use getImage from context
        if (!image?.blob) throw new Error("Image data not found.");
        // Check if it's a text-like file type before attempting to read as text
        if (!image.type?.startsWith('text/') && image.type !== 'application/json' && image.type !== 'application/xml' && image.type !== 'application/javascript' && image.type !== 'application/csv') {
             throw new Error(`Cannot copy content of type "${image.type}". Only text-based files are supported.`);
        }
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard API not available.");
        const text = await new Response(image.blob).text();
        await navigator.clipboard.writeText(text);
        setItemFeedback(imageId, 'copy', 'Copied!');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown copy error.';
        console.error(`[ImageStorage] Error copying content for ID ${imageId}:`, err);
        setItemFeedback(imageId, 'error', `Copy failed: ${message}`);
    }
  }, [anyOperationInProgress, getImage, setItemFeedback]); // Dependencies

  const handleDownloadFile = useCallback(async (imageId: string) => {
     if (anyOperationInProgress) return;
     setError(null); setItemFeedback(imageId, null);
     try {
         const image = await getImage(imageId); // Use getImage from context
         if (!image?.blob) throw new Error("Image data not found.");
         const url = URL.createObjectURL(image.blob);
         const link = document.createElement('a');
         link.href = url;
         // Derive download name from stored file name, fall back to ID/type
         link.download = image.name || `file-${imageId}.${image.type.split('/')[1] || 'bin'}`;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         URL.revokeObjectURL(url); // Clean up the temporary URL
         setItemFeedback(imageId, 'download', 'Downloaded!');
     } catch (err) {
         const message = err instanceof Error ? err.message : 'Unknown download error.';
         console.error(`[ImageStorage] Error downloading file ID ${imageId}:`, err);
         setItemFeedback(imageId, 'error', `Download failed: ${message}`);
     }
  }, [anyOperationInProgress, getImage, setItemFeedback]); // Dependencies

  const handleSendTo = useCallback((imageId: string) => {
      if (anyOperationInProgress) return;
      // This is a placeholder. Actual implementation would involve routing or context update.
      alert(`"Send To" clicked for image ID: ${imageId}. (Feature Not Implemented)`);
      console.log("Send To clicked for:", imageId);
      // Potentially add history entry for this action if it becomes a real feature
      /*
       addHistoryEntry({
         toolName: toolTitle,
         toolRoute: toolRoute,
         trigger: 'click',
         input: { sendImageId: imageId },
         output: `Attempted to send image ID ${imageId} to another tool.`,
         status: 'success', // Or 'error' if failed
         eventTimestamp: Date.now()
       });
      */
  }, [anyOperationInProgress]); // Dependencies

   // --- Custom Preview Renderer for FileGridView ---
   const renderDefaultPreview = useCallback((file: StoredFile): React.ReactNode => {
       // This checks if the file is an image type and if we have an object URL for its preview
       const objectUrl = imageObjectUrls.get(file.id);
       if (objectUrl && file.type?.startsWith('image/')) {
            // Using unoptimized={true} for local blobs is appropriate
            return ( <Image src={objectUrl} alt={file.name || 'Stored image preview'} width={150} height={150} className="max-w-full max-h-full object-contain" unoptimized={true} /> );
       }
       // Fallback for non-images or images without a generated preview URL
       const fileType = file.type || '';
       if (fileType === 'application/zip' || fileType === 'application/x-zip-compressed') return <span className="text-4xl opacity-50">📦</span>;
       if (fileType.startsWith('text/')) return <span className="text-4xl opacity-50">📄</span>;
       if (fileType === 'application/pdf') return <span className="text-4xl opacity-50">📕</span>;
       // Generic image icon if it's an image type but no URL (e.g., thumbnail failed)
       if (fileType.startsWith('image/')) return <Image src="/icon-org.svg" alt="Generic image icon" width={48} height={48} className="opacity-50" />; // Use a generic image icon
       return <span className="text-4xl opacity-50">❔</span>; // Generic file icon
   }, [imageObjectUrls]); // Dependency: imageObjectUrls state

  // --- Calculate Flags / States ---
  // Combine local loading/processing with library context loading/error
  const anyOperationInProgress = isLoading || isProcessing || isBulkDeleting || libraryLoading;
  const displayError = error || libraryError;


  // --- Render Logic ---
  const showLoadingIndicator = anyOperationInProgress && storedImages.length === 0;
  const showEmptyState = !anyOperationInProgress && storedImages.length === 0 && !displayError;


  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">

      {/* Hidden file input */}
      <input ref={fileInputRef} id="imageUploadHidden" type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={anyOperationInProgress} multiple />

      {/* Control Buttons */}
      <div className="flex flex-wrap gap-4 items-center justify-between p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
            <button type="button" onClick={handleAddClick} disabled={anyOperationInProgress} className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgb(var(--color-button-accent2-bg))] transition-colors duration-150 ease-in-out ${anyOperationInProgress ? 'opacity-50 cursor-not-allowed' : ''}`}>
                 <span>➕</span> {isProcessing ? 'Processing...' : 'Add Image(s)'}
            </button>

             {/* Bulk Delete Button */}
             {selectedFileIds.size > 0 && (
                  <button type="button" onClick={handleBulkDeleteSelected} disabled={anyOperationInProgress} className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-danger-text))] bg-[rgb(var(--color-button-danger-bg))] hover:bg-[rgb(var(--color-button-danger-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgb(var(--color-button-danger-bg))] transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                      <span>🗑️</span> Delete Selected ({selectedFileIds.size})
                 </button>
             )}


            {/* Clear All Button */}
            <button type="button" onClick={handleClearAll} disabled={storedImages.length === 0 || anyOperationInProgress} className={`inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${selectedFileIds.size > 0 ? 'hidden sm:inline-flex' : ''}`}> {/* Hide when bulk delete is active, show on larger screens */}
                 <span>🧺</span> Clear All Images
             </button>
       </div>

      {displayError && ( <div role="alert" className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm"> <strong>Error:</strong> {displayError} </div> )}

      {/* File Display Area (using DropZone as wrapper) */}
      <FileDropZone onFilesAdded={handleFilesAdded} isLoading={anyOperationInProgress} className="min-h-[300px]">
        {/* Loading, Empty, or Content */}
        {showLoadingIndicator && ( <p className="text-center p-4 text-gray-500 italic animate-pulse">Loading Stored Images...</p> )}

        {showEmptyState && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 italic py-16">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <p className="text-lg font-medium">No images stored yet.</p>
                <p className="mt-2 text-sm">Drag & drop images here, paste them from your clipboard, or click "Add Image(s)" above.</p>
            </div>
        )}

        {!showLoadingIndicator && !showEmptyState && (
            <FileGridView
                 files={storedImages}
                 isLoading={anyOperationInProgress} // Pass combined loading/processing state
                 isBulkDeleting={isBulkDeleting}
                 selectedIds={selectedFileIds}
                 feedbackState={feedbackState}
                 onSendTo={handleSendTo}
                 onCopy={handleCopyFileContent}
                 onDownload={handleDownloadFile}
                 onDelete={handleDeleteSingleImage} // Single delete handler
                 renderPreview={renderDefaultPreview}
                 onToggleSelection={handleToggleSelection}
            />
        )}
      </FileDropZone>

    </div>
  );
}