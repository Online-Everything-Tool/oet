// FILE: app/tool/file-storage/_components/FileStorageClient.tsx
'use client';

import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useHistory, TriggerType } from '../../../context/HistoryContext';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { StoredFile } from '@/src/types/storage';
import FileStorageControls from './FileStorageControls';
import FileListView from '../../_components/storage/FileListView';
import FileGridView from '../../_components/storage/FileGridView';
import FileDropZone from '../../_components/storage/FileDropZone';

interface FileStorageClientProps {
  toolTitle: string;
  toolRoute: string;
}

const isTextBasedMimeType = (mimeType: string | undefined): boolean => {
    if (!mimeType) return false;
    return mimeType.startsWith('text/') ||
           mimeType === 'application/json' ||
           mimeType === 'application/xml' ||
           mimeType === 'application/javascript' ||
           mimeType === 'application/csv';
};

export default function FileStorageClient({ toolTitle, toolRoute }: FileStorageClientProps) {
    const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
    const [feedbackState, setFeedbackState] = useState<Record<string, { type: 'copy' | 'download' | 'error'; message: string } | null>>({});
    const [layout, setLayout] = useState<'list' | 'grid'>('grid');
    const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(new Map());
    const managedUrlsRef = useRef<Map<string, string>>(new Map());
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

    const { addHistoryEntry } = useHistory();
    const { listFiles, addFile, deleteFile, clearAllFiles, getFile } = useFileLibrary();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const revokeManagedUrls = useCallback(() => {
        managedUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        managedUrlsRef.current.clear();
    }, []);

    const updateObjectUrls = useCallback((filesToUpdate: StoredFile[]) => {
         const newUrlMap = new Map<string, string>(previewUrls);
         let changed = false;
         filesToUpdate.forEach(file => {
             if (!file.id) return;
             const existingUrl = managedUrlsRef.current.get(file.id);
             const blobToUse = file.thumbnailBlob || (file.type?.startsWith('image/') ? file.blob : null);
             if (blobToUse) {
                 if (!existingUrl) {
                     try {
                         const url = URL.createObjectURL(blobToUse);
                         newUrlMap.set(file.id, url);
                         managedUrlsRef.current.set(file.id, url);
                         changed = true;
                     } catch (e) {
                         console.error(`[FileStorageClient] Error creating Object URL for file ID ${file.id}:`, e);
                         if (newUrlMap.has(file.id)) {
                             newUrlMap.delete(file.id); changed = true;
                         }
                     }
                 } else {
                     if (!newUrlMap.has(file.id)) {
                         newUrlMap.set(file.id, existingUrl); changed = true;
                     }
                 }
             } else {
                 if (managedUrlsRef.current.has(file.id)) {
                     const urlToRevoke = managedUrlsRef.current.get(file.id);
                     if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
                     managedUrlsRef.current.delete(file.id);
                     newUrlMap.delete(file.id);
                     changed = true;
                 } else if (newUrlMap.has(file.id)) {
                     newUrlMap.delete(file.id); changed = true;
                 }
             }
         });
         if (changed) {
             setPreviewUrls(newUrlMap);
         }
    }, [previewUrls]);

    useEffect(() => { return () => { revokeManagedUrls(); }; }, [revokeManagedUrls]);

    useEffect(() => {
        updateObjectUrls(storedFiles);
        const currentFileIds = new Set(storedFiles.map(f => f.id));
        const urlsToRemove = new Map<string, string>();
        managedUrlsRef.current.forEach((url, id) => {
            if (!currentFileIds.has(id)) { urlsToRemove.set(id, url); }
        });
        if (urlsToRemove.size > 0) {
            const newPreviewMap = new Map(previewUrls);
            urlsToRemove.forEach((url, id) => {
                URL.revokeObjectURL(url);
                managedUrlsRef.current.delete(id);
                newPreviewMap.delete(id);
            });
            setPreviewUrls(newPreviewMap);
        }
     }, [storedFiles, updateObjectUrls, previewUrls]);

    const setItemFeedback = useCallback((id: string, type: 'copy' | 'download' | 'error' | null, message: string = '') => {
        setFeedbackState(prev => ({ ...prev, [id]: type ? { type, message } : null }));
        if (type && type !== 'error') {
            setTimeout(() => {
                setFeedbackState(prev => (prev[id]?.type === type ? { ...prev, [id]: null } : prev));
            }, 2000);
        }
    }, []);

    const loadAndDisplayFiles = useCallback(async () => {
        const limit = 100;
        setError(null); setIsLoading(true);
        try {
            const files = await listFiles(limit, false);
            setStoredFiles(files);
        } catch (err: unknown) { console.error('[FileStorage] Error loading files:', err); setError('Failed to load stored files.'); setStoredFiles([]); }
        finally { setIsLoading(false); }
    }, [listFiles]);

    useEffect(() => { loadAndDisplayFiles(); }, [loadAndDisplayFiles]);

    const saveNewFile = useCallback(async (file: File, trigger: TriggerType) => {
        let historyOutput: string | Record<string, unknown> = ''; let status: 'success' | 'error' = 'success'; let fileId: string | undefined = undefined; const inputDetails: Record<string, unknown> = { fileName: file.name, fileType: file.type, fileSize: file.size, source: trigger };
        try {
            fileId = await addFile(file, file.name || `file-${Date.now()}`, file.type, false);
            historyOutput = { message: `File "${file.name}" added successfully.`, fileId: fileId };
        }
        catch (err) { const message = err instanceof Error ? err.message : 'Unknown error saving file.'; setError(prev => (prev ? `${prev}; Failed to save "${file.name}"` : `Failed to save "${file.name}"`)); status = 'error'; historyOutput = `Error saving "${file.name}": ${message}`; inputDetails.error = message; }
        finally {
            addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: trigger, input: inputDetails, output: historyOutput, status: status, eventTimestamp: Date.now() });
        }
        return fileId;
    }, [addFile, addHistoryEntry, toolRoute, toolTitle]);

    const handleFilesAdded = useCallback(async (files: File[]) => {
        if (!files || files.length === 0) return; setError(null); setIsProcessing(true); const trigger: TriggerType = 'upload'; const savePromises = files.map(file => saveNewFile(file, trigger)); await Promise.all(savePromises); await loadAndDisplayFiles(); setIsProcessing(false);
    }, [saveNewFile, loadAndDisplayFiles]);

    const handleAddClick = () => { fileInputRef.current?.click(); };

    const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files; if (files && files.length > 0) { await handleFilesAdded(Array.from(files)); } if (event.target) event.target.value = '';
    }, [handleFilesAdded]);

    const handleDeleteSingleFile = useCallback(async (fileId: string) => {
        if (isBulkDeleting || selectedFileIds.has(fileId)) return;
        setIsProcessing(true);
        setError(null);
        const fileToDelete = storedFiles.find(f => f.id === fileId);
        const fileName = fileToDelete?.name || `File ID ${fileId}`;
        try {
            await deleteFile(fileId);
            await loadAndDisplayFiles();
            setSelectedFileIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(fileId);
                return newSet;
            });
            addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { deletedFileId: fileId, deletedFileName: fileName }, output: { message: `Deleted "${fileName}"` }, status: 'success', eventTimestamp: Date.now() });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error deleting file.';
            setError(`Failed to delete "${fileName}". ${message}`);
            addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { deletedFileId: fileId, error: message }, output: `Error deleting "${fileName}": ${message}`, status: 'error', eventTimestamp: Date.now() });
        } finally {
            setIsProcessing(false);
        }
    }, [isBulkDeleting, selectedFileIds, storedFiles, deleteFile, loadAndDisplayFiles, addHistoryEntry, toolRoute, toolTitle]);

    const handleClearAll = useCallback(async () => {
        if (isLoading || isProcessing || isBulkDeleting || storedFiles.length === 0 || selectedFileIds.size > 0) return;
        if (!confirm(`Are you sure you want to delete all ${storedFiles.length} stored file(s)? This cannot be undone.`)) return;
        setError(null); setIsLoading(true);
        const count = storedFiles.length;
        try {
            await clearAllFiles(false);
            setStoredFiles([]);
            setSelectedFileIds(new Set());
            addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { clearAllCount: count }, output: `Cleared all ${count} user files.`, status: 'success', eventTimestamp: Date.now() });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error clearing files.';
            setError(`Failed to clear all files. ${message}`);
            addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { clearAllCount: count, error: message }, output: `Error clearing files: ${message}`, status: 'error', eventTimestamp: Date.now() });
            await loadAndDisplayFiles();
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, isProcessing, isBulkDeleting, storedFiles, selectedFileIds, clearAllFiles, addHistoryEntry, toolRoute, toolTitle, loadAndDisplayFiles]);

    const handleSendTo = useCallback((fileId: string) => {
        const fileToSend = storedFiles.find(f => f.id === fileId);
        if (fileToSend?.type === 'application/zip' || fileToSend?.type === 'application/x-zip-compressed') {
            router.push(`/tool/zip-file-explorer/?fileId=${fileId}`);
        } else {
            alert(`"Send To" not implemented for type "${fileToSend?.type || 'unknown'}". File ID: ${fileId}`);
            console.log("Send To clicked for:", fileId, fileToSend?.type);
        }
    }, [storedFiles, router]);

    const handleDownloadFile = useCallback(async (fileId: string) => {
        setError(null); setItemFeedback(fileId, null);
        try { const file = await getFile(fileId); if (!file?.blob) throw new Error("File data not found."); const url = URL.createObjectURL(file.blob); const link = document.createElement('a'); link.href = url; link.download = file.name || `download-${fileId}`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); setItemFeedback(fileId, 'download', 'Downloaded!'); }
        catch (err) { const message = err instanceof Error ? err.message : 'Unknown download error.'; console.error(`Error downloading file ${fileId}:`, err); setItemFeedback(fileId, 'error', `Download failed: ${message}`); }
    }, [getFile, setItemFeedback]);

    const handleCopyFileContent = useCallback(async (fileId: string) => {
        setError(null); setItemFeedback(fileId, null);
        try { const file = await getFile(fileId); if (!file?.blob) throw new Error("File data not found."); if (!isTextBasedMimeType(file.type)) throw new Error("Cannot copy content of this file type."); if (!navigator.clipboard?.writeText) throw new Error("Clipboard API (writeText) not available."); const textContent = await file.blob.text(); await navigator.clipboard.writeText(textContent); setItemFeedback(fileId, 'copy', 'Copied!'); }
        catch (err) { const message = err instanceof Error ? err.message : 'Unknown copy error.'; console.error(`Error copying file content ${fileId}:`, err); setItemFeedback(fileId, 'error', `Copy failed: ${message}`); }
    }, [getFile, setItemFeedback]);

    const handleToggleSelection = useCallback((fileId: string) => {
        setSelectedFileIds(prevSelected => {
            const newSelected = new Set(prevSelected);
            if (newSelected.has(fileId)) {
                newSelected.delete(fileId);
            } else {
                newSelected.add(fileId);
            }
            return newSelected;
        });
    }, []);

    const handleDeleteSelected = useCallback(async () => {
        if (selectedFileIds.size === 0 || isLoading || isProcessing || isBulkDeleting) return;

        const count = selectedFileIds.size;
        if (!confirm(`Are you sure you want to delete ${count} selected file(s)?`)) return;

        setIsBulkDeleting(true);
        setError(null);
        const idsToDelete = Array.from(selectedFileIds);
        const deletedNames: string[] = [];
        const errors: string[] = [];

        for (const id of idsToDelete) {
            const file = storedFiles.find(f => f.id === id);
            const name = file?.name || `File ID ${id}`;
            try {
                await deleteFile(id);
                deletedNames.push(name);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                console.error(`Error deleting file ${id} (${name}):`, err);
                errors.push(`Failed to delete "${name}": ${message}`);
            }
        }

        await loadAndDisplayFiles();
        setSelectedFileIds(new Set());

        let historyOutput: Record<string, unknown> | string = {};
        let finalStatus: 'success' | 'error' = 'success';

        if (errors.length === 0) {
            historyOutput = { message: `Deleted ${count} selected file(s).`, deletedCount: count, deletedNames: deletedNames };
        } else {
            finalStatus = 'error';
            const errorMessage = `Errors occurred during deletion: ${errors.join('; ')}`;
            setError(errorMessage);
            historyOutput = { message: errorMessage, deletedCount: deletedNames.length, errorCount: errors.length, errors: errors };
        }

        addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            trigger: 'click',
            input: { deletedFileIds: idsToDelete, requestedCount: count },
            output: historyOutput,
            status: finalStatus,
            eventTimestamp: Date.now()
        });

        setIsBulkDeleting(false);
    }, [selectedFileIds, isLoading, isProcessing, isBulkDeleting, storedFiles, deleteFile, loadAndDisplayFiles, addHistoryEntry, toolRoute, toolTitle]);

    const renderDefaultPreview = useCallback((file: StoredFile): React.ReactNode => {
        const objectUrl = previewUrls.get(file.id);
        if (objectUrl) {
            return ( <Image src={objectUrl} alt={file.name || 'Stored image preview'} width={150} height={150} className="max-w-full max-h-full object-contain pointer-events-none" unoptimized /> );
        }
        const fileType = file.type || '';
        if (fileType.startsWith('application/zip') || fileType.startsWith('application/x-zip')) return <span className="text-4xl opacity-50">📦</span>;
        if (fileType.startsWith('text/')) return <span className="text-4xl opacity-50">📄</span>;
        if (fileType === 'application/pdf') return <span className="text-4xl opacity-50">📕</span>;
        if (fileType.startsWith('image/')) return <Image src="/icon-org.svg" alt="Image file icon" width={48} height={48} className="opacity-50" />;
        return <span className="text-4xl opacity-50">❔</span>;
    }, [previewUrls]);

    const showLoading = isLoading && storedFiles.length === 0;
    const showEmpty = !isLoading && storedFiles.length === 0 && !isProcessing && !isBulkDeleting;
    const anyOperationInProgress = isProcessing || isBulkDeleting;

    return (
         <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
             <input ref={fileInputRef} id="fileUploadHidden" type="file" onChange={handleFileChange} className="hidden" disabled={anyOperationInProgress} multiple />
             <FileStorageControls
                 isLoading={isLoading || anyOperationInProgress}
                 isDeleting={anyOperationInProgress}
                 storedFileCount={storedFiles.length}
                 currentLayout={layout}
                 selectedFileCount={selectedFileIds.size}
                 onAddClick={handleAddClick}
                 onClearAllClick={handleClearAll}
                 onLayoutChange={setLayout}
                 onDeleteSelectedClick={handleDeleteSelected}
            />
             {error && ( <div role="alert" className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm"> <strong>Error:</strong> {error} </div> )}

             <FileDropZone onFilesAdded={handleFilesAdded} isLoading={anyOperationInProgress}>
                 {showLoading && ( <div className="flex items-center justify-center min-h-[200px]"><p className="text-center p-4 text-gray-500 italic animate-pulse">Loading stored files...</p></div> )}
                 {showEmpty && ( <div className="flex items-center justify-center min-h-[200px]"><p className="text-center p-4 text-gray-500 italic">Your file library is empty. Add files using the button above, or drag & drop here.</p></div> )}
                 {!showLoading && !showEmpty && ( layout === 'list' ? (
                     <FileListView
                         files={storedFiles}
                         isLoading={isLoading || anyOperationInProgress}
                         isBulkDeleting={isBulkDeleting}
                         selectedIds={selectedFileIds}
                         feedbackState={feedbackState}
                         onSendTo={handleSendTo}
                         onCopy={handleCopyFileContent}
                         onDownload={handleDownloadFile}
                         onDelete={handleDeleteSingleFile}
                         onToggleSelection={handleToggleSelection}
                    />
                 ) : (
                     <FileGridView
                         files={storedFiles}
                         isLoading={isLoading || anyOperationInProgress}
                         isBulkDeleting={isBulkDeleting}
                         selectedIds={selectedFileIds}
                         feedbackState={feedbackState}
                         onSendTo={handleSendTo}
                         onCopy={handleCopyFileContent}
                         onDownload={handleDownloadFile}
                         onDelete={handleDeleteSingleFile}
                         renderPreview={renderDefaultPreview}
                         onToggleSelection={handleToggleSelection}
                    />
                 )
                )}
             </FileDropZone>
         </div>
      );
}