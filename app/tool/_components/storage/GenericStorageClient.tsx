// FILE: app/tool/_components/storage/GenericStorageClient.tsx
'use client';

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';

import type { ButtonVariant } from '../form/Button';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata, OutputConfig } from '@/src/types/tools';
import useToolState from '@/app/tool/_hooks/useToolState';

import StorageControls from './StorageControls';
import FileListView from './FileListView';
import FileGridView from './FileGridView';
import FileSelectionModal from '../shared/FileSelectionModal';
import { isTextBasedMimeType } from '@/app/lib/utils';

export interface StorageHookReturnType {
  listFiles: (
    limit?: number,
    includeTemporary?: boolean
  ) => Promise<StoredFile[]>;
  getFile: (id: string) => Promise<StoredFile | undefined>;
  addFile: (
    blob: Blob,
    name: string,
    type: string,
    isTemporary?: boolean,
    toolRoute?: string
  ) => Promise<string>;
  markFileAsTemporary: (id: string) => Promise<boolean>;
  markAllFilesAsTemporary: (
    excludeToolState?: boolean,
    excludeAlreadyTemporary?: boolean
  ) => Promise<{ markedCount: number; markedIds: string[] }>;
  makeFilePermanentAndUpdate?: (id: string) => Promise<boolean>;
  cleanupOrphanedTemporaryFiles: (
    fileIds?: string[]
  ) => Promise<{ deletedCount: number; candidatesChecked: number }>;
}

export interface FeedbackStateEntry {
  type: 'copy' | 'download' | 'error';
  message: string;
}

export interface DefaultItemActionHandlers {
  onCopy: () => void;
  onDownload: () => void;
  onDelete: () => void;
  canCopy: boolean;
}

export interface CustomPrimaryCreateConfig {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  buttonVariant?: ButtonVariant;
}

export interface CustomBulkActionConfig {
  label: string;
  icon?: React.ReactNode;
  onClick: (selectedItems: StoredFile[]) => void;
  disabled?: (selectedItems: StoredFile[]) => boolean;
  buttonVariant?: ButtonVariant;
  key: string;
}

interface GenericStorageClientProps {
  toolRoute: string;
  itemTypeSingular: string;
  itemTypePlural: string;
  storageHook: () => StorageHookReturnType;
  fileInputAccept: string;
  libraryFilterForModal?: { category?: string; type?: string };
  defaultLayout?: 'list' | 'grid';
  metadata: ToolMetadata;
  renderGridItemPreview: (
    file: StoredFile,
    previewUrl?: string
  ) => React.ReactNode;
  enableCopyContent?: (file: StoredFile) => boolean;

  customPrimaryCreateConfig?: CustomPrimaryCreateConfig | null;
  customFilterControls?: React.ReactNode;
  renderItemActions?: (
    file: StoredFile,
    defaultActionHandlers: DefaultItemActionHandlers,
    isProcessingItem: boolean,
    feedbackForItem: FeedbackStateEntry | null
  ) => React.ReactNode[];
  customBulkActions?: CustomBulkActionConfig[];
  externalRefreshTrigger?: number;
}

interface PersistedStorageState {
  selectedItemIds: string[];
  layout: 'list' | 'grid';
  isFilterSelectedActive: boolean;
}

export default function GenericStorageClient({
  toolRoute,
  itemTypeSingular,
  itemTypePlural,
  storageHook,
  fileInputAccept,
  libraryFilterForModal,
  defaultLayout = 'grid',
  metadata,
  renderGridItemPreview,
  enableCopyContent = (file: StoredFile) => isTextBasedMimeType(file.type),
  customPrimaryCreateConfig = null,
  customFilterControls = null,
  renderItemActions,
  customBulkActions = [],
  externalRefreshTrigger,
}: GenericStorageClientProps) {
  const {
    listFiles,
    getFile,
    markFileAsTemporary,
    markAllFilesAsTemporary,
    cleanupOrphanedTemporaryFiles,
  } = storageHook();

  const DEFAULT_PERSISTED_STATE: PersistedStorageState = {
    selectedItemIds: [],
    layout: defaultLayout,
    isFilterSelectedActive: false,
  };

  const [displayedItems, setDisplayedItems] = useState<StoredFile[]>([]);
  const [clientIsLoading, setClientIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [feedbackState, setFeedbackState] = useState<
    Record<string, FeedbackStateEntry | null>
  >({});
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(
    new Map()
  );
  const managedUrlsRef = useRef<Map<string, string>>(new Map());
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  const {
    state: persistentState,
    setState: setPersistentState,
    isLoadingState: isLoadingToolState,
    errorLoadingState: toolStateError,
    saveStateNow,
  } = useToolState<PersistedStorageState>(toolRoute, DEFAULT_PERSISTED_STATE);

  const selectedItemIds = useMemo(
    () => new Set(persistentState.selectedItemIds),
    [persistentState.selectedItemIds]
  );
  const layout = persistentState.layout;
  const isFilterSelectedActive = persistentState.isFilterSelectedActive;

  const directiveName = useMemo(
    () =>
      toolRoute.split('/').pop() ||
      metadata.title.toLowerCase().replace(/\s+/g, '-'),
    [toolRoute, metadata.title]
  );

  const selectedStoredItemsForItde = useMemo((): StoredFile[] => {
    if (selectedItemIds.size === 0 || displayedItems.length === 0) {
      return [];
    }
    return displayedItems.filter((item) => selectedItemIds.has(item.id));
  }, [selectedItemIds, displayedItems]);

  const revokeManagedUrls = useCallback(() => {
    managedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    managedUrlsRef.current.clear();
  }, []);

  const updatePreviewUrlsForItems = useCallback(
    (itemsToDisplay: StoredFile[]) => {
      setPreviewUrls((prevMap) => {
        const newMap = new Map<string, string>();
        let changed = false;
        itemsToDisplay.forEach((item) => {
          if (!item.id) return;
          const blob =
            item.thumbnailBlob ||
            (item.type?.startsWith('image/') ? item.blob : null);
          if (blob) {
            if (managedUrlsRef.current.has(item.id)) {
              newMap.set(item.id, managedUrlsRef.current.get(item.id)!);
            } else {
              try {
                const url = URL.createObjectURL(blob);
                newMap.set(item.id, url);
                managedUrlsRef.current.set(item.id, url);
                changed = true;
              } catch (e) {
                console.error(`Error creating URL for ${item.id}:`, e);
              }
            }
          }
        });
        const currentKeys = new Set(newMap.keys());
        prevMap.forEach((_, key) => {
          if (!currentKeys.has(key)) changed = true;
        });
        if (!changed && newMap.size !== prevMap.size) changed = true;
        if (!changed) {
          for (const [k, v] of newMap)
            if (prevMap.get(k) !== v) {
              changed = true;
              break;
            }
        }
        return changed ? newMap : prevMap;
      });
    },
    []
  );

  useEffect(() => () => revokeManagedUrls(), [revokeManagedUrls]);

  const loadAndDisplayItems = useCallback(async () => {
    setError(null);
    setClientIsLoading(true);
    try {
      const items = await listFiles(500, false);
      setDisplayedItems(items);
      updatePreviewUrlsForItems(items);
    } catch (err) {
      setError(
        `Failed to load stored ${itemTypePlural.toLowerCase()}: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      setDisplayedItems([]);
      updatePreviewUrlsForItems([]);
    } finally {
      setClientIsLoading(false);
    }
  }, [listFiles, itemTypePlural, updatePreviewUrlsForItems]);

  useEffect(() => {
    if (!isLoadingToolState) {
      loadAndDisplayItems();
    }
  }, [loadAndDisplayItems, isLoadingToolState, externalRefreshTrigger]);

  const setItemFeedback = useCallback(
    (
      id: string,
      type: 'copy' | 'download' | 'error' | null,
      message: string = ''
    ) => {
      setFeedbackState((prev) => ({
        ...prev,
        [id]: type ? { type, message } : null,
      }));
      if (type && type !== 'error') {
        setTimeout(
          () =>
            setFeedbackState((prev) =>
              prev[id]?.type === type ? { ...prev, [id]: null } : prev
            ),
          2000
        );
      }
    },
    []
  );

  const handleAddViaUploadClick = () => setIsAddModalOpen(true);

  const handleLayoutChange = useCallback(
    (newLayout: 'list' | 'grid') => {
      const newState = { ...persistentState, layout: newLayout };
      setPersistentState(newState);
      saveStateNow(newState);
    },
    [persistentState, setPersistentState, saveStateNow]
  );

  const handleToggleFilterSelected = useCallback(() => {
    const nextIsFilterSelectedActive = !persistentState.isFilterSelectedActive;
    const newState = {
      ...persistentState,
      isFilterSelectedActive: nextIsFilterSelectedActive,
    };
    setPersistentState(newState);
    saveStateNow(newState);
  }, [persistentState, setPersistentState, saveStateNow]);

  const handleModalFilesSelected = useCallback(
    async (
      filesFromModal: StoredFile[],
      source: 'library' | 'upload',
      filterToThese?: boolean
    ) => {
      setIsAddModalOpen(false);
      setError(null);
      setIsProcessing(true);

      await loadAndDisplayItems();

      if (filesFromModal.length > 0) {
        const newFileIds = filesFromModal
          .map((f) => f.id)
          .filter((id): id is string => !!id && !id.startsWith('phantom-'));

        if (newFileIds.length > 0) {
          setPersistentState((prevState) => {
            let finalSelectedIds: string[];
            let finalFilterActiveState: boolean;

            if (source === 'upload') {
              finalSelectedIds = newFileIds;
              finalFilterActiveState = filterToThese ? true : false;
            } else {
              finalSelectedIds = newFileIds;
              finalFilterActiveState = false;
            }
            const newState: PersistedStorageState = {
              ...prevState,
              selectedItemIds: finalSelectedIds,
              isFilterSelectedActive: finalFilterActiveState,
            };
            return newState;
          });
        }
      }
      setIsProcessing(false);
    },
    [loadAndDisplayItems, setPersistentState]
  );

  const handleDeleteSingleItem = useCallback(
    async (itemId: string) => {
      if (isBulkDeleting || selectedItemIds.has(itemId)) return;
      setIsProcessing(true);
      setError(null);
      const itemToDelete = displayedItems.find((f) => f.id === itemId);
      const itemName =
        itemToDelete?.filename || `${itemTypeSingular} ID ${itemId}`;
      try {
        const marked = await markFileAsTemporary(itemId);
        if (marked) {
          await cleanupOrphanedTemporaryFiles([itemId]);
        }
        await loadAndDisplayItems();

        const newSelectedIdsArray = persistentState.selectedItemIds.filter(
          (id) => id !== itemId
        );
        if (
          newSelectedIdsArray.length !== persistentState.selectedItemIds.length
        ) {
          const newState = {
            ...persistentState,
            selectedItemIds: newSelectedIdsArray,
          };
          setPersistentState(newState);
          await saveStateNow(newState);
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : `Unknown error deleting ${itemTypeSingular.toLowerCase()}.`;
        setError(`Failed to delete "${itemName}". ${message}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [
      isBulkDeleting,
      selectedItemIds,
      displayedItems,
      itemTypeSingular,
      markFileAsTemporary,
      cleanupOrphanedTemporaryFiles,
      loadAndDisplayItems,
      persistentState,
      setPersistentState,
      saveStateNow,
    ]
  );

  const handleClearAllItems = useCallback(async () => {
    if (
      clientIsLoading ||
      isLoadingToolState ||
      isProcessing ||
      isBulkDeleting ||
      displayedItems.length === 0 ||
      selectedItemIds.size > 0
    )
      return;

    setError(null);
    setIsProcessing(true);
    try {
      const { markedIds } = await markAllFilesAsTemporary(true, true);
      if (markedIds.length > 0) {
        await cleanupOrphanedTemporaryFiles(markedIds);
      }
      await loadAndDisplayItems();

      const newState = {
        ...persistentState,
        selectedItemIds: [],
        isFilterSelectedActive: false,
      };
      setPersistentState(newState);
      await saveStateNow(newState);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Unknown error clearing ${itemTypePlural.toLowerCase()}.`;
      setError(`Failed to clear ${itemTypePlural.toLowerCase()}. ${message}`);
      await loadAndDisplayItems();
    } finally {
      setIsProcessing(false);
    }
  }, [
    clientIsLoading,
    isLoadingToolState,
    isProcessing,
    isBulkDeleting,
    displayedItems,
    selectedItemIds.size,
    markAllFilesAsTemporary,
    cleanupOrphanedTemporaryFiles,
    loadAndDisplayItems,
    itemTypePlural,
    persistentState,
    setPersistentState,
    saveStateNow,
  ]);

  const handleDownloadItem = useCallback(
    async (itemId: string) => {
      setError(null);
      setItemFeedback(itemId, null);
      try {
        const item = await getFile(itemId);
        if (!item?.blob) throw new Error(`${itemTypeSingular} data not found.`);
        const url = URL.createObjectURL(item.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = item.filename || `download-${itemId}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setItemFeedback(itemId, 'download', 'Downloaded!');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : `Unknown download error.`;
        setItemFeedback(itemId, 'error', `Download failed: ${message}`);
      }
    },
    [getFile, setItemFeedback, itemTypeSingular]
  );

  const handleCopyItemContent = useCallback(
    async (itemId: string) => {
      setError(null);
      setItemFeedback(itemId, null);
      const item = await getFile(itemId);
      if (!item?.blob) {
        setItemFeedback(itemId, 'error', 'File data not found.');
        return;
      }
      if (!enableCopyContent(item)) {
        setItemFeedback(
          itemId,
          'error',
          'Cannot copy content of this file type.'
        );
        return;
      }
      if (!navigator.clipboard?.writeText) {
        setItemFeedback(itemId, 'error', 'Clipboard API not available.');
        return;
      }
      try {
        const textContent = await item.blob.text();
        await navigator.clipboard.writeText(textContent);
        setItemFeedback(itemId, 'copy', 'Copied!');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown copy error.';
        setItemFeedback(itemId, 'error', `Copy failed: ${message}`);
      }
    },
    [getFile, setItemFeedback, enableCopyContent]
  );

  const handleToggleSelection = useCallback(
    async (itemId: string) => {
      const newSelectedSet = new Set(persistentState.selectedItemIds);
      if (newSelectedSet.has(itemId)) {
        newSelectedSet.delete(itemId);
      } else {
        newSelectedSet.add(itemId);
      }
      const newFilterActiveState =
        newSelectedSet.size > 0
          ? persistentState.isFilterSelectedActive
          : false;
      const newState = {
        ...persistentState,
        selectedItemIds: Array.from(newSelectedSet),
        isFilterSelectedActive: newFilterActiveState,
      };
      setPersistentState(newState);
      await saveStateNow(newState);
    },
    [persistentState, setPersistentState, saveStateNow]
  );

  const handleDeleteSelectedItems = useCallback(async () => {
    if (
      selectedItemIds.size === 0 ||
      clientIsLoading ||
      isLoadingToolState ||
      isProcessing ||
      isBulkDeleting
    )
      return;

    setIsBulkDeleting(true);
    setError(null);
    const idsToDelete = Array.from(selectedItemIds);
    const errorsEncountered: string[] = [];

    for (const id of idsToDelete) {
      const item = displayedItems.find((f) => f.id === id);
      const name = item?.filename || `${itemTypeSingular} ID ${id}`;
      try {
        await markFileAsTemporary(id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errorsEncountered.push(
          `Failed to mark "${name}" as temporary: ${message}`
        );
      }
    }

    if (idsToDelete.length > 0) {
      await cleanupOrphanedTemporaryFiles(idsToDelete);
    }

    const newState = {
      ...persistentState,
      selectedItemIds: [],
      isFilterSelectedActive: false,
    };
    setPersistentState(newState);
    await saveStateNow(newState);

    if (errorsEncountered.length > 0) {
      const errorMessage = `Errors occurred during deletion marking: ${errorsEncountered.join('; ')}`;
      setError(errorMessage);
    }
    await loadAndDisplayItems();
    setIsBulkDeleting(false);
  }, [
    selectedItemIds,
    clientIsLoading,
    isLoadingToolState,
    isProcessing,
    isBulkDeleting,
    displayedItems,
    itemTypeSingular,
    markFileAsTemporary,
    cleanupOrphanedTemporaryFiles,
    loadAndDisplayItems,
    persistentState,
    setPersistentState,
    saveStateNow,
  ]);

  const itemsToDisplayInView = useMemo(() => {
    return isFilterSelectedActive
      ? displayedItems.filter((item) => selectedItemIds.has(item.id))
      : displayedItems;
  }, [isFilterSelectedActive, displayedItems, selectedItemIds]);

  const combinedClientAndViewLoading = clientIsLoading || isLoadingToolState;
  const controlsAreLoadingOverall =
    combinedClientAndViewLoading || isProcessing || isBulkDeleting;

  const showEmptyMessage =
    !combinedClientAndViewLoading &&
    itemsToDisplayInView.length === 0 &&
    !controlsAreLoadingOverall;
  const currentError = error || toolStateError;

  const createDefaultItemActionHandlers = useCallback(
    (file: StoredFile): DefaultItemActionHandlers => ({
      onCopy: () => handleCopyItemContent(file.id),
      onDownload: () => handleDownloadItem(file.id),
      onDelete: () => handleDeleteSingleItem(file.id),
      canCopy: enableCopyContent(file),
    }),
    [
      handleCopyItemContent,
      handleDownloadItem,
      handleDeleteSingleItem,
      enableCopyContent,
    ]
  );

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <StorageControls
        isLoading={controlsAreLoadingOverall}
        isDeleting={isBulkDeleting}
        itemCount={displayedItems.length}
        currentLayout={layout}
        isFilterSelectedActive={isFilterSelectedActive}
        onToggleFilterSelected={handleToggleFilterSelected}
        onAddViaUploadClick={handleAddViaUploadClick}
        onClearAllClick={handleClearAllItems}
        onLayoutChange={handleLayoutChange}
        onDeleteSelectedClick={handleDeleteSelectedItems}
        itemNameSingular={itemTypeSingular}
        itemNamePlural={itemTypePlural}
        directiveName={directiveName}
        outputConfig={metadata.outputConfig as OutputConfig}
        selectedStoredFilesForItde={selectedStoredItemsForItde}
        customPrimaryCreateConfig={customPrimaryCreateConfig}
        customFilterControls={customFilterControls}
        customBulkActions={customBulkActions}
      />
      {currentError && (
        <div
          role="alert"
          className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm"
        >
          <strong>Error:</strong> {currentError}
        </div>
      )}

      <div className="border-2 border-dashed border-gray-300 rounded-md min-h-[200px] p-1">
        {combinedClientAndViewLoading &&
          !isProcessing &&
          !isBulkDeleting &&
          displayedItems.length === 0 && (
            <div className="flex items-center justify-center min-h-[200px]">
              <p className="text-center p-4 text-gray-500 italic animate-pulse">
                Loading stored {itemTypePlural.toLowerCase()}...
              </p>
            </div>
          )}
        {showEmptyMessage && (
          <div className="flex items-center justify-center min-h-[200px]">
            <p className="text-center p-4 text-gray-500 italic">
              {isFilterSelectedActive && displayedItems.length > 0
                ? `No ${itemTypePlural.toLowerCase()} match current selection filter.`
                : `Your ${itemTypeSingular.toLowerCase()} library is empty. Add ${itemTypePlural.toLowerCase()} using the button above.`}
            </p>
          </div>
        )}
        {!combinedClientAndViewLoading &&
          !showEmptyMessage &&
          (layout === 'list' ? (
            <FileListView
              files={itemsToDisplayInView}
              isLoading={
                isProcessing || (isLoadingToolState && !isBulkDeleting)
              }
              isBulkDeleting={isBulkDeleting}
              selectedIds={selectedItemIds}
              feedbackState={feedbackState}
              onToggleSelection={handleToggleSelection}
              renderItemActions={
                renderItemActions
                  ? (file) =>
                      renderItemActions(
                        file,
                        createDefaultItemActionHandlers(file),
                        isProcessing || isBulkDeleting,
                        feedbackState[file.id] ?? null
                      )
                  : undefined
              }
              onCopy={!renderItemActions ? handleCopyItemContent : undefined}
              onDownload={!renderItemActions ? handleDownloadItem : undefined}
              onDelete={!renderItemActions ? handleDeleteSingleItem : undefined}
              canCopyFile={!renderItemActions ? enableCopyContent : undefined}
            />
          ) : (
            <FileGridView
              files={itemsToDisplayInView}
              isLoading={
                isProcessing || (isLoadingToolState && !isBulkDeleting)
              }
              isBulkDeleting={isBulkDeleting}
              selectedIds={selectedItemIds}
              feedbackState={feedbackState}
              renderPreview={(file) =>
                renderGridItemPreview(file, previewUrls.get(file.id))
              }
              onToggleSelection={handleToggleSelection}
              renderItemActions={
                renderItemActions
                  ? (file) =>
                      renderItemActions(
                        file,
                        createDefaultItemActionHandlers(file),
                        isProcessing || isBulkDeleting,
                        feedbackState[file.id] ?? null
                      )
                  : undefined
              }
              onCopy={!renderItemActions ? handleCopyItemContent : undefined}
              onDownload={!renderItemActions ? handleDownloadItem : undefined}
              onDelete={!renderItemActions ? handleDeleteSingleItem : undefined}
              canCopyFile={!renderItemActions ? enableCopyContent : undefined}
            />
          ))}
      </div>

      <FileSelectionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onFilesSelected={handleModalFilesSelected}
        mode="addNewFiles"
        accept={fileInputAccept}
        selectionMode="multiple"
        libraryFilter={libraryFilterForModal}
        initialTab={customPrimaryCreateConfig ? 'library' : 'upload'}
        showFilterAfterUploadCheckbox={true}
      />
    </div>
  );
}
