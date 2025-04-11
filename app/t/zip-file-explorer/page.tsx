// /app/zip-file-explorer/page.tsx
'use client';

import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { useHistory } from '../../context/HistoryContext'; // Adjust path if needed

// --- Import from new files ---
import type { RawZipEntry, TreeNodeData, ActionEntryData } from './types';
import { buildFileTree } from './utils';
import TreeNode from './TreeNode'; // Import the TreeNode component
// --- End Imports ---

// Constants
const MAX_TEXT_PREVIEW_SIZE = 1 * 1024 * 1024;
const PREVIEWABLE_TEXT_EXTENSIONS = ['txt', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm', 'json', 'xml', 'md', 'csv', 'log', 'yaml', 'yml', 'ini', 'cfg', 'sh', 'py', 'rb', 'php', 'sql'];
const PREVIEWABLE_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];

export default function ZipFileExplorerPage() {
  const { addHistoryEntry } = useHistory();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // State holds the tree structure
  const [fileTree, setFileTree] = useState<TreeNodeData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const zipRef = useRef<JSZip | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for Sorting (Currently inactive on tree view)
  // const [sortKey, setSortKey] = useState<SortKey>('name');
  // const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // State for Filters (Currently inactive on tree view)
  const [filterName, setFilterName] = useState<string>('');
  const [filterMinDate, setFilterMinDate] = useState<string>('');
  const [filterMaxDate, setFilterMaxDate] = useState<string>('');
  // const [debouncedFilterName] = useDebounce(filterName, 300); // Filter logic disabled for tree

  // State for Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'text' | 'image' | 'unsupported' | 'loading' | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // State for expanded folders
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());


  // --- Handlers ---
  const processZipFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setFileTree([]); // Reset tree
    setExpandedFolders(new Set()); // Reset expansion
    zipRef.current = null;
    // Reset filters
    setFilterName('');
    setFilterMinDate('');
    setFilterMaxDate('');

    try {
      const zip = new JSZip();
      zipRef.current = await zip.loadAsync(file);
      const rawEntries: RawZipEntry[] = [];
      zipRef.current.forEach((relativePath, zipEntry) => {
        rawEntries.push({
          name: zipEntry.name,
          isDirectory: zipEntry.dir,
          date: zipEntry.date,
          _zipObject: zipEntry,
        });
      });

      // Build and set the tree
      const treeData = buildFileTree(rawEntries);
      setFileTree(treeData);

      addHistoryEntry({
        toolName: 'Zip File Explorer', toolRoute: '/zip-file-explorer',
        input: file.name,
        output: `${rawEntries.filter(e => !e.isDirectory).length} files found`, status: 'success',
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Error processing zip file:", err);
      const errorMessage = err.message || 'Failed to read or process the zip file.';
      setError(errorMessage);
      addHistoryEntry({ toolName: 'Zip File Explorer', toolRoute: '/zip-file-explorer', input: file.name, status: 'error', output: errorMessage });
      zipRef.current = null;
    } finally {
      setIsLoading(false);
      if(fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [addHistoryEntry]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    zipRef.current = null;
    if (file) {
      if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || file.name.toLowerCase().endsWith('.zip')) {
        setSelectedFile(file);
        setFileTree([]); // Reset tree state
        setError(null);
        // setSortKey('name'); // Sorting disabled for now
        // setSortDirection('asc');
        processZipFile(file);
      } else {
        setSelectedFile(null); setFileTree([]);
        setError('Invalid file type. Please select a .zip file.');
        if(fileInputRef.current) fileInputRef.current.value = '';
      }
    } else {
      setSelectedFile(null); setFileTree([]); setError(null);
    }
  }, [processZipFile]);

  const handleClear = useCallback(() => {
    setSelectedFile(null); setFileTree([]); setError(null);
    zipRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
    // setSortKey('name'); setSortDirection('asc'); // Sorting disabled
    setFilterName(''); setFilterMinDate(''); setFilterMaxDate('');
    setExpandedFolders(new Set()); // Reset expanded folders
  }, []);

  const handleDownload = useCallback(async (entryData: ActionEntryData) => {
     if (!entryData || !entryData._zipObject) return;
    setError(null); // Clear previous main errors on new action
    try {
        const blob = await entryData._zipObject.async('blob');
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = entryData.name.substring(entryData.name.lastIndexOf('/') + 1) || entryData.name;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
        console.error(`Error downloading file ${entryData.name}:`, err);
        setError(`Failed to generate download for ${entryData.name}. ${err.message || ''}`);
    }
  }, []);

  // const handleSort = useCallback(...) // Sorting logic needs rework for tree

  const handlePreview = useCallback(async (entryData: ActionEntryData) => {
    if (!entryData || !entryData._zipObject) return;

    setIsPreviewOpen(true);
    setPreviewFilename(entryData.name);
    setPreviewContent(null);
    setPreviewError(null); // Clear previous preview errors
    setPreviewType('loading');

    const filenameLower = entryData.name.toLowerCase();
    const extension = filenameLower.substring(filenameLower.lastIndexOf('.') + 1);

    try {
      if (PREVIEWABLE_TEXT_EXTENSIONS.includes(extension)) {
        const textContent = await entryData._zipObject.async('string');
        setPreviewContent(
            textContent.length > MAX_TEXT_PREVIEW_SIZE
             ? textContent.substring(0, MAX_TEXT_PREVIEW_SIZE) + '\n\n--- Content truncated ---'
             : textContent
        );
        setPreviewType('text');
      } else if (PREVIEWABLE_IMAGE_EXTENSIONS.includes(extension)) {
        const blob = await entryData._zipObject.async('blob');
        const objectUrl = URL.createObjectURL(blob);
        setPreviewContent(objectUrl);
        setPreviewType('image');
      } else {
        setPreviewType('unsupported');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(`Error generating preview for ${entryData.name}:`, err);
      setPreviewError(`Failed to load preview: ${err.message || 'Unknown error'}`);
      setPreviewType('unsupported'); // Show error in modal
    }
  }, []);

  // Effect for cleaning up Object URLs
  useEffect(() => {
    let currentObjectUrl: string | null = null;
    if (isPreviewOpen && previewType === 'image' && previewContent?.startsWith('blob:')) {
      currentObjectUrl = previewContent;
    }
    return () => {
      if (currentObjectUrl) {
        // console.log("Revoking Object URL:", currentObjectUrl); // Keep for debugging if needed
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [isPreviewOpen, previewType, previewContent]);


  // Filtered and Sorted List (COMMENTED OUT - apply filter/sort to tree is complex)
  // const filteredAndSortedTree = useMemo(() => {
  //    // TODO: Implement recursive filtering/sorting on fileTree
  //    return fileTree; // Return unfiltered/unsorted tree for now
  // }, [fileTree, debouncedFilterName, filterMinDate, filterMaxDate /*, sortKey, sortDirection */ ]);

  // Clear Filters Handler
   const clearFilters = useCallback(() => {
        setFilterName(''); setFilterMinDate(''); setFilterMaxDate('');
   }, []);

   // Close Preview Handler
    const closePreview = () => {
      setIsPreviewOpen(false);
  }

   // Toggle Folder Expansion Handler
   const toggleFolder = useCallback((folderPath: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderPath)) {
                newSet.delete(folderPath);
            } else {
                newSet.add(folderPath);
            }
            return newSet;
        });
    }, []);


  // --- Return JSX ---
  return (
    <div className="space-y-6">
        <h1 className="text-2xl font-bold">Zip File Explorer</h1>
        <p>Select a .zip file to view its contents (folders & files).</p>

        {/* Input Area */}
        <div className="p-4 border rounded bg-gray-50 space-y-4">
             <div>
              <label htmlFor="zipInput" className="block text-sm font-medium text-gray-700 mb-1">Select Zip File:</label>
              <input ref={fileInputRef} type="file" id="zipInput" accept=".zip,application/zip,application/x-zip-compressed" onChange={handleFileChange} className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50" disabled={isLoading}/>
               <div className="mt-2 text-sm text-gray-600 h-5">
                 {isLoading && selectedFile && <span>Processing: <em>{selectedFile.name}</em>...</span>}
                 {/* Show file count based on tree length or maybe calculate file count? */}
                 {!isLoading && fileTree.length > 0 && selectedFile && <span>Loaded: <strong>{selectedFile.name}</strong>. Ready for next selection.</span>}
               </div>
            </div>
            {(selectedFile || isLoading) && (<button onClick={handleClear} disabled={isLoading} className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition duration-150 ease-in-out"> Clear Selection </button> )}
        </div>

        {/* Filter Controls Area (Filters are not functional on tree view yet) */}
        {!isLoading && fileTree.length > 0 && (
            <div className="p-4 border rounded bg-gray-50 space-y-4">
                 <h3 className="text-lg font-semibold">Filter Results <span className="text-xs font-normal text-gray-500">(Note: Filters currently inactive on tree view)</span></h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <label htmlFor="filterName" className="block font-medium text-gray-700 mb-1">Name contains:</label>
                        <input type="text" id="filterName" value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="e.g., .txt, image" className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                         <div> <label htmlFor="filterMinDate" className="block font-medium text-gray-700 mb-1">Min Date:</label> <input type="date" id="filterMinDate" value={filterMinDate} onChange={(e) => setFilterMinDate(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" /> </div>
                         <div> <label htmlFor="filterMaxDate" className="block font-medium text-gray-700 mb-1">Max Date:</label> <input type="date" id="filterMaxDate" value={filterMaxDate} onChange={(e) => setFilterMaxDate(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" /> </div>
                    </div>
                 </div>
                 {(filterName || filterMinDate || filterMaxDate) && (<button onClick={clearFilters} className="px-3 py-1 rounded-md text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"> Clear Filters </button>)}
            </div>
        )}

        {/* Status/Error Area */}
        {isLoading && <p className="text-blue-600 animate-pulse">Processing zip file...</p>}
        {error && <p className="text-red-600 font-semibold">Error: {error}</p>}

        {/* Results Area - Render Tree */}
        {!isLoading && fileTree.length > 0 && (
            <div className="p-4 border rounded">
                <h2 className="text-lg font-semibold mb-2"> Contents of &ldquo;{selectedFile?.name}&rdquo;: </h2>
                <div className="font-mono text-sm space-y-1 max-h-[60vh] overflow-auto">
                     {/* Use fileTree state */}
                     {fileTree.length > 0 ? fileTree.map(node => (
                        <TreeNode
                            key={node.id}
                            node={node}
                            level={0} // Root nodes start at level 0
                            expandedFolders={expandedFolders} // Pass state down
                            onToggle={toggleFolder}
                            onDownload={handleDownload}
                            onPreview={handlePreview}
                        />
                     )) : (
                         <p className="text-center text-gray-500 italic py-4">No files or folders found in the archive.</p>
                     )}
                </div>
            </div>
        )}
         {/* Show message if zip was processed but resulted in no tree data */}
         {!isLoading && !error && selectedFile && fileTree.length === 0 && (
             <p className="p-4 text-gray-500 italic">No files or folders found in &ldquo;{selectedFile.name}&rdquo;.</p>
         )}

        {/* Preview Modal */}
        {isPreviewOpen && (
           <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={closePreview} >
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()} >
                    {/* Modal Header */}
                    <div className="p-3 px-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg"> <h3 className="text-lg font-semibold truncate" title={previewFilename || ''}> {previewFilename || 'Preview'} </h3> <button onClick={closePreview} className="text-gray-500 hover:text-gray-800 text-2xl font-bold leading-none px-2 py-1 rounded hover:bg-gray-200">×</button> </div>
                    {/* Modal Body */}
                    <div className="p-4 overflow-auto flex-grow min-h-[200px]">
                        {previewType === 'loading' && <p className="text-center text-gray-500 animate-pulse">Loading preview...</p>}
                        {previewError && <p className="text-red-600">Error: {previewError}</p>}
                        {!previewError && previewType === 'text' && ( <pre className="text-sm whitespace-pre-wrap break-words max-h-[75vh] overflow-auto"> <code>{previewContent}</code> </pre> )}
                        {!previewError && previewType === 'image' && previewContent && ( <div className="flex justify-center items-center h-full"> <img src={previewContent} alt={previewFilename || 'Preview'} className="max-w-full max-h-[75vh] object-contain" onError={() => setPreviewError('Failed to load image resource.')} /> </div> )}
                        {!previewError && previewType === 'unsupported' && ( <p className="text-center text-gray-500">Preview not available for this file type.</p> )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}