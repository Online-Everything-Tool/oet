// FILE: app/tool/_components/file-storage/FileSelectionModal.tsx
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
import FileDropZone from './FileDropZone';
import { formatBytes, getFileIconClassName } from '@/app/lib/utils';
import Button from '../form/Button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Checkbox from '../form/Checkbox';
import { v4 as uuidv4 } from 'uuid';

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
    filterToThese?: boolean
  ) => void;

  slurpContentOnly?: boolean;
  defaultSaveUploadsToLibrary?: boolean;

  className?: string;
  accept?: string;
  selectionMode?: 'single' | 'multiple';
  mode: ModalMode;
  libraryFilter?: { category?: string; type?: string };
  initialTab?: 'library' | 'upload';
  showFilterAfterUploadCheckbox?: boolean; // Controls visibility of the checkbox
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
  slurpContentOnly = false,
  defaultSaveUploadsToLibrary = false,
  className,
  accept = '*/*',
  libraryFilter: libraryFilterProp = {},
  selectionMode = 'multiple',
  mode,
  initialTab,
  showFilterAfterUploadCheckbox = false, // Default to false if not provided
}) => {
  const {
    listFiles,
    addFile,
    getFile,
    loading: libraryLoading,
  } = useFileLibrary();

  const [libraryFiles, setLibraryFiles] = useState<StoredFile[]>([]);
  const [modalProcessingLoading, setModalProcessingLoading] =
    useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [previewObjectUrls, setPreviewObjectUrls] = useState<
    Map<string, string>
  >(new Map());
  const managedUrlsRef = useRef<Map<string, string>>(new Map());
  const [selectedIdsFromLibrary, setSelectedIdsFromLibrary] = useState<
    Set<string>
  >(new Set());

  const [saveUploadsPreference, setSaveUploadsPreference] = useState<boolean>(
    mode === 'addNewFiles' ? true : defaultSaveUploadsToLibrary
  );
  const uploadInputRef = useRef<HTMLInputElement>(null);
  // Default filterAfterUploadChecked to false
  const [filterAfterUploadChecked, setFilterAfterUploadChecked] =
    useState(false);

  const showLibraryTab = useMemo(
    () => mode === 'selectExistingOrUploadNew' || mode === 'selectExistingOnly',
    [mode]
  );
  const showUploadTab = useMemo(
    () => mode === 'selectExistingOrUploadNew' || mode === 'addNewFiles',
    [mode]
  );

  const getEffectiveInitialTab = useCallback(() => {
    if (mode === 'addNewFiles') return 'upload';
    if (mode === 'selectExistingOnly') return 'library';
    if (initialTab === 'library' && showLibraryTab) return 'library';
    if (initialTab === 'upload' && showUploadTab) return 'upload';
    return showLibraryTab ? 'library' : 'upload';
  }, [mode, initialTab, showLibraryTab, showUploadTab]);

  const [activeTab, setActiveTab] = useState<'library' | 'upload'>(
    getEffectiveInitialTab()
  );

  useEffect(() => {
    if (isOpen) {
      setActiveTab(getEffectiveInitialTab());
      if (mode === 'selectExistingOrUploadNew') {
        setSaveUploadsPreference(defaultSaveUploadsToLibrary);
      } else if (mode === 'addNewFiles') {
        setSaveUploadsPreference(true);
      }
      setSelectedIdsFromLibrary(new Set());
      setModalError(null);
      // Reset filterAfterUploadChecked to false when modal opens if the checkbox is shown
      // Or to its default if a prop for its default was added. For now, false.
      if (showFilterAfterUploadCheckbox) {
        setFilterAfterUploadChecked(false);
      }
    }
  }, [
    isOpen,
    mode,
    defaultSaveUploadsToLibrary,
    getEffectiveInitialTab,
    showFilterAfterUploadCheckbox,
  ]);

  const revokeAndClearManagedUrls = useCallback(() => {
    managedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    managedUrlsRef.current.clear();
    setPreviewObjectUrls(new Map());
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'library' && showLibraryTab) {
      setModalProcessingLoading(true);
      setModalError(null);
      listFiles(200, false)
        .then((allPermanentFiles) => {
          let filteredFiles = allPermanentFiles;
          const categoryFilterValue = libraryFilterProp?.category;
          const typeFilterValue = libraryFilterProp?.type;
          if (categoryFilterValue) {
            filteredFiles = filteredFiles.filter(
              (f) => mapTypeToCategory(f.type) === categoryFilterValue
            );
          }
          if (typeFilterValue) {
            filteredFiles = filteredFiles.filter(
              (f) => f.type === typeFilterValue
            );
          }
          setLibraryFiles(filteredFiles.slice(0, 100));
        })
        .catch((err) => {
          setModalError(
            `Library Error: ${err instanceof Error ? err.message : 'Failed to load files'}`
          );
          setLibraryFiles([]);
        })
        .finally(() => {
          setModalProcessingLoading(false);
        });
    } else if (!isOpen) {
      setLibraryFiles([]);
    }
  }, [isOpen, activeTab, showLibraryTab, listFiles, libraryFilterProp]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'library' || libraryFiles.length === 0) {
      if (previewObjectUrls.size > 0) revokeAndClearManagedUrls();
      return;
    }
    const currentFileIdsInView = new Set(libraryFiles.map((f) => f.id));
    managedUrlsRef.current.forEach((url, id) => {
      if (!currentFileIdsInView.has(id)) {
        URL.revokeObjectURL(url);
        managedUrlsRef.current.delete(id);
      }
    });
    const newPreviewMap = new Map<string, string>();
    let mapChanged = false;
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
            mapChanged = true;
          } catch (e) {
            console.error(
              `[Modal] Error creating Object URL for file ID ${file.id}:`,
              e
            );
          }
        }
      }
    });
    if (
      mapChanged ||
      newPreviewMap.size !== previewObjectUrls.size ||
      Array.from(newPreviewMap.entries()).some(
        ([key, val]) => previewObjectUrls.get(key) !== val
      )
    ) {
      setPreviewObjectUrls(newPreviewMap);
    }
  }, [
    libraryFiles,
    isOpen,
    activeTab,
    revokeAndClearManagedUrls,
    previewObjectUrls,
  ]);

  useEffect(() => {
    if (!isOpen) {
      revokeAndClearManagedUrls();
      setModalError(null);
      // setFilterAfterUploadChecked(true); // No, reset to false is handled in isOpen effect
    }
  }, [isOpen, revokeAndClearManagedUrls]);

  useEffect(() => {
    const urlsToRevokeOnUnmount = new Map(managedUrlsRef.current);
    return () => {
      urlsToRevokeOnUnmount.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleLibraryFileClick = (file: StoredFile) => {
    if (!file || !file.id) return;
    setSelectedIdsFromLibrary((prevSelected) => {
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

  const handleConfirmLibrarySelection = useCallback(async () => {
    if (selectedIdsFromLibrary.size === 0) return;
    setModalProcessingLoading(true);
    setModalError(null);
    try {
      const selectedFilesArray: StoredFile[] = [];
      const promises = Array.from(selectedIdsFromLibrary).map((id) =>
        getFile(id)
      );
      const results = await Promise.all(promises);
      results.forEach((file) => {
        if (file) selectedFilesArray.push(file);
      });

      if (selectedFilesArray.length > 0) {
        onFilesSelected(
          selectedFilesArray,
          'library',
          showFilterAfterUploadCheckbox && filterAfterUploadChecked
            ? true
            : undefined
        );
        onClose();
      } else {
        throw new Error('No valid files found for the selected library IDs.');
      }
    } catch (err) {
      setModalError(
        `Library Selection Error: ${err instanceof Error ? err.message : 'Failed to get selected files'}`
      );
    } finally {
      setModalProcessingLoading(false);
    }
  }, [
    selectedIdsFromLibrary,
    getFile,
    onFilesSelected,
    onClose,
    showFilterAfterUploadCheckbox,
    filterAfterUploadChecked,
  ]);

  const handleFilesAddedFromUpload = useCallback(
    async (addedFiles: File[]) => {
      if (!addedFiles || addedFiles.length === 0) return;

      setModalProcessingLoading(true);
      setModalError(null);
      const resolvedFileObjects: StoredFile[] = [];

      const persistThisUploadBatch =
        mode === 'addNewFiles' ||
        (!slurpContentOnly && mode === 'selectExistingOrUploadNew') ||
        (slurpContentOnly && saveUploadsPreference);

      for (const browserFile of addedFiles) {
        const now = new Date();
        let newFileIdIfPersisted: string | null = null;
        let isTemporaryForDbWrite = true;

        if (
          mode === 'addNewFiles' ||
          (persistThisUploadBatch && saveUploadsPreference)
        ) {
          isTemporaryForDbWrite = false;
        } else if (!slurpContentOnly && defaultSaveUploadsToLibrary) {
          isTemporaryForDbWrite = false;
        }

        if (persistThisUploadBatch) {
          try {
            newFileIdIfPersisted = await addFile(
              browserFile,
              browserFile.name,
              browserFile.type,
              isTemporaryForDbWrite
            );
          } catch (saveErr) {
            console.error(
              `[FSM] Error persisting ${browserFile.name} to Dexie:`,
              saveErr
            );
            setModalError(
              (prev) =>
                (prev ? prev + '; ' : '') +
                `Failed to save ${browserFile.name}.`
            );
            continue;
          }
        }

        let resolvedFile: StoredFile;
        if (newFileIdIfPersisted) {
          const fetchedFile = await getFile(newFileIdIfPersisted);
          if (fetchedFile) {
            resolvedFile = fetchedFile;
          } else {
            resolvedFile = {
              id: newFileIdIfPersisted,
              name: browserFile.name,
              type: browserFile.type,
              size: browserFile.size,
              blob: browserFile,
              createdAt: now,
              lastModified: now,
              isTemporary: isTemporaryForDbWrite,
            };
          }
        } else {
          resolvedFile = {
            id: `phantom-${uuidv4()}`,
            name: browserFile.name,
            type: browserFile.type,
            size: browserFile.size,
            blob: browserFile,
            createdAt: now,
            lastModified: now,
            isTemporary: true,
          };
        }
        resolvedFileObjects.push(resolvedFile);
      }

      setModalProcessingLoading(false);

      console.log(showFilterAfterUploadCheckbox, filterAfterUploadChecked);
      if (resolvedFileObjects.length > 0) {
        onFilesSelected(
          resolvedFileObjects,
          'upload',
          showFilterAfterUploadCheckbox && filterAfterUploadChecked
            ? true
            : undefined
        );
      }

      if (!modalError && resolvedFileObjects.length > 0) {
        onClose();
      } else if (
        resolvedFileObjects.length === 0 &&
        !modalError &&
        addedFiles.length > 0
      ) {
        setModalError('No files were successfully processed from the upload.');
      }
    },
    [
      addFile,
      getFile,
      mode,
      slurpContentOnly,
      saveUploadsPreference,
      defaultSaveUploadsToLibrary,
      onFilesSelected,
      onClose,
      filterAfterUploadChecked,
      showFilterAfterUploadCheckbox, // Dependencies for correct filterToThese
      setModalError, // Local state setter
    ]
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

  const triggerUploadInput = () => uploadInputRef.current?.click();
  const renderDefaultLibraryPreview = useCallback(
    (file: StoredFile): React.ReactNode => {
      const objectUrl = previewObjectUrls.get(file.id);
      const fileType = file.type || '';
      if (objectUrl && fileType.startsWith('image/')) {
        return (
          <Image
            src={objectUrl}
            alt={file.name || 'Stored image preview'}
            width={120}
            height={120}
            className="max-w-full max-h-full object-contain pointer-events-none"
            unoptimized
          />
        );
      }
      return (
        <span className="flex items-center justify-center h-full w-full">
          <span
            aria-hidden="true"
            className={`${getFileIconClassName(file.name)} text-4xl`}
            title={file.type || 'File'}
          ></span>
        </span>
      );
    },
    [previewObjectUrls]
  );

  if (!isOpen) return null;

  const isLoadingOverall = modalProcessingLoading || libraryLoading;
  // Visibility of "Add to Library" checkbox on Upload tab
  const canShowSaveUploadsPreferenceCheckbox =
    mode === 'selectExistingOrUploadNew' && activeTab === 'upload';
  // Visibility of "Filter view to only added" checkbox on Upload tab
  const actualShowFilterAfterUploadCheckbox =
    showFilterAfterUploadCheckbox && activeTab === 'upload';

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
        <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
          <div className="flex">
            {showLibraryTab && (
              <Button
                variant={
                  activeTab === 'library'
                    ? 'primary-outline'
                    : 'neutral-outline'
                }
                size="sm"
                onClick={() => setActiveTab('library')}
                className={`${showUploadTab ? 'rounded-r-none' : 'rounded-md'} ${activeTab === 'library' ? 'border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Select from Library
              </Button>
            )}
            {showUploadTab && (
              <Button
                variant={
                  activeTab === 'upload' ? 'primary-outline' : 'neutral-outline'
                }
                size="sm"
                onClick={() => setActiveTab('upload')}
                className={`${showLibraryTab ? 'rounded-l-none -ml-px' : 'rounded-md'} ${activeTab === 'upload' ? 'border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}`}
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

        <div className="p-4 overflow-y-auto flex-grow min-h-[300px]">
          {isLoadingOverall && !modalError && (
            <div className="flex items-center justify-center h-full">
              <p className="text-center text-gray-500 italic animate-pulse py-8">
                Loading...
              </p>
            </div>
          )}
          {modalError && (
            <div className="flex items-center justify-center h-full">
              <p className="text-center text-red-600 p-4 bg-red-50 border border-red-200 rounded">
                Error: {modalError}
              </p>
            </div>
          )}

          {activeTab === 'library' &&
            showLibraryTab &&
            !isLoadingOverall &&
            !modalError && (
              <>
                {libraryFiles.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-center text-gray-500 italic py-8">
                      Your file library{' '}
                      {libraryFilterProp?.category || libraryFilterProp?.type
                        ? `(filtered for ${libraryFilterProp.category || libraryFilterProp.type}) `
                        : ''}
                      is empty...
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {libraryFiles.map((file) => {
                      const isSelected = selectedIdsFromLibrary.has(file.id);
                      return (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => handleLibraryFileClick(file)}
                          className={`relative group border rounded-md shadow-sm overflow-hidden bg-white p-2 flex flex-col items-center gap-1 transition-all duration-150 ease-in-out ${isSelected ? 'border-blue-500 ring-2 ring-blue-300 ring-offset-1' : 'border-gray-200 hover:border-blue-400'}`}
                          aria-pressed={isSelected}
                          aria-label={`Select file: ${file.name || 'Untitled'}`}
                        >
                          <div className="aspect-square w-full flex items-center justify-center bg-gray-50 rounded mb-1 pointer-events-none overflow-hidden">
                            {renderDefaultLibraryPreview(file)}
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
            showUploadTab &&
            !isLoadingOverall &&
            !modalError && (
              <FileDropZone
                onFilesAdded={handleFilesAddedFromUpload}
                isLoading={isLoadingOverall}
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
                    disabled={isLoadingOverall}
                  />
                  <div className="mb-4 pointer-events-auto">
                    <Button
                      variant="primary"
                      onClick={triggerUploadInput}
                      disabled={isLoadingOverall}
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
                  {canShowSaveUploadsPreferenceCheckbox && (
                    <div className="mt-6 flex items-center justify-center pointer-events-auto">
                      <Checkbox
                        label="Add uploaded file(s) to Library"
                        id="modalSavePreferenceCheckbox"
                        checked={saveUploadsPreference}
                        onChange={(e) =>
                          setSaveUploadsPreference(e.target.checked)
                        }
                        disabled={isLoadingOverall}
                      />
                    </div>
                  )}
                  {actualShowFilterAfterUploadCheckbox && ( // Use actualShow... for visibility
                    <div className="mt-4 flex items-center justify-center pointer-events-auto">
                      <Checkbox
                        label="Filter view to show only added file(s)"
                        id="modalFilterAfterUploadCheckbox"
                        checked={filterAfterUploadChecked}
                        onChange={(e) =>
                          setFilterAfterUploadChecked(e.target.checked)
                        }
                        disabled={isLoadingOverall}
                      />
                    </div>
                  )}
                </div>
              </FileDropZone>
            )}
        </div>

        <div className="p-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center gap-3 flex-shrink-0">
          <div>
            {activeTab === 'library' &&
              showLibraryTab &&
              selectionMode === 'multiple' && (
                <span className="text-sm text-gray-600">
                  {selectedIdsFromLibrary.size} selected
                </span>
              )}
            {!(
              activeTab === 'library' &&
              showLibraryTab &&
              selectionMode === 'multiple'
            ) && <span> </span>}
          </div>
          <div className="flex gap-3">
            <Button variant="neutral" onClick={onClose}>
              Cancel
            </Button>
            {activeTab === 'library' && showLibraryTab && (
              <Button
                variant="primary"
                onClick={handleConfirmLibrarySelection}
                disabled={selectedIdsFromLibrary.size === 0 || isLoadingOverall}
                isLoading={isLoadingOverall && selectedIdsFromLibrary.size > 0}
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
