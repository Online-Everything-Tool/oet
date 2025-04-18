// FILE: app/tool/_components/FileSelectionModal.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import Image from 'next/image';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { StoredFile } from '@/src/types/storage'; // Uses updated type (no category)
import FileDropZone from './storage/FileDropZone';
import { formatBytes } from '@/app/lib/utils';

interface FileSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onFilesSelected: ( files: StoredFile[], source: 'library' | 'upload', savePreference?: boolean ) => void;
    className?: string;
    accept?: string;
    libraryFilter?: { category?: string; type?: string; };
    selectionMode?: 'single' | 'multiple';
}

// Helper function to map MIME type to a conceptual category (used for filtering)
const mapTypeToCategory = (mimeType: string | undefined): string => {
    if (!mimeType) return 'other';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') return 'archive';
    if (mimeType.startsWith('text/')) return 'text';
    if (mimeType === 'application/pdf') return 'document';
    // Add more mappings as needed
    return 'other';
};


const FileSelectionModal: React.FC<FileSelectionModalProps> = ({
    isOpen,
    onClose,
    onFilesSelected,
    className,
    accept = '*/*',
    libraryFilter = {},
    selectionMode = 'multiple'
}) => {
    const { listFiles, addFile, getFile, loading: libraryLoading, error: libraryError } = useFileLibrary();
    const [libraryFiles, setLibraryFiles] = useState<StoredFile[]>([]);
    const [modalLoading, setModalLoading] = useState<boolean>(false);
    const [modalError, setModalError] = useState<string | null>(null);
    const [previewObjectUrls, setPreviewObjectUrls] = useState<Map<string, string>>(new Map());
    const managedUrlsRef = useRef<Map<string, string>>(new Map());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library');
    const [savePreference, setSavePreference] = useState<boolean>(false);
    const uploadInputRef = useRef<HTMLInputElement>(null);

    // --- Helper Functions (revoke, update URLs - unchanged) ---
    const revokeManagedUrls = useCallback(() => {
        managedUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        managedUrlsRef.current.clear();
    }, []);

    const updateObjectUrls = useCallback((loadedFiles: StoredFile[]) => {
         const newUrlMap = new Map<string, string>();
         loadedFiles.forEach(file => {
             if (file.id && (file.thumbnailBlob || (file.type?.startsWith('image/') && file.blob))) {
                 const blobToUse = file.thumbnailBlob || file.blob;
                 if (blobToUse) {
                    try {
                        const url = URL.createObjectURL(blobToUse);
                        newUrlMap.set(file.id, url);
                        if (!managedUrlsRef.current.has(file.id)) {
                            managedUrlsRef.current.set(file.id, url);
                        }
                    } catch (e) { console.error(`[Modal] Error creating Object URL for file ID ${file.id}:`, e); }
                 }
             }
         });
         setPreviewObjectUrls(newUrlMap);
    }, []);

    // --- Load and Display Library Files (MODIFIED Filtering) ---
    const loadAndDisplayLibraryFiles = useCallback(async (limit = 100) => {
        if (activeTab !== 'library') return;
        setModalLoading(true);
        setModalError(null);
        try {
            // Fetch permanent files only
            const allPermanentFiles = await listFiles(limit * 2, false); // Fetch more to filter client-side

            let filteredFiles = allPermanentFiles;

            // Client-side filter based on libraryFilter.category prop
            if (libraryFilter?.category) {
                console.log(`[Modal] Applying client-side category filter: ${libraryFilter.category}`);
                filteredFiles = filteredFiles.filter(file => {
                    // Use the helper function to map the file's MIME type to a category
                    const fileCategory = mapTypeToCategory(file.type);
                    // Compare the derived category with the requested filter category
                    return fileCategory === libraryFilter.category;
                });
            }

            // Client-side filter based on libraryFilter.type prop
            if (libraryFilter?.type) {
                 console.log(`[Modal] Applying client-side type filter: ${libraryFilter.type}`);
                 // Direct comparison with the file's MIME type
                 filteredFiles = filteredFiles.filter(file => file.type === libraryFilter.type);
            }

            // Apply limit after filtering
            const finalFiles = filteredFiles.slice(0, limit);

            setLibraryFiles(finalFiles);
            updateObjectUrls(finalFiles); // Update previews for the final filtered list
        } catch (err: unknown) {
            console.error('[Modal] Error loading/filtering library files:', err);
            const message = err instanceof Error ? err.message : 'Failed to load files';
            setModalError(`Library Error: ${message}`);
            setLibraryFiles([]);
        } finally {
            setModalLoading(false);
        }
    }, [activeTab, listFiles, updateObjectUrls, libraryFilter]); // Keep libraryFilter dependency

    // Effect to Load Files & Cleanup (Unchanged signature)
    useEffect(() => {
        if (isOpen && activeTab === 'library') {
            setSelectedIds(new Set());
            loadAndDisplayLibraryFiles();
        }
        return () => {
            if (!isOpen) {
                revokeManagedUrls();
                setPreviewObjectUrls(new Map());
            }
        };
    }, [isOpen, activeTab, loadAndDisplayLibraryFiles, revokeManagedUrls]);


    // --- Interaction Handlers (Largely Unchanged) ---
    const handleFileClick = (file: StoredFile) => {
        if (!file || !file.id) return;
        setSelectedIds(prevSelected => {
            const newSelected = new Set(prevSelected);
            if (selectionMode === 'single') {
                newSelected.clear(); newSelected.add(file.id);
            } else {
                if (newSelected.has(file.id)) newSelected.delete(file.id);
                else newSelected.add(file.id);
            }
            return newSelected;
        });
    };

    const handleConfirmSelection = useCallback(async (idsToConfirm?: Set<string>) => {
        const finalIds = idsToConfirm || selectedIds;
        if (finalIds.size === 0) return;
        setModalLoading(true); setModalError(null);
        const selectedFiles: StoredFile[] = [];
        try {
            const promises = Array.from(finalIds).map(id => getFile(id)); const results = await Promise.all(promises);
            results.forEach(file => { if (file) selectedFiles.push(file); });
            if (selectedFiles.length > 0) { onFilesSelected(selectedFiles, 'library'); onClose(); }
            else { throw new Error("No valid files found for the selected IDs."); }
        } catch (err) { console.error("[Modal] Error confirming selection:", err); const message = err instanceof Error ? err.message : 'Failed to get selected files'; setModalError(`Selection Error: ${message}`); }
        finally { setModalLoading(false); }
    }, [selectedIds, getFile, onFilesSelected, onClose]);

    // addFile context call is already simplified
    const handleFilesAdded = useCallback(async (addedFiles: File[]) => {
        if (!addedFiles || addedFiles.length === 0) return;
        setModalLoading(true); setModalError(null);
        const processedFiles: StoredFile[] = [];
        try {
            const processPromises = addedFiles.map(async (file) => {
                 let storedFile: StoredFile | undefined;
                 if (savePreference) {
                     try {
                         const fileId = await addFile(file, file.name, file.type, false);
                         storedFile = await getFile(fileId);
                     } catch (saveError) { console.error(`[Modal] Error saving uploaded file "${file.name}":`, saveError); throw new Error(`Failed to save "${file.name}" to library.`); }
                 } else {
                     storedFile = {
                         id: `temp-${Date.now()}-${Math.random().toString(16).substring(2)}`,
                         name: file.name, type: file.type, size: file.size,
                         blob: file, createdAt: new Date(), isTemporary: true
                     };
                 }
                 if (storedFile) processedFiles.push(storedFile);
             });
             await Promise.all(processPromises);
             if (processedFiles.length > 0) {
                 onFilesSelected(processedFiles, 'upload', savePreference); onClose();
             } else { throw new Error("No files were successfully processed."); }
        } catch (err) { console.error("[Modal] Error processing uploaded files:", err); const message = err instanceof Error ? err.message : 'Failed to process uploads'; setModalError(`Upload Error: ${message}`); }
        finally { setModalLoading(false); }
    }, [addFile, getFile, savePreference, onFilesSelected, onClose]);

    const handleUploadInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) { handleFilesAdded(Array.from(files)); }
        if (event.target) event.target.value = '';
    }, [handleFilesAdded]);

    const triggerUploadInput = () => { uploadInputRef.current?.click(); };

    // renderDefaultPreview already checks type
    const renderDefaultPreview = useCallback((file: StoredFile): React.ReactNode => {
        const objectUrl = previewObjectUrls.get(file.id);
        const fileType = file.type || '';
        if (objectUrl && fileType.startsWith('image/')) { return (<Image src={objectUrl} alt={file.name || 'Stored image'} width={150} height={150} className="max-w-full max-h-full object-contain pointer-events-none" unoptimized />); }
        if (fileType === 'application/zip' || fileType === 'application/x-zip-compressed') return <span className="text-4xl opacity-50">📦</span>;
        if (fileType.startsWith('text/')) return <span className="text-4xl opacity-50">📄</span>;
        if (fileType === 'application/pdf') return <span className="text-4xl opacity-50">📕</span>;
        if (fileType.startsWith('image/')) return <Image src="/icon-org.svg" alt="Image file icon" width={48} height={48} className="opacity-50" />;
        return <span className="text-4xl opacity-50">❔</span>;
    }, [previewObjectUrls]);


    // --- Render (Unchanged structure) ---
    if (!isOpen) return null;
    const combinedLoading = modalLoading || libraryLoading;
    const combinedError = modalError || libraryError;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="file-select-modal-title">
            <div className={`bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] ${className || ''}`} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
                    <div className="flex border-b-0">
                         <button onClick={() => setActiveTab('library')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'library' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'}`}> Select from Library </button>
                         <button onClick={() => setActiveTab('upload')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'upload' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'}`}> Upload New </button>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500" aria-label="Close modal"> <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> </button>
                </div>

                {/* Body */}
                <div className="p-4 overflow-y-auto flex-grow min-h-[300px]">
                     {combinedLoading && (<div className="flex items-center justify-center h-full"><p className="text-center text-gray-500 italic animate-pulse py-8">Loading...</p></div>)}
                     {combinedError && !combinedLoading && (<div className="flex items-center justify-center h-full"><p className="text-center text-red-600 p-4 bg-red-50 border border-red-200 rounded">Error: {combinedError}</p></div>)}

                    {/* Library Tab */}
                    {activeTab === 'library' && !combinedLoading && !combinedError && (
                        <>
                            {libraryFiles.length === 0 ? (
                                <div className="flex items-center justify-center h-full"><p className="text-center text-gray-500 italic py-8">Your file library {libraryFilter?.category ? `for category '${libraryFilter.category}' ` : ''}is empty or no files match the filter.</p></div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {libraryFiles.map(file => {
                                        const isSelected = selectedIds.has(file.id);
                                        return (
                                            <button key={file.id} type="button" className={`relative group border rounded-md shadow-sm overflow-hidden bg-white p-2 flex flex-col items-center gap-1 transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 ${isSelected ? 'border-blue-500 ring-2 ring-blue-400 ring-offset-0' : 'border-gray-200 hover:border-blue-400 focus:ring-blue-400'}`} onClick={() => handleFileClick(file)} aria-pressed={isSelected} aria-label={`Select file: ${file.name || 'Untitled'}`}>
                                                <div className="aspect-square w-full flex items-center justify-center bg-gray-50 rounded mb-1 pointer-events-none overflow-hidden"> {renderDefaultPreview(file)} </div>
                                                <p className="text-xs text-center font-medium text-gray-800 truncate w-full pointer-events-none" title={file.name}> {file.name || 'Untitled'} </p>
                                                <p className="text-[10px] text-gray-500 pointer-events-none">{formatBytes(file.size)}</p>
                                                {isSelected && (<div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center pointer-events-none"> <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"></path></svg> </div>)}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {/* Upload Tab */}
                    {activeTab === 'upload' && !combinedLoading && !combinedError && (
                        <FileDropZone onFilesAdded={handleFilesAdded} isLoading={combinedLoading} className="min-h-[300px] flex flex-col items-center justify-center border-gray-300 hover:border-blue-400">
                           <div className="text-center p-6 pointer-events-none">
                               <input ref={uploadInputRef} type="file" accept={accept} onChange={handleUploadInputChange} className="hidden" multiple={selectionMode === 'multiple'} disabled={combinedLoading}/>
                               <div className="mb-4 pointer-events-auto">
                                    <button type="button" onClick={triggerUploadInput} disabled={combinedLoading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"> Select File(s) </button>
                               </div>
                               <p className="text-sm text-gray-500 mb-4">or Drag & Drop</p>
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                               <div className="mt-6 flex items-center justify-center pointer-events-auto">
                                   <input id="savePreferenceCheckbox" type="checkbox" checked={savePreference} onChange={(e) => setSavePreference(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600" />
                                   <label htmlFor="savePreferenceCheckbox" className="ml-2 block text-sm text-gray-700"> Add uploaded file(s) to Library </label>
                               </div>
                           </div>
                        </FileDropZone>
                    )}
                </div>

                 {/* Footer */}
                 <div className="p-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center gap-3 flex-shrink-0">
                      <div> {activeTab === 'library' && selectionMode === 'multiple' && (<span className="text-sm text-gray-600"> {selectedIds.size} selected </span>)} {(activeTab !== 'library' || selectionMode !== 'multiple') && <span> </span>} </div>
                     <div className="flex gap-3">
                         <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition-colors"> Cancel </button>
                         {activeTab === 'library' && ( <button type="button" onClick={() => handleConfirmSelection()} disabled={selectedIds.size === 0 || combinedLoading} className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-colors"> Confirm Selection </button> )}
                     </div>
                 </div>
            </div>
        </div>
    );
};
export default FileSelectionModal;