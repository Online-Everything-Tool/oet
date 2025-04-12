// /app/t/zip-file-explorer/page.tsx
'use client';

import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import Image from 'next/image'; // Import next/image
import { useHistory } from '../../context/HistoryContext'; // Adjust path if needed

// --- Import from local files ---
// Assuming these types and utils are defined in separate files in the same directory
import type { RawZipEntry, TreeNodeData, ActionEntryData } from './types';
import { buildFileTree } from './utils'; // Assuming buildFileTree is in utils.ts
import TreeNode from './TreeNode';
// --- End Imports ---


// Constants for Preview Logic
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


  // --- Handlers ---

  // Processes the selected zip file
  const processZipFile = useCallback(async (file: File) => {
    setIsLoading(true); setError(null); setFileTree([]);
    setExpandedFolders(new Set()); zipRef.current = null;
    setFilterName(''); setFilterMinDate(''); setFilterMaxDate('');

    let rawEntriesCount = 0; // Keep track for logging
    try {
      const zip = new JSZip();
      zipRef.current = await zip.loadAsync(file);
      const rawEntries: RawZipEntry[] = [];
      zipRef.current.forEach((relativePath, zipEntry) => {
        if (zipEntry.name && !zipEntry.name.startsWith('__MACOSX/')) {
            rawEntries.push({ name: zipEntry.name, isDirectory: zipEntry.dir, date: zipEntry.date, _zipObject: zipEntry });
        }
      });
      rawEntriesCount = rawEntries.filter(e => !e.isDirectory).length; // Count files

      const treeData = buildFileTree(rawEntries);
      setFileTree(treeData);

      // *** UNCOMMENTED: History entry for load success ***
      addHistoryEntry({
        toolName: 'Zip File Explorer', toolRoute: '/t/zip-file-explorer',
        action: 'load-zip', input: file.name,
        output: `${rawEntriesCount} files found`, status: 'success',
      });
    } catch (err: unknown) {
      console.error("Error processing zip file:", err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to read zip file.';
      setError(errorMessage);
      // *** UNCOMMENTED: History entry for load error ***
      addHistoryEntry({
          toolName: 'Zip File Explorer', toolRoute: '/t/zip-file-explorer',
          action: 'load-zip-failed', input: file.name,
          status: 'error', output: errorMessage
        });
      zipRef.current = null;
    } finally { setIsLoading(false); }
  }, [addHistoryEntry]);

  // Clears all state and resets file input
  const handleClear = useCallback(() => {
    setSelectedFile(null); setFileTree([]); setError(null);
    zipRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFilterName(''); setFilterMinDate(''); setFilterMaxDate('');
    setExpandedFolders(new Set()); setIsPreviewOpen(false);
    // Intentionally not logging manual clear actions to history
  }, []);

  // Handles new file selection
  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    handleClear(); // Clear previous state first
    if (file) {
      if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || file.name.toLowerCase().endsWith('.zip')) {
        setSelectedFile(file);
        processZipFile(file);
      } else {
        setError('Invalid file type. Please select a .zip file.');
        if(fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  }, [processZipFile, handleClear]);

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
        // *** UNCOMMENTED: History entry for download success ***
        addHistoryEntry({
            toolName: 'Zip File Explorer', toolRoute: '/t/zip-file-explorer',
            action: 'download-file', input: entryData.id,
            output: `Downloaded ${filenameToSave}`, status: 'success',
        });
    } catch (err: unknown) {
        console.error(`Error downloading file ${entryData.id}:`, err);
        const message = err instanceof Error ? err.message : 'Unknown download error';
        setError(`Download failed for ${filenameToSave}: ${message}`);
        // *** UNCOMMENTED: History entry for download error ***
         addHistoryEntry({
            toolName: 'Zip File Explorer', toolRoute: '/t/zip-file-explorer',
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
      }
      setPreviewType(generatedPreviewType); // Set final type
      // *** UNCOMMENTED: History entry for preview success ***
      addHistoryEntry({
            toolName: 'Zip File Explorer', toolRoute: '/t/zip-file-explorer',
            action: 'preview-file', input: entryData.id,
            output: `Preview type: ${generatedPreviewType}`, status: 'success',
      });
    } catch (err: unknown) {
      console.error(`Error generating preview for ${entryData.id}:`, err);
      const message = err instanceof Error ? err.message : 'Unknown preview error';
      setPreviewError(`Failed to load preview: ${message}`);
      setPreviewType('unsupported');
      // *** UNCOMMENTED: History entry for preview error ***
      addHistoryEntry({
            toolName: 'Zip File Explorer', toolRoute: '/t/zip-file-explorer',
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
    return () => { if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl); };
  }, [previewType, previewContent]);


   // Close Preview Handler
    const closePreview = useCallback(() => {
      setIsPreviewOpen(false);
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
    <div className="space-y-6 p-4">
        <h1 className="text-2xl font-bold text-gray-800">Zip File Explorer</h1>
        <p className="text-gray-600">Select a .zip file to view its contents.</p>

        {/* Input Area */}
        <div className="p-4 border rounded bg-gray-50 space-y-4">
             <div>
              <label htmlFor="zipInput" className="block text-sm font-medium text-gray-700 mb-1">Select Zip File:</label>
              <input ref={fileInputRef} type="file" id="zipInput" accept=".zip,application/zip,application/x-zip-compressed" onChange={handleFileChange} className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50" disabled={isLoading}/>
               <div className="mt-2 text-sm text-gray-600 h-5">
                 {isLoading && selectedFile && <span>Processing: <em>{selectedFile.name}</em>...</span>}
                 {!isLoading && selectedFile && fileTree.length > 0 && <span>Loaded: <strong>{selectedFile.name}</strong>.</span>}
                 {!isLoading && selectedFile && fileTree.length === 0 && !error && <span>Loaded <strong>{selectedFile.name}</strong>, appears empty.</span>}
                 {!isLoading && !selectedFile && !error && <span>Ready for file selection.</span>}
               </div>
            </div>
            {(selectedFile || fileTree.length > 0 || error) && (<button onClick={handleClear} disabled={isLoading} className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition duration-150 ease-in-out"> Clear </button> )}
        </div>

        {/* Filter Controls Area (Inactive) */}
        {!isLoading && fileTree.length > 0 && (
            <div className="p-4 border rounded bg-gray-50 space-y-4 opacity-50 cursor-not-allowed" title="Filtering/Sorting not implemented for tree view yet">
                 <h3 className="text-lg font-semibold">Filter Results <span className="text-xs font-normal">(Inactive)</span></h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div> <label htmlFor="filterName" className="block font-medium text-gray-700 mb-1">Name contains:</label> <input disabled type="text" id="filterName" value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="e.g., .txt, image" className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm" /> </div>
                    <div className="grid grid-cols-2 gap-2">
                         <div> <label htmlFor="filterMinDate" className="block font-medium text-gray-700 mb-1">Min Date:</label> <input disabled type="date" id="filterMinDate" value={filterMinDate} onChange={(e) => setFilterMinDate(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm" /> </div>
                         <div> <label htmlFor="filterMaxDate" className="block font-medium text-gray-700 mb-1">Max Date:</label> <input disabled type="date" id="filterMaxDate" value={filterMaxDate} onChange={(e) => setFilterMaxDate(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm" /> </div>
                    </div>
                 </div>
            </div>
        )}

        {/* Status/Error Area */}
        {isLoading && <p className="text-center text-blue-600 animate-pulse p-4">Processing zip file...</p>}
        {error && <p className="text-red-600 font-semibold p-4 border border-red-200 bg-red-50 rounded">Error: {error}</p>}

        {/* Results Area - Render Tree */}
        {!isLoading && fileTree.length > 0 && (
            <div className="p-4 border rounded">
                <h2 className="text-lg font-semibold mb-2"> Contents of “{selectedFile?.name}”: </h2>
                <div className="font-mono text-sm space-y-1 max-h-[60vh] overflow-auto border rounded p-2 bg-white">
                     {/* Use fileTree state and pass handlers to TreeNode */}
                     {fileTree.map(node => (
                        <TreeNode
                            key={node.id}
                            node={node}
                            level={0}
                            expandedFolders={expandedFolders}
                            onToggle={toggleFolder} // Pass the actual handler function
                            onDownload={handleDownload} // Pass the actual handler function
                            onPreview={handlePreview} // Pass the actual handler function
                        />
                     ))}
                </div>
            </div>
        )}
        {/* Message if zip processed but empty */}
         {!isLoading && !error && selectedFile && fileTree.length === 0 && (
             <p className="p-4 text-gray-500 italic">No entries found in “{selectedFile.name}”.</p>
         )}

        {/* Preview Modal */}
        {isPreviewOpen && (
           <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={closePreview} >
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()} >
                    {/* Modal Header */}
                    <div className="p-3 px-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                        <h3 className="text-lg font-semibold truncate" title={previewFilename || ''}>{previewFilename || 'Preview'}</h3>
                        <button onClick={closePreview} title="Close Preview" className="text-gray-500 hover:text-gray-800 text-2xl font-bold leading-none px-2 py-1 rounded hover:bg-gray-200">×</button>
                    </div>
                    {/* Modal Body */}
                    <div className="p-4 overflow-auto flex-grow min-h-[200px]">
                        {previewType === 'loading' && <p className="text-center text-gray-500 animate-pulse">Loading preview...</p>}
                        {previewError && <p className="text-red-600">Error: {previewError}</p>}
                        {!previewError && previewType === 'text' && ( <pre className="text-sm whitespace-pre-wrap break-words max-h-[75vh] overflow-auto"> <code>{previewContent}</code> </pre> )}
                        {/* Corrected Image Preview using next/image */}
                        {!previewError && previewType === 'image' && previewContent && (
                            <div className="flex justify-center items-center h-full">
                                <Image
                                    src={previewContent} // Use the blob URL
                                    alt={previewFilename || 'Image preview'}
                                    width={800}  // Max layout width
                                    height={600} // Max layout height
                                    className="max-w-full max-h-[75vh]" // Constrain display size
                                    style={{ objectFit: 'contain' }} // Maintain aspect ratio
                                    onError={() => setPreviewError('Failed to load image resource.')}
                                    unoptimized={true} // For blob/data URLs
                                />
                            </div>
                        )}
                        {!previewError && previewType === 'unsupported' && ( <p className="text-center text-gray-500">Preview not available for this file type.</p> )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}