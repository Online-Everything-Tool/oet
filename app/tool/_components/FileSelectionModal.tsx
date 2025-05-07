// FILE: app/tool/_components/FileSelectionModal.tsx
'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  ChangeEvent,
  useMemo,
} from 'react';
import Image from 'next/image';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { StoredFile } from '@/src/types/storage';
import FileDropZone from './storage/FileDropZone';
import { formatBytes } from '@/app/lib/utils';
import Button from './form/Button'; // Using our custom Button
import { XMarkIcon } from '@heroicons/react/24/outline';

type ModalMode =
  | 'addNewFiles'
  | 'selectExistingOrUploadNew'
  | 'selectExistingOnly';

interface FileSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesSelected: (
    files: StoredFile[],
    source: 'library' | 'upload',
    saveUploadedToLibrary?: boolean // For 'upload' source, indicates if user chose to save (if option was shown)
  ) => void;

  className?: string;
  accept?: string;
  selectionMode?: 'single' | 'multiple';

  mode: ModalMode; // Defines the modal's behavior and visible tabs
  libraryFilter?: { category?: string; type?: string };
  initialTab?: 'library' | 'upload'; // Suggests a tab if multiple are available for the mode
}

const mapTypeToCategory = (mimeType: string | undefined): string => {
  if (!mimeType) return 'other';
  if (mimeType.startsWith('image/')) return 'image';
  if (
    mimeType.startsWith('application/zip') ||
    mimeType === 'application/x-zip-compressed'
  )
    return 'archive';
  if (mimeType.startsWith('text/')) return 'text';
  if (mimeType === 'application/pdf') return 'document';
  return 'other';
};

const FileSelectionModal: React.FC<FileSelectionModalProps> = ({
  isOpen,
  onClose,
  onFilesSelected,
  className,
  accept = '*/*',
  libraryFilter: libraryFilterProp = {},
  selectionMode = 'multiple',
  mode,
  initialTab,
}) => {
  const {
    listFiles,
    addFile,
    getFile,
    loading: libraryLoading,
    error: libraryError,
  } = useFileLibrary();

  const [libraryFiles, setLibraryFiles] = useState<StoredFile[]>([]);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [previewObjectUrls, setPreviewObjectUrls] = useState<
    Map<string, string>
  >(new Map());
  const managedUrlsRef = useRef<Map<string, string>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [savePreference, setSavePreference] = useState<boolean>(
    // For 'addNewFiles' mode, saving is implicit, so checkbox state doesn't matter as much
    // For other modes, default to false (don't save by default unless user checks)
    mode === 'addNewFiles' ? true : false
  );
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Determine which tabs are available and the current active/initial tab based on mode
  const showLibraryTabActive = useMemo(
    () => mode === 'selectExistingOrUploadNew' || mode === 'selectExistingOnly',
    [mode]
  );
  const showUploadTabActive = useMemo(
    () => mode === 'selectExistingOrUploadNew' || mode === 'addNewFiles',
    [mode]
  );

  const determineInitialActiveTab = useCallback(() => {
    if (mode === 'addNewFiles') return 'upload';
    if (mode === 'selectExistingOnly') return 'library';
    // For 'selectExistingOrUploadNew':
    if (initialTab === 'library' && showLibraryTabActive) return 'library';
    if (initialTab === 'upload' && showUploadTabActive) return 'upload';
    // Default for 'selectExistingOrUploadNew' if initialTab is not suitable or not provided
    return showLibraryTabActive ? 'library' : 'upload';
  }, [mode, initialTab, showLibraryTabActive, showUploadTabActive]);

  const [activeTab, setActiveTab] = useState<'library' | 'upload'>(
    determineInitialActiveTab()
  );

  // Effect to update activeTab if mode/initialTab props change while modal is open
  useEffect(() => {
    if (isOpen) {
      const newInitialTab = determineInitialActiveTab();
      if (activeTab !== newInitialTab) {
        setActiveTab(newInitialTab);
      }
    }
  }, [isOpen, mode, initialTab, determineInitialActiveTab, activeTab]);

  const revokeAndClearManagedUrls = useCallback(() => {
    managedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    managedUrlsRef.current.clear();
    setPreviewObjectUrls(new Map());
  }, []);

  // Memoized libraryFilter from prop for stability
  const libraryFilter = useMemo(() => libraryFilterProp, [libraryFilterProp]);

  // Effect for loading/clearing library files
  useEffect(() => {
    const categoryFilterValue = libraryFilter?.category;
    const typeFilterValue = libraryFilter?.type;

    if (isOpen && activeTab === 'library' && showLibraryTabActive) {
      setModalLoading(true);
      setModalError(null);
      setSelectedIds(new Set());

      listFiles(200, false)
        .then((allPermanentFiles) => {
          let filteredFiles = allPermanentFiles;
          if (categoryFilterValue) {
            filteredFiles = filteredFiles.filter(
              (file) => mapTypeToCategory(file.type) === categoryFilterValue
            );
          }
          if (typeFilterValue) {
            filteredFiles = filteredFiles.filter(
              (file) => file.type === typeFilterValue
            );
          }
          const finalFiles = filteredFiles.slice(0, 100);
          setLibraryFiles(finalFiles);
        })
        .catch((err) => {
          const message =
            err instanceof Error ? err.message : 'Failed to load files';
          setModalError(`Library Error: ${message}`);
          setLibraryFiles([]);
        })
        .finally(() => {
          setModalLoading(false);
        });
    } else if (isOpen) {
      // If modal is open but not on library tab, or library tab is hidden
      setLibraryFiles([]);
    } else {
      // Modal is closed
      setLibraryFiles([]);
      setSelectedIds(new Set());
    }
  }, [
    isOpen,
    activeTab,
    listFiles,
    libraryFilter?.category,
    libraryFilter?.type,
    showLibraryTabActive,
  ]); // Use primitive parts of libraryFilter

  // Effect to update preview URLs
  useEffect(() => {
    if (!isOpen) return;

    const currentFileIds = new Set(libraryFiles.map((f) => f.id));
    const urlsToRevokeFromManaged = new Map<string, string>();

    managedUrlsRef.current.forEach((url, id) => {
      if (!currentFileIds.has(id)) {
        urlsToRevokeFromManaged.set(id, url);
      }
    });

    urlsToRevokeFromManaged.forEach((url, id) => {
      URL.revokeObjectURL(url);
      managedUrlsRef.current.delete(id);
    });

    const newPreviewMap = new Map<string, string>();
    libraryFiles.forEach((file) => {
      if (!file.id) return;
      const blobToUse =
        file.thumbnailBlob ||
        (file.type?.startsWith('image/') ? file.blob : null);
      if (blobToUse) {
        if (managedUrlsRef.current.has(file.id)) {
          newPreviewMap.set(file.id, managedUrlsRef.current.get(file.id)!);
        } else {
          try {
            const url = URL.createObjectURL(blobToUse);
            newPreviewMap.set(file.id, url);
            managedUrlsRef.current.set(file.id, url);
          } catch (e) {
            console.error(
              `[Modal] Error creating Object URL for file ID ${file.id}:`,
              e
            );
          }
        }
      }
    });

    setPreviewObjectUrls((prevMap) => {
      if (prevMap.size === newPreviewMap.size) {
        let mapsIdentical = true;
        for (const [key, value] of newPreviewMap) {
          if (prevMap.get(key) !== value) {
            mapsIdentical = false;
            break;
          }
        }
        if (mapsIdentical) {
          for (const key of prevMap.keys()) {
            if (!newPreviewMap.has(key)) {
              mapsIdentical = false;
              break;
            }
          }
        }
        if (mapsIdentical) return prevMap;
      }
      return newPreviewMap;
    });
  }, [libraryFiles, isOpen]);

  // Effect for modal close cleanup
  useEffect(() => {
    if (!isOpen) {
      revokeAndClearManagedUrls();
      setModalError(null);
    }
  }, [isOpen, revokeAndClearManagedUrls]);

  // Effect for unmount cleanup
  useEffect(() => {
    return () => {
      revokeAndClearManagedUrls();
    };
  }, [revokeAndClearManagedUrls]);

  const handleFileClick = (file: StoredFile) => {
    if (!file || !file.id) return;
    setSelectedIds((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (selectionMode === 'single') {
        newSelected.clear();
        newSelected.add(file.id);
      } else {
        if (newSelected.has(file.id)) newSelected.delete(file.id);
        else newSelected.add(file.id);
      }
      return newSelected;
    });
  };

  const handleConfirmSelection = useCallback(
    async (idsToConfirm?: Set<string>) => {
      const finalIds = idsToConfirm || selectedIds;
      if (finalIds.size === 0) return;
      setModalLoading(true);
      setModalError(null);
      const selectedFilesArray: StoredFile[] = [];
      try {
        const promises = Array.from(finalIds).map((id) => getFile(id));
        const results = await Promise.all(promises);
        results.forEach((file) => {
          if (file) selectedFilesArray.push(file);
        });
        if (selectedFilesArray.length > 0) {
          onFilesSelected(selectedFilesArray, 'library', true); // For library source, saveUploadedToLibrary is implicitly true
          onClose();
        } else {
          throw new Error('No valid files found for the selected IDs.');
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to get selected files';
        setModalError(`Selection Error: ${message}`);
      } finally {
        setModalLoading(false);
      }
    },
    [selectedIds, getFile, onFilesSelected, onClose]
  );

  const handleFilesAddedFromUpload = useCallback(
    async (addedFiles: File[]) => {
      if (!addedFiles || addedFiles.length === 0) return;
      setModalLoading(true);
      setModalError(null);
      const processedFiles: StoredFile[] = [];

      // Determine if files should be saved based on mode and savePreference checkbox
      const shouldSaveToLibrary =
        mode === 'addNewFiles' ||
        (mode === 'selectExistingOrUploadNew' && savePreference);

      try {
        const processPromises = addedFiles.map(async (file) => {
          let storedFile: StoredFile | undefined;
          if (shouldSaveToLibrary) {
            try {
              const fileId = await addFile(file, file.name, file.type, false);
              storedFile = await getFile(fileId);
              if (!storedFile)
                throw new Error(`Failed to retrieve saved file: ${file.name}`);
            } catch (saveError) {
              console.error(
                `[Modal] Error saving uploaded file "${file.name}" to library:`,
                saveError
              );
              throw new Error(`Failed to save "${file.name}" to library.`);
            }
          } else {
            // Create a temporary StoredFile structure if not saving to library
            storedFile = {
              id: `temp-${Date.now()}-${Math.random().toString(16).substring(2)}`,
              name: file.name,
              type: file.type,
              size: file.size,
              blob: file,
              createdAt: new Date(),
              isTemporary: true,
            };
          }
          if (storedFile) processedFiles.push(storedFile);
        });
        await Promise.all(processPromises);

        if (processedFiles.length > 0) {
          onFilesSelected(processedFiles, 'upload', shouldSaveToLibrary);
          onClose();
        } else if (addedFiles.length > 0) {
          throw new Error('No files were successfully processed from upload.');
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to process uploads';
        setModalError(`Upload Error: ${message}`);
      } finally {
        setModalLoading(false);
      }
    },
    [mode, savePreference, addFile, getFile, onFilesSelected, onClose]
  );

  const handleUploadInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        handleFilesAddedFromUpload(Array.from(files));
      }
      if (event.target) event.target.value = '';
    },
    [handleFilesAddedFromUpload]
  );

  const triggerUploadInput = () => {
    uploadInputRef.current?.click();
  };

  const renderDefaultPreview = useCallback(
    (file: StoredFile): React.ReactNode => {
      const objectUrl = previewObjectUrls.get(file.id);
      const fileType = file.type || '';
      if (objectUrl && fileType.startsWith('image/')) {
        return (
          <Image
            src={objectUrl}
            alt={file.name || 'Stored image'}
            width={150}
            height={150}
            className="max-w-full max-h-full object-contain pointer-events-none"
            unoptimized
          />
        );
      }
      if (
        fileType.startsWith('application/zip') ||
        fileType === 'application/x-zip-compressed'
      )
        return <span className="text-4xl opacity-50">📦</span>;
      if (fileType.startsWith('text/'))
        return <span className="text-4xl opacity-50">📄</span>;
      if (fileType === 'application/pdf')
        return <span className="text-4xl opacity-50">📕</span>;
      if (fileType.startsWith('image/'))
        return (
          <Image
            src="/icon-org.svg"
            alt="Image file icon"
            width={48}
            height={48}
            className="opacity-50"
          />
        );
      return <span className="text-4xl opacity-50">❔</span>;
    },
    [previewObjectUrls]
  );

  if (!isOpen) return null;

  const combinedLoading = modalLoading || libraryLoading;
  const combinedError = modalError || libraryError;

  // Determine if the "Save to Library" checkbox should be visible
  const canShowSavePreferenceCheckbox =
    mode === 'selectExistingOrUploadNew' && activeTab === 'upload';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-select-modal-title"
    >
      <div
        className={`bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] ${className || ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
          <div className="flex">
            {showLibraryTabActive && (
              <Button
                variant={
                  activeTab === 'library'
                    ? 'primary-outline'
                    : 'neutral-outline'
                }
                size="sm"
                onClick={() => setActiveTab('library')}
                className={`
                  ${showUploadTabActive ? 'rounded-r-none' : 'rounded-md'}
                  ${activeTab === 'library' ? 'border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}
                `}
              >
                Select from Library
              </Button>
            )}
            {showUploadTabActive && (
              <Button
                variant={
                  activeTab === 'upload' ? 'primary-outline' : 'neutral-outline'
                }
                size="sm"
                onClick={() => setActiveTab('upload')}
                className={`
                  ${showLibraryTabActive ? 'rounded-l-none -ml-px' : 'rounded-md'}
                  ${activeTab === 'upload' ? 'border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}
                `}
              >
                Upload New
              </Button>
            )}
          </div>
          <Button
            variant="link"
            size="sm"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-grow min-h-[300px]">
          {combinedLoading && (
            <div className="flex items-center justify-center h-full">
              <p className="text-center text-gray-500 italic animate-pulse py-8">
                Loading...
              </p>
            </div>
          )}
          {combinedError && !combinedLoading && (
            <div className="flex items-center justify-center h-full">
              <p className="text-center text-red-600 p-4 bg-red-50 border border-red-200 rounded">
                Error: {combinedError}
              </p>
            </div>
          )}

          {activeTab === 'library' &&
            showLibraryTabActive &&
            !combinedLoading &&
            !combinedError && (
              <>
                {libraryFiles.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-center text-gray-500 italic py-8">
                      Your file library{' '}
                      {libraryFilter?.category
                        ? `for category '${libraryFilter.category}' `
                        : ''}
                      is empty or no files match the filter.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {libraryFiles.map((file) => {
                      const isSelected = selectedIds.has(file.id);
                      return (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => handleFileClick(file)}
                          className={`relative group border rounded-md shadow-sm overflow-hidden bg-white p-2 flex flex-col items-center gap-1 transition-all duration-150 ease-in-out ${isSelected ? 'border-blue-500' : 'border-gray-200 hover:border-blue-400'}`}
                          aria-pressed={isSelected}
                          aria-label={`Select file: ${file.name || 'Untitled'}`}
                        >
                          <div className="aspect-square w-full flex items-center justify-center bg-gray-50 rounded mb-1 pointer-events-none overflow-hidden">
                            {renderDefaultPreview(file)}
                          </div>
                          <p
                            className="text-xs text-center font-medium text-gray-800 truncate w-full pointer-events-none"
                            title={file.name}
                          >
                            {file.name || 'Untitled'}
                          </p>
                          <p className="text-[10px] text-gray-500 pointer-events-none">
                            {formatBytes(file.size)}
                          </p>
                          {isSelected && (
                            <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center pointer-events-none">
                              <svg
                                className="h-2.5 w-2.5 text-white"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"
                                ></path>
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

          {activeTab === 'upload' &&
            showUploadTabActive &&
            !combinedLoading &&
            !combinedError && (
              <FileDropZone
                onFilesAdded={handleFilesAddedFromUpload}
                isLoading={combinedLoading}
                className="min-h-[300px] flex flex-col items-center justify-center border-gray-300 hover:border-blue-400"
              >
                <div className="text-center p-6 pointer-events-none">
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept={accept}
                    onChange={handleUploadInputChange}
                    className="hidden"
                    multiple={selectionMode === 'multiple'}
                    disabled={combinedLoading}
                  />
                  <div className="mb-4 pointer-events-auto">
                    <Button
                      variant="primary"
                      onClick={triggerUploadInput}
                      disabled={combinedLoading}
                    >
                      Select File(s)
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">or Drag & Drop</p>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 text-gray-400 mx-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  {/* Conditionally render the "Add to Library" checkbox based on mode */}
                  {canShowSavePreferenceCheckbox && (
                    <div className="mt-6 flex items-center justify-center pointer-events-auto">
                      <input
                        id="savePreferenceCheckbox"
                        type="checkbox"
                        checked={savePreference}
                        onChange={(e) => setSavePreference(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 accent-indigo-600"
                      />
                      <label
                        htmlFor="savePreferenceCheckbox"
                        className="ml-2 block text-sm text-gray-700"
                      >
                        Add uploaded file(s) to Library
                      </label>
                    </div>
                  )}
                </div>
              </FileDropZone>
            )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center gap-3 flex-shrink-0">
          <div>
            {activeTab === 'library' &&
              showLibraryTabActive &&
              selectionMode === 'multiple' && (
                <span className="text-sm text-gray-600">
                  {selectedIds.size} selected
                </span>
              )}
            {!(
              activeTab === 'library' &&
              showLibraryTabActive &&
              selectionMode === 'multiple'
            ) && <span> </span>}
          </div>
          <div className="flex gap-3">
            <Button variant="neutral" onClick={onClose}>
              Cancel
            </Button>
            {activeTab === 'library' && showLibraryTabActive && (
              <Button
                variant="primary"
                onClick={() => handleConfirmSelection()}
                disabled={selectedIds.size === 0 || combinedLoading}
                isLoading={combinedLoading && selectedIds.size > 0}
              >
                Confirm Selection
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileSelectionModal;
