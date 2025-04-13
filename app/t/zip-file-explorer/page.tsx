'use client';

import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import Image from 'next/image';
import { useHistory } from '../../context/HistoryContext';
import ToolHeader from '../_components/ToolHeader'; // Import ToolHeader
import metadata from './metadata.json'; // Import local metadata

// --- Import from local files ---
import type { RawZipEntry, TreeNodeData, ActionEntryData } from './_components/types';
import { buildFileTree } from './_components/utils';
import TreeNode from './_components/TreeNode';
// --- End Imports ---


// Constants for Preview Logic (Keep as before)
const MAX_TEXT_PREVIEW_SIZE = 1 * 1024 * 1024; // 1MB limit
const PREVIEWABLE_TEXT_EXTENSIONS = ['txt', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm', 'json', 'xml', 'md', 'csv', 'log', 'yaml', 'yml', 'ini', 'cfg', 'sh', 'py', 'rb', 'php', 'sql'];
const PREVIEWABLE_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];

export default function ZipFileExplorerPage() {
  const { addHistoryEntry } = useHistory();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTree, setFileTree] = useState<TreeNodeData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const zipRef = useRef<JSZip | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for Filters (UI shown but logic inactive)
  const [filterName, setFilterName] = useState<string>('');
  const [filterMinDate, setFilterMinDate] = useState<string>('');
  const [filterMaxDate, setFilterMaxDate] = useState<string>('');

  // State for Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'text' | 'image' | 'unsupported' | 'loading' | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // State for managing expanded folders
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());


  // --- Handlers --- (Logic remains the same, history toolName updated)

  // Processes the selected zip file
  const processZipFile = useCallback(async (file: File) => {
    setIsLoading(true); setError(null); setFileTree([]);
    setExpandedFolders(new Set()); zipRef.current = null;
    setFilterName(''); setFilterMinDate(''); setFilterMaxDate('');

    let rawEntriesCount = 0;
    try {
      const zip = new JSZip();
      zipRef.current = await zip.loadAsync(file);
      const rawEntries: RawZipEntry[] = [];
      zipRef.current.forEach((relativePath, zipEntry) => {
        if (zipEntry.name && !zipEntry.name.startsWith('__MACOSX/')) {
            rawEntries.push({ name: zipEntry.name, isDirectory: zipEntry.dir, date: zipEntry.date, _zipObject: zipEntry });
        }
      });
      rawEntriesCount = rawEntries.filter(e => !e.isDirectory).length;

      const treeData = buildFileTree(rawEntries);
      setFileTree(treeData);

      addHistoryEntry({
        toolName: metadata.title, // Use metadata title
        toolRoute: '/t/zip-file-explorer', // Use correct route
        action: 'load-zip', input: file.name,
        output: `${rawEntriesCount} files found`, status: 'success',
      });
    } catch (err: unknown) {
      console.error("Error processing zip file:", err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to read zip file.';
      setError(errorMessage);
      addHistoryEntry({
          toolName: metadata.title, // Use metadata title
          toolRoute: '/t/zip-file-explorer', // Use correct route
          action: 'load-zip-failed', input: file.name,
          status: 'error', output: errorMessage
        });
      zipRef.current = null;
    } finally { setIsLoading(false); }
  }, [addHistoryEntry]);

  // Clears all state and resets file input
  const handleClear = useCallback(() => {
    const hadFile = selectedFile !== null;
    setSelectedFile(null); setFileTree([]); setError(null);
    zipRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFilterName(''); setFilterMinDate(''); setFilterMaxDate('');
    setExpandedFolders(new Set()); setIsPreviewOpen(false);
    // Log clear only if a file was previously loaded
    if (hadFile) {
       addHistoryEntry({
          toolName: metadata.title,
          toolRoute: '/t/zip-file-explorer',
          action: 'clear', input: '',
          output: 'Cleared loaded file and state', status: 'success',
       });
    }
  }, [selectedFile, addHistoryEntry]); // Added dependency

  // Handles new file selection
  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    handleClear(); // Clear previous state first
    if (file) {
      if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || file.name.toLowerCase().endsWith('.zip')) {
        setSelectedFile(file);
        processZipFile(file);
      } else {
        const errorMsg = 'Invalid file type. Please select a .zip file.';
        setError(errorMsg);
         addHistoryEntry({ // Log invalid file type attempt
            toolName: metadata.title,
            toolRoute: '/t/zip-file-explorer',
            action: 'load-zip-failed', input: file.name,
            status: 'error', output: errorMsg
         });
        if(fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  }, [processZipFile, handleClear, addHistoryEntry]); // Added dependency

  // Handles downloading a specific file entry
  const handleDownload = useCallback(async (entryData: ActionEntryData) => {
     if (!entryData?._zipObject) { setError(`Download error: Zip object missing for ${entryData.name}`); return; }
    setError(null);
    const zipObject = entryData._zipObject;
    const filenameToSave = entryData.id.split('/').pop() || entryData.name;

    try {
        const blob = await zipObject.async('blob');
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = filenameToSave;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        addHistoryEntry({
            toolName: metadata.title, toolRoute: '/t/zip-file-explorer',
            action: 'download-file', input: entryData.id,
            output: `Downloaded ${filenameToSave}`, status: 'success',
        });
    } catch (err: unknown) {
        console.error(`Error downloading file ${entryData.id}:`, err);
        const message = err instanceof Error ? err.message : 'Unknown download error';
        setError(`Download failed for ${filenameToSave}: ${message}`);
         addHistoryEntry({
            toolName: metadata.title, toolRoute: '/t/zip-file-explorer',
            action: 'download-failed', input: entryData.id,
            output: `Error downloading ${filenameToSave}: ${message}`, status: 'error',
        });
    }
  }, [addHistoryEntry]);

  // Handles previewing a specific file entry
  const handlePreview = useCallback(async (entryData: ActionEntryData) => {
     if (!entryData?._zipObject) {
        setPreviewError(`Preview error: Zip object missing for ${entryData.name}`);
        setPreviewType('unsupported'); setIsPreviewOpen(true); return;
     }
    setIsPreviewOpen(true); setPreviewFilename(entryData.id);
    setPreviewContent(null); setPreviewError(null); setPreviewType('loading');
    const zipObject = entryData._zipObject;
    const filenameLower = entryData.id.toLowerCase();
    const extension = filenameLower.substring(filenameLower.lastIndexOf('.') + 1);
    let generatedPreviewType: typeof previewType = 'unsupported';

    try {
      if (PREVIEWABLE_TEXT_EXTENSIONS.includes(extension)) {
        const textContent = await zipObject.async('string');
        setPreviewContent( textContent.length > MAX_TEXT_PREVIEW_SIZE ? textContent.substring(0, MAX_TEXT_PREVIEW_SIZE) + '\n\n--- Content truncated ---' : textContent );
        generatedPreviewType = 'text';
      } else if (PREVIEWABLE_IMAGE_EXTENSIONS.includes(extension)) {
        const blob = await zipObject.async('blob');
        const objectUrl = URL.createObjectURL(blob);
        setPreviewContent(objectUrl);
        generatedPreviewType = 'image';
        // Note: No automatic revoke here, done in useEffect cleanup
      }
      setPreviewType(generatedPreviewType);
      addHistoryEntry({
            toolName: metadata.title, toolRoute: '/t/zip-file-explorer',
            action: 'preview-file', input: entryData.id,
            output: `Preview type: ${generatedPreviewType}`, status: 'success',
      });
    } catch (err: unknown) {
      console.error(`Error generating preview for ${entryData.id}:`, err);
      const message = err instanceof Error ? err.message : 'Unknown preview error';
      setPreviewError(`Failed to load preview: ${message}`);
      setPreviewType('unsupported');
      addHistoryEntry({
            toolName: metadata.title, toolRoute: '/t/zip-file-explorer',
            action: 'preview-failed', input: entryData.id,
            output: `Preview error: ${message}`, status: 'error',
      });
    }
  }, [addHistoryEntry]);

  // Effect for cleaning up Object URLs
  useEffect(() => {
    let currentObjectUrl: string | null = null;
    if (previewType === 'image' && previewContent?.startsWith('blob:')) {
      currentObjectUrl = previewContent;
    }
    // Cleanup function
    return () => {
        if (currentObjectUrl) {
            console.log("Revoking Object URL:", currentObjectUrl); // Debug log
            URL.revokeObjectURL(currentObjectUrl);
        }
    };
  }, [previewType, previewContent]); // Re-run when these change


   // Close Preview Handler
    const closePreview = useCallback(() => {
      setIsPreviewOpen(false);
      // No need to revoke here, useEffect handles it
      setPreviewContent(null); setPreviewType(null);
      setPreviewFilename(null); setPreviewError(null);
  }, []);

   // Toggle Folder Expansion Handler
   const toggleFolder = useCallback((folderPath: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderPath)) newSet.delete(folderPath);
            else newSet.add(folderPath);
            return newSet;
        });
    }, []);


  // --- Return JSX ---
  return (
    // Main container relies on parent layout for padding, uses flex-col and gap
    <div className="flex flex-col gap-6">
        <ToolHeader
            title={metadata.title}
            description={metadata.description}
        />

        {/* Inner content container */}
        <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">

            {/* Input Area */}
            <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] space-y-3">
                 <div>
                  <label htmlFor="zipInput" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Select Zip File:</label>
                  {/* Basic File Input - Styling browser-dependent */}
                  <input
                     ref={fileInputRef}
                     type="file"
                     id="zipInput"
                     accept=".zip,application/zip,application/x-zip-compressed"
                     onChange={handleFileChange}
                     className="block w-full text-sm text-[rgb(var(--color-text-base))] border border-[rgb(var(--color-input-border))] rounded-lg cursor-pointer bg-[rgb(var(--color-input-bg))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))] file:mr-4 file:py-2 file:px-4 file:rounded-l-md file:border-0 file:text-sm file:font-semibold file:bg-[rgb(var(--color-bg-subtle))] file:text-[rgb(var(--color-text-link))] hover:file:bg-[rgba(var(--color-text-link)/0.1)]"
                     disabled={isLoading}
                   />
                   {/* Status Text */}
                   <div className="mt-2 text-sm text-[rgb(var(--color-text-muted))] h-5">
                     {isLoading && selectedFile && <span>Processing: <em>{selectedFile.name}</em>...</span>}
                     {!isLoading && selectedFile && fileTree.length > 0 && <span>Loaded: <strong>{selectedFile.name}</strong>.</span>}
                     {!isLoading && selectedFile && fileTree.length === 0 && !error && <span>Loaded <strong>{selectedFile.name}</strong>, appears empty.</span>}
                     {!isLoading && !selectedFile && !error && <span>Ready for file selection.</span>}
                   </div>
                </div>
                {/* Clear Button (Danger) */}
                {(selectedFile || fileTree.length > 0 || error) && (
                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-md text-sm font-medium text-[rgb(var(--color-button-danger-text))] bg-[rgb(var(--color-button-danger-bg))] hover:bg-[rgb(var(--color-button-danger-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"
                    >
                        Clear
                    </button>
                 )}
            </div>

            {/* Filter Controls Area (Inactive Appearance) */}
            {!isLoading && fileTree.length > 0 && (
                <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] space-y-4 opacity-60 cursor-not-allowed" title="Filtering/Sorting not implemented yet">
                     <h3 className="text-lg font-semibold text-[rgb(var(--color-text-muted))]">Filter Results <span className="text-xs font-normal">(Inactive)</span></h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <label htmlFor="filterName" className="block font-medium text-[rgb(var(--color-text-muted))] mb-1">Name contains:</label>
                            <input disabled type="text" id="filterName" value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="e.g., .txt, image" className="w-full px-2 py-1 border border-[rgb(var(--color-input-border))] rounded-md shadow-sm bg-[rgb(var(--color-input-disabled-bg))] text-[rgb(var(--color-text-muted))]" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label htmlFor="filterMinDate" className="block font-medium text-[rgb(var(--color-text-muted))] mb-1">Min Date:</label>
                                <input disabled type="date" id="filterMinDate" value={filterMinDate} onChange={(e) => setFilterMinDate(e.target.value)} className="w-full px-2 py-1 border border-[rgb(var(--color-input-border))] rounded-md shadow-sm bg-[rgb(var(--color-input-disabled-bg))] text-[rgb(var(--color-text-muted))]" />
                              </div>
                             <div>
                                 <label htmlFor="filterMaxDate" className="block font-medium text-[rgb(var(--color-text-muted))] mb-1">Max Date:</label>
                                 <input disabled type="date" id="filterMaxDate" value={filterMaxDate} onChange={(e) => setFilterMaxDate(e.target.value)} className="w-full px-2 py-1 border border-[rgb(var(--color-input-border))] rounded-md shadow-sm bg-[rgb(var(--color-input-disabled-bg))] text-[rgb(var(--color-text-muted))]" />
                             </div>
                        </div>
                     </div>
                </div>
            )}

            {/* Status/Error Area */}
            {isLoading && <p className="text-center text-[rgb(var(--color-text-link))] p-4">Processing zip file...</p>}
            {error && (
                <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-center gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    <strong className="font-semibold">Error:</strong> {error}
                </div>
            )}

            {/* Results Area - Render Tree */}
            {!isLoading && fileTree.length > 0 && (
                <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md">
                    <h2 className="text-lg font-semibold mb-2 text-[rgb(var(--color-text-base))]"> Contents of “{selectedFile?.name}”: </h2>
                    {/* Tree container */}
                    <div className="font-mono text-sm space-y-1 max-h-[60vh] overflow-auto border border-[rgb(var(--color-border-base))] rounded p-2 bg-[rgb(var(--color-bg-component))]">
                         {fileTree.map(node => (
                            <TreeNode
                                key={node.id} node={node} level={0}
                                expandedFolders={expandedFolders}
                                onToggle={toggleFolder}
                                onDownload={handleDownload}
                                onPreview={handlePreview}
                            />
                         ))}
                    </div>
                </div>
            )}
            {/* Message if zip processed but empty */}
             {!isLoading && !error && selectedFile && fileTree.length === 0 && (
                 <p className="p-4 text-[rgb(var(--color-text-muted))] italic">No entries found in “{selectedFile.name}”.</p>
             )}

            {/* Preview Modal */}
            {isPreviewOpen && (
               <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={closePreview} aria-modal="true" role="dialog" aria-labelledby="preview-modal-title">
                    {/* Modal Content */}
                    <div className="bg-[rgb(var(--color-bg-component))] rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col text-[rgb(var(--color-text-base))]" onClick={(e) => e.stopPropagation()} >
                        {/* Modal Header */}
                        <div className="p-3 px-4 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center bg-[rgb(var(--color-bg-subtle))] rounded-t-lg">
                            <h3 id="preview-modal-title" className="text-lg font-semibold truncate" title={previewFilename || ''}>{previewFilename || 'Preview'}</h3>
                            <button onClick={closePreview} title="Close Preview" className="text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-base))] text-2xl font-bold leading-none px-2 py-1 rounded hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none">×</button>
                        </div>
                        {/* Modal Body */}
                        <div className="p-4 overflow-auto flex-grow min-h-[200px]">
                            {previewType === 'loading' && <p className="text-center text-[rgb(var(--color-text-muted))]">Loading preview...</p>}
                            {previewError && (
                                <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                    <strong className="font-semibold">Error:</strong> {previewError}
                                </div>
                            )}
                            {/* Text Preview */}
                            {!previewError && previewType === 'text' && ( <pre className="text-sm whitespace-pre-wrap break-words max-h-[75vh] overflow-auto"> <code>{previewContent}</code> </pre> )}
                            {/* Image Preview */}
                            {!previewError && previewType === 'image' && previewContent && (
                                <div className="flex justify-center items-center h-full">
                                    <Image
                                        src={previewContent}
                                        alt={previewFilename || 'Image preview'}
                                        width={800} height={600}
                                        className="max-w-full max-h-[75vh] object-contain" // Changed style object to className
                                        onError={() => setPreviewError('Failed to load image resource.')}
                                        unoptimized={true} // Necessary for blob URLs
                                    />
                                </div>
                            )}
                            {/* Unsupported Preview */}
                            {!previewError && previewType === 'unsupported' && ( <p className="text-center text-[rgb(var(--color-text-muted))]">Preview not available for this file type.</p> )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}