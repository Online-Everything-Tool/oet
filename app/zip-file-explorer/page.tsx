// /app/zip-file-explorer/page.tsx
'use client';

import React, { useState, useCallback, ChangeEvent, useRef, useMemo, useEffect } from 'react';
import JSZip from 'jszip';
import type { JSZipObject } from 'jszip';
import { useHistory } from '../context/HistoryContext'; // Adjust path if needed
import { useDebounce } from 'use-debounce';

// --- Interface ---
interface ZipEntry {
  id: string;
  name: string;
  isDirectory: boolean;
  date: Date;
  _zipObject: JSZipObject;
}

// --- Sort/Direction Types ---
type SortKey = 'name' | 'date';
type SortDirection = 'asc' | 'desc';

// --- Constants (Moved Outside Component) ---
const MAX_TEXT_PREVIEW_SIZE = 1 * 1024 * 1024; // 1 MB limit for text files
const PREVIEWABLE_TEXT_EXTENSIONS = ['txt', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm', 'json', 'xml', 'md', 'csv', 'log', 'yaml', 'yml', 'ini', 'cfg', 'sh', 'py', 'rb', 'php', 'sql'];
const PREVIEWABLE_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];

// --- The Component ---
export default function ZipFileExplorerPage() {
  const { addHistoryEntry } = useHistory();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileList, setFileList] = useState<ZipEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const zipRef = useRef<JSZip | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for Sorting
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // State for Filters
  const [filterName, setFilterName] = useState<string>('');
  const [filterMinDate, setFilterMinDate] = useState<string>('');
  const [filterMaxDate, setFilterMaxDate] = useState<string>('');

  // Debounced filter value
  const [debouncedFilterName] = useDebounce(filterName, 300);

  // State for Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'text' | 'image' | 'unsupported' | 'loading' | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);


  // --- Handlers ---
  const processZipFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setFileList([]);
    zipRef.current = null;
    // Reset filters
    setFilterName('');
    setFilterMinDate('');
    setFilterMaxDate('');

    try {
      const zip = new JSZip();
      zipRef.current = await zip.loadAsync(file);
      const entries: ZipEntry[] = [];
      zipRef.current.forEach((relativePath, zipEntry: JSZipObject) => {
        if (!zipEntry.dir) {
          entries.push({
            id: zipEntry.name,
            name: zipEntry.name,
            isDirectory: zipEntry.dir,
            date: zipEntry.date,
            _zipObject: zipEntry,
          });
        }
      });
      setFileList(entries);
      addHistoryEntry({
        toolName: 'Zip File Explorer',
        toolRoute: '/zip-file-explorer',
        input: file.name,
        output: `${entries.length} files found`,
        status: 'success',
      });
    } catch (err: any) {
      console.error("Error processing zip file:", err);
      const errorMessage = err.message || 'Failed to read or process the zip file. It might be corrupted or not a valid zip.';
      setError(errorMessage);
       addHistoryEntry({
         toolName: 'Zip File Explorer',
         toolRoute: '/zip-file-explorer',
         input: file.name,
         status: 'error',
         output: errorMessage
       });
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
        setFileList([]);
        setError(null);
        setSortKey('name'); // Reset sort
        setSortDirection('asc');
        // Filters reset within processZipFile
        processZipFile(file);
      } else {
        setSelectedFile(null); setFileList([]);
        setError('Invalid file type. Please select a .zip file.');
        if(fileInputRef.current) fileInputRef.current.value = '';
      }
    } else {
      setSelectedFile(null); setFileList([]); setError(null);
    }
  }, [processZipFile]);

  const handleClear = useCallback(() => {
    setSelectedFile(null); setFileList([]); setError(null);
    zipRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSortKey('name'); setSortDirection('asc');
    // Reset filter state
    setFilterName('');
    setFilterMinDate('');
    setFilterMaxDate('');
  }, []);

  const handleDownload = useCallback(async (entry: ZipEntry) => {
     if (!entry || !entry._zipObject) return;
    setError(null);
    try {
        const blob = await entry._zipObject.async('blob');
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = entry.name.substring(entry.name.lastIndexOf('/') + 1) || entry.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (err: any) {
        console.error(`Error downloading file ${entry.name}:`, err);
        setError(`Failed to generate download for ${entry.name}. ${err.message || ''}`);
    }
  }, []);

  const handleSort = useCallback((key: SortKey) => {
      setSortDirection((prevDirection) => (sortKey === key ? (prevDirection === 'asc' ? 'desc' : 'asc') : 'asc'));
      setSortKey(key);
  }, [sortKey]);

  const handlePreview = useCallback(async (entry: ZipEntry) => {
    if (!entry || entry.isDirectory || !entry._zipObject) return;

    setIsPreviewOpen(true);
    setPreviewFilename(entry.name);
    setPreviewContent(null);
    setPreviewError(null);
    setPreviewType('loading');

    const filenameLower = entry.name.toLowerCase();
    const extension = filenameLower.substring(filenameLower.lastIndexOf('.') + 1);

    try {
      if (PREVIEWABLE_TEXT_EXTENSIONS.includes(extension)) {
        const textContent = await entry._zipObject.async('string');
        if (textContent.length > MAX_TEXT_PREVIEW_SIZE) {
            setPreviewContent(textContent.substring(0, MAX_TEXT_PREVIEW_SIZE) + '\n\n--- Content truncated ---');
        } else {
             setPreviewContent(textContent);
        }
        setPreviewType('text');
      } else if (PREVIEWABLE_IMAGE_EXTENSIONS.includes(extension)) {
        const blob = await entry._zipObject.async('blob');
        const objectUrl = URL.createObjectURL(blob);
        setPreviewContent(objectUrl);
        setPreviewType('image');
      } else {
        setPreviewType('unsupported');
      }
    } catch (err: any) {
      console.error(`Error generating preview for ${entry.name}:`, err);
      setPreviewError(`Failed to load preview: ${err.message || 'Unknown error'}`);
      setPreviewType('unsupported');
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
        console.log("Revoking Object URL:", currentObjectUrl);
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [isPreviewOpen, previewType, previewContent]);

  // Filtered and Sorted List
   const filteredAndSortedFileList = useMemo(() => {
    if (!fileList) return [];
    const minDate = filterMinDate ? new Date(filterMinDate) : null;
    const maxDate = filterMaxDate ? new Date(filterMaxDate) : null;
    if(maxDate) maxDate.setHours(23, 59, 59, 999);
    const nameLower = debouncedFilterName.toLowerCase();

    const filtered = fileList.filter(entry => {
        if (nameLower && !entry.name.toLowerCase().includes(nameLower)) return false;
        if (minDate && !isNaN(minDate.getTime()) && entry.date < minDate) return false;
        if (maxDate && !isNaN(maxDate.getTime()) && entry.date > maxDate) return false;
        return true;
    });

    return [...filtered].sort((a, b) => {
        let compareA: string | Date; let compareB: string | Date;
        switch (sortKey) {
            case 'date': compareA = a.date; compareB = b.date; break;
            case 'name': default: compareA = a.name; compareB = b.name;
                return sortDirection === 'asc' ? compareA.localeCompare(compareB) : compareB.localeCompare(compareA);
        }
        if (compareA < compareB) return sortDirection === 'asc' ? -1 : 1;
        if (compareA > compareB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
  }, [fileList, sortKey, sortDirection, debouncedFilterName, filterMinDate, filterMaxDate]);

  // Clear Filters Handler
   const clearFilters = useCallback(() => {
        setFilterName('');
        setFilterMinDate('');
        setFilterMaxDate('');
   }, []);

   // Close Preview Handler
    const closePreview = () => {
      setIsPreviewOpen(false);
  }


  // --- Return JSX ---
  return (
    <div className="space-y-6">
        <h1 className="text-2xl font-bold">Zip File Explorer</h1>
        <p>Select a .zip file to view its contents directly in your browser.</p>

        {/* Input Area */}
        <div className="p-4 border rounded bg-gray-50 space-y-4">
            <div>
              <label htmlFor="zipInput" className="block text-sm font-medium text-gray-700 mb-1">
                Select Zip File:
              </label>
              <input
                ref={fileInputRef}
                type="file"
                id="zipInput"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                disabled={isLoading}
              />
               {/* Status Text */}
               <div className="mt-2 text-sm text-gray-600 h-5">
                 {isLoading && selectedFile && <span>Processing: <em>{selectedFile.name}</em>...</span>}
                 {!isLoading && fileList.length > 0 && selectedFile && <span>Loaded: <strong>{selectedFile.name}</strong>. Ready for next selection.</span>}
               </div>
            </div>
            {(selectedFile || isLoading) && (
                 <button
                    onClick={handleClear}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                > Clear Selection </button>
            )}
        </div>

        {/* Filter Controls Area */}
        {!isLoading && fileList.length > 0 && (
            <div className="p-4 border rounded bg-gray-50 space-y-4">
                <h3 className="text-lg font-semibold">Filter Results</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <label htmlFor="filterName" className="block font-medium text-gray-700 mb-1">Name contains:</label>
                        <input type="text" id="filterName" value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="e.g., .txt, image" className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                         <div>
                             <label htmlFor="filterMinDate" className="block font-medium text-gray-700 mb-1">Min Date:</label>
                             <input type="date" id="filterMinDate" value={filterMinDate} onChange={(e) => setFilterMinDate(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                         </div>
                         <div>
                            <label htmlFor="filterMaxDate" className="block font-medium text-gray-700 mb-1">Max Date:</label>
                            <input type="date" id="filterMaxDate" value={filterMaxDate} onChange={(e) => setFilterMaxDate(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                    </div>
                </div>
                 {(filterName || filterMinDate || filterMaxDate) && (
                     <button onClick={clearFilters} className="px-3 py-1 rounded-md text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"> Clear Filters </button>
                 )}
            </div>
        )}

        {/* Status/Error Area */}
        {isLoading && <p className="text-blue-600 animate-pulse">Processing zip file...</p>}
        {error && <p className="text-red-600 font-semibold">Error: {error}</p>}

        {/* Results Area */}
        {!isLoading && fileList.length > 0 && (
            <div className="p-4 border rounded">
                <h2 className="text-lg font-semibold mb-2">
                     Showing {filteredAndSortedFileList.length} of {fileList.length} entries in "{selectedFile?.name}":
                </h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}> Name {sortKey === 'name' && (sortDirection === 'asc' ? '▲' : '▼')} </th>
                                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('date')}> Modified Date {sortKey === 'date' && (sortDirection === 'asc' ? '▲' : '▼')} </th>
                                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                             {filteredAndSortedFileList.length > 0 ? (
                                filteredAndSortedFileList.map((entry) => (
                                    <tr key={entry.id}>
                                        <td className="px-3 py-2 whitespace-nowrap font-mono break-all">{entry.name}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{entry.date.toLocaleString()}</td>
                                        <td className="px-3 py-2 whitespace-nowrap space-x-2">
                                            {!entry.isDirectory && (
                                                <>
                                                    <button onClick={() => handleDownload(entry)} title={`Download ${entry.name}`} className="text-blue-600 hover:text-blue-800 transition duration-150 ease-in-out text-xs font-medium p-1 rounded hover:bg-blue-50"> Download </button>
                                                    <button onClick={() => handlePreview(entry)} title={`Preview ${entry.name}`} className="text-green-600 hover:text-green-800 transition duration-150 ease-in-out text-xs font-medium p-1 rounded hover:bg-green-50"> Preview </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))
                             ) : (
                                 <tr>
                                     <td colSpan={3} className="text-center py-4 text-gray-500 italic">No entries match the current filters.</td>
                                 </tr>
                             )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* Preview Modal */}
        {isPreviewOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
              onClick={closePreview}
            >
                <div
                  className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                    {/* Modal Header */}
                    <div className="p-3 px-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                        <h3 className="text-lg font-semibold truncate" title={previewFilename || ''}>
                            {previewFilename || 'Preview'}
                        </h3>
                        <button onClick={closePreview} className="text-gray-500 hover:text-gray-800 text-2xl font-bold leading-none px-2 py-1 rounded hover:bg-gray-200">×</button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-4 overflow-auto flex-grow min-h-[200px]">
                        {previewType === 'loading' && <p className="text-center text-gray-500 animate-pulse">Loading preview...</p>}
                        {previewError && <p className="text-red-600">Error: {previewError}</p>}

                        {!previewError && previewType === 'text' && (
                             <pre className="text-sm whitespace-pre-wrap break-words max-h-[75vh] overflow-auto">
                                 <code>{previewContent}</code>
                             </pre>
                        )}
                        {!previewError && previewType === 'image' && previewContent && (
                            <div className="flex justify-center items-center h-full">
                                <img
                                    src={previewContent} // Object URL
                                    alt={previewFilename || 'Preview'}
                                    className="max-w-full max-h-[75vh] object-contain"
                                    onError={() => setPreviewError('Failed to load image resource.')}
                                />
                            </div>
                        )}
                        {!previewError && previewType === 'unsupported' && (
                             <p className="text-center text-gray-500">Preview not available for this file type.</p>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}