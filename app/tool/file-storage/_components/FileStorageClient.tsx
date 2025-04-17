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
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [feedbackState, setFeedbackState] = useState<Record<string, { type: 'copy' | 'download' | 'error'; message: string } | null>>({});
    const [layout, setLayout] = useState<'list' | 'grid'>('grid');

    const { addHistoryEntry } = useHistory();
    const { listFiles, addFile, deleteFile, clearAllFiles, getFile } = useFileLibrary();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // --- Callbacks ---

    const setItemFeedback = useCallback((id: string, type: 'copy' | 'download' | 'error' | null, message: string = '') => {
        setFeedbackState(prev => ({ ...prev, [id]: type ? { type, message } : null }));
        if (type && type !== 'error') {
            setTimeout(() => {
                setFeedbackState(prev => (prev[id]?.type === type ? { ...prev, [id]: null } : prev));
            }, 2000);
        }
    }, []); // No external dependencies needed

    const loadAndDisplayFiles = useCallback(async () => {
        const limit = 50;
        setError(null); setIsLoading(true);
        try {
            const files = await listFiles(limit, undefined, false);
            setStoredFiles(files);
        } catch (err: unknown) { console.error('[FileStorage] Error loading files:', err); setError('Failed to load stored files.'); setStoredFiles([]); }
        finally { setIsLoading(false); }
    }, [listFiles]); // Depends on listFiles from context

    useEffect(() => { loadAndDisplayFiles(); }, [loadAndDisplayFiles]);

    const saveNewFile = useCallback(async (file: File, trigger: TriggerType) => {
        let historyOutput: string | Record<string, unknown> = ''; let status: 'success' | 'error' = 'success'; let fileId: string | undefined = undefined; const inputDetails: Record<string, unknown> = { fileName: file.name, fileType: file.type, fileSize: file.size, source: trigger };
        try { fileId = await addFile(file, file.name || `file-${Date.now()}`, file.type); historyOutput = { message: `File "${file.name}" added successfully.`, fileId: fileId }; }
        catch (err) { const message = err instanceof Error ? err.message : 'Unknown error saving file.'; setError(prev => (prev ? `${prev}; Failed to save "${file.name}"` : `Failed to save "${file.name}"`)); status = 'error'; historyOutput = `Error saving "${file.name}": ${message}`; inputDetails.error = message; }
        finally { addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: trigger, input: inputDetails, output: historyOutput, status: status }); }
    }, [addFile, addHistoryEntry, toolRoute, toolTitle]); // Correct dependencies

    const handleFilesAdded = useCallback(async (files: File[]) => {
        if (!files || files.length === 0) return; setError(null); setIsProcessing(true); const trigger: TriggerType = 'upload'; const savePromises = files.map(file => saveNewFile(file, trigger)); await Promise.all(savePromises); await loadAndDisplayFiles(); setIsProcessing(false);
    }, [saveNewFile, loadAndDisplayFiles]); // Correct dependencies

    const handleAddClick = () => { fileInputRef.current?.click(); };

    const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files; if (files && files.length > 0) { await handleFilesAdded(Array.from(files)); } if (event.target) event.target.value = '';
    }, [handleFilesAdded]); // Correct dependency

    const handleDeleteSingleFile = useCallback(async (fileId: string) => {
        if (isDeleting) return; setIsDeleting(fileId); setError(null); const fileToDelete = storedFiles.find(f => f.id === fileId); const fileName = fileToDelete?.name || `File ID ${fileId}`;
        try { await deleteFile(fileId); await loadAndDisplayFiles(); addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { deletedFileId: fileId, deletedFileName: fileName }, output: { message: `Deleted "${fileName}"` }, status: 'success' }); }
        catch (err) { const message = err instanceof Error ? err.message : 'Unknown error deleting file.'; setError(`Failed to delete "${fileName}". ${message}`); addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { deletedFileId: fileId, error: message }, output: `Error deleting "${fileName}": ${message}`, status: 'error' }); }
        finally { setIsDeleting(null); }
    }, [isDeleting, storedFiles, deleteFile, loadAndDisplayFiles, addHistoryEntry, toolRoute, toolTitle]); // Correct dependencies

    const handleClearAll = useCallback(async () => {
        if (isLoading || isProcessing || isDeleting || storedFiles.length === 0) return; if (!confirm(`Are you sure you want to delete all ${storedFiles.length} stored file(s)? This cannot be undone.`)) return; setError(null); setIsLoading(true); const count = storedFiles.length;
        try { await clearAllFiles(false); setStoredFiles([]); addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { clearAllCount: count }, output: `Cleared all ${count} files.`, status: 'success' }); }
        catch (err) { const message = err instanceof Error ? err.message : 'Unknown error clearing files.'; setError(`Failed to clear all files. ${message}`); addHistoryEntry({ toolName: toolTitle, toolRoute: toolRoute, trigger: 'click', input: { clearAllCount: count, error: message }, output: `Error clearing files: ${message}`, status: 'error' }); await loadAndDisplayFiles(); }
        finally { setIsLoading(false); }
    }, [isLoading, isProcessing, isDeleting, storedFiles, clearAllFiles, addHistoryEntry, toolRoute, toolTitle, loadAndDisplayFiles]); // Correct dependencies

    const handleSendTo = useCallback((fileId: string) => {
        const fileToSend = storedFiles.find(f => f.id === fileId); if (fileToSend?.type === 'application/zip' || fileToSend?.category === 'archive') { router.push(`/tool/zip-file-explorer/?fileId=${fileId}`); } else { alert(`"Send To" not implemented for this file type yet. File ID: ${fileId}`); console.log("Send To clicked for:", fileId); }
    }, [storedFiles, router]); // Correct dependencies

    const handleDownloadFile = useCallback(async (fileId: string) => {
        setError(null); setItemFeedback(fileId, null);
        try { const file = await getFile(fileId); if (!file?.blob) throw new Error("File data not found."); const url = URL.createObjectURL(file.blob); const link = document.createElement('a'); link.href = url; link.download = file.name || `download-${fileId}`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); setItemFeedback(fileId, 'download', 'Downloaded!'); }
        catch (err) { const message = err instanceof Error ? err.message : 'Unknown download error.'; console.error(`Error downloading file ${fileId}:`, err); setItemFeedback(fileId, 'error', `Download failed: ${message}`); }
    }, [getFile, setItemFeedback]); // Correct dependencies

    const handleCopyFileContent = useCallback(async (fileId: string) => {
        setError(null); setItemFeedback(fileId, null);
        try { const file = await getFile(fileId); if (!file?.blob) throw new Error("File data not found."); if (!isTextBasedMimeType(file.type)) throw new Error("Cannot copy content of this file type."); if (!navigator.clipboard?.writeText) throw new Error("Clipboard API (writeText) not available."); const textContent = await file.blob.text(); await navigator.clipboard.writeText(textContent); setItemFeedback(fileId, 'copy', 'Copied!'); }
        catch (err) { const message = err instanceof Error ? err.message : 'Unknown copy error.'; console.error(`Error copying file content ${fileId}:`, err); setItemFeedback(fileId, 'error', `Copy failed: ${message}`); }
    }, [getFile, setItemFeedback]); // Correct dependencies

    // Default preview renderer for grid view
    const renderDefaultPreview = useCallback((file: StoredFile): React.ReactNode => {
        const fileType = file.type || '';
        // Note: This basic version doesn't handle thumbnail previews yet
        if (file.category === 'image' || fileType.startsWith('image/')) { return <Image src="/icon-org.svg" alt="Image file icon" width={48} height={48} className="opacity-50" />; }
        if (file.category === 'archive' || fileType === 'application/zip') return <span className="text-4xl opacity-50">📦</span>;
        if (file.category === 'text' || fileType.startsWith('text/')) return <span className="text-4xl opacity-50">📄</span>;
        if (file.category === 'document' || fileType === 'application/pdf') return <span className="text-4xl opacity-50">📕</span>;
        return <span className="text-4xl opacity-50">❔</span>;
    }, []); // No external dependencies for this simple version

    // --- Render Logic ---
    const showLoading = isLoading && storedFiles.length === 0;
    const showEmpty = !isLoading && storedFiles.length === 0 && !isProcessing;

    return (
         <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
             <input ref={fileInputRef} id="fileUploadHidden" type="file" onChange={handleFileChange} className="hidden" disabled={isProcessing} multiple />
             <FileStorageControls isLoading={isLoading || isProcessing} isPasting={false} isDeleting={isDeleting !== null} storedFileCount={storedFiles.length} currentLayout={layout} onAddClick={handleAddClick} onClearAllClick={handleClearAll} onLayoutChange={setLayout} />
             {error && ( <div role="alert" className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm"> <strong>Error:</strong> {error} </div> )}
             <FileDropZone onFilesAdded={handleFilesAdded} isLoading={isProcessing}>
                 {showLoading && ( <div className="flex items-center justify-center min-h-[200px]"><p className="text-center p-4 text-gray-500 italic animate-pulse">Loading stored files...</p></div> )}
                 {showEmpty && ( <div className="flex items-center justify-center min-h-[200px]"><p className="text-center p-4 text-gray-500 italic">Your file library is empty. Add files using the button above, or drag & drop here.</p></div> )}
                 {!showLoading && !showEmpty && ( layout === 'list' ? ( <FileListView files={storedFiles} isLoading={isLoading || isProcessing} isDeleting={isDeleting} feedbackState={feedbackState} onSendTo={handleSendTo} onCopy={handleCopyFileContent} onDownload={handleDownloadFile} onDelete={handleDeleteSingleFile} /> ) : ( <FileGridView files={storedFiles} isLoading={isLoading || isProcessing} isDeleting={isDeleting} feedbackState={feedbackState} onSendTo={handleSendTo} onCopy={handleCopyFileContent} onDownload={handleDownloadFile} onDelete={handleDeleteSingleFile} renderPreview={renderDefaultPreview} /> ) )}
             </FileDropZone>
         </div>
      );
}