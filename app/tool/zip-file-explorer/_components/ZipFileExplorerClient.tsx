// FILE: app/tool/zip-file-explorer/_components/ZipFileExplorerClient.tsx
'use client';

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import JSZip from 'jszip';
import Image from 'next/image';
import type { RawZipEntry, TreeNodeData } from './types';
import { buildFileTree } from './utils';
import TreeNode from './TreeNode';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import Button from '@/app/tool/_components/form/Button';
import Select from '@/app/tool/_components/form/Select';
import Input from '@/app/tool/_components/form/Input';
import useToolState from '@/app/tool/_hooks/useToolState';
import type { StoredFile } from '@/src/types/storage';
import {
  PREVIEWABLE_TEXT_EXTENSIONS,
  PREVIEWABLE_IMAGE_EXTENSIONS,
  formatBytesCompact,
  getMimeTypeForFile,
} from '@/app/lib/utils';
import {
  ArrowUpTrayIcon,
  TrashIcon,
  XCircleIcon,
  ArrowDownTrayIcon as DownloadIcon,
  FunnelIcon,
  XMarkIcon as ClearFilterIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '@/app/tool/_hooks/useItdeTargetHandler';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '@/app/tool/_components/shared/ReceiveItdeDataTrigger';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import SendToToolButton from '@/app/tool/_components/shared/SendToToolButton';
import toolSpecificMetadata from '../metadata.json';
import type {
  ToolMetadata as AppToolMetadata,
  OutputConfig,
} from '@/src/types/tools';

interface ZipFileExplorerClientProps {
  toolRoute: string;
}

interface PersistedZipExplorerState {
  selectedFileId: string | null;
  selectedFileName: string | null;
  selectedFileSize: number | null;
  expandedFolderPaths: string[];
  selectedPaths: string[];
  extractedFileIds: string[];
  filterName: string;
  filterSelectedExtension: string;
  filterMinDate: string;
  filterMaxDate: string;
  showOnlySelected: boolean;
  hideEmptyFolders: boolean;
}

const DEFAULT_ZIP_EXPLORER_STATE: PersistedZipExplorerState = {
  selectedFileId: null,
  selectedFileName: null,
  selectedFileSize: null,
  expandedFolderPaths: [],
  selectedPaths: [],
  extractedFileIds: [],
  filterName: '',
  filterSelectedExtension: '',
  filterMinDate: '',
  filterMaxDate: '',
  showOnlySelected: false,
  hideEmptyFolders: true,
};

const MAX_TEXT_PREVIEW_SIZE: number = 1024 * 100;
const ownMetadata = toolSpecificMetadata as AppToolMetadata;

export default function ZipFileExplorerClient({
  toolRoute,
}: ZipFileExplorerClientProps) {
  const { getFile, cleanupOrphanedTemporaryFiles, addFile } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const {
    state: persistentState,
    setState: setPersistentState,
    isLoadingState: isLoadingToolState,
    errorLoadingState,
    saveStateNow,
  } = useToolState<PersistedZipExplorerState>(
    toolRoute,
    DEFAULT_ZIP_EXPLORER_STATE
  );

  const [currentZipFile, setCurrentZipFile] = useState<StoredFile | null>(null);
  const [rawFileTree, setRawFileTree] = useState<TreeNodeData[]>([]);
  const [uniqueExtensionsInZip, setUniqueExtensionsInZip] = useState<
    Array<{ value: string; label: string; count: number }>
  >([]);
  const [isLoadingZipProcessing, setIsLoadingZipProcessing] =
    useState<boolean>(false);
  const [isActionInProgress, setIsActionInProgress] = useState<boolean>(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const zipRef = useRef<JSZip | null>(null);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<
    'text' | 'image' | 'unsupported' | 'loading' | null
  >(null);
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [isSelectZipModalOpen, setIsSelectZipModalOpen] = useState(false);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const directiveName = ownMetadata.directive;

  const isLoadingUserActions = isActionInProgress || isLoadingZipProcessing;
  const isLoadingDisplay = isLoadingToolState || isLoadingZipProcessing;
  const displayError = clientError || errorLoadingState;

  const expandedFoldersSet = useMemo(
    () => new Set(persistentState.expandedFolderPaths),
    [persistentState.expandedFolderPaths]
  );
  const selectedPathsSet = useMemo(
    () => new Set(persistentState.selectedPaths),
    [persistentState.selectedPaths]
  );

  const findNodeInTree = useCallback(
    (nodes: TreeNodeData[], path: string): TreeNodeData | undefined => {
      for (const node of nodes) {
        if (node.path === path) return node;
        if (node.children) {
          const found = findNodeInTree(node.children, path);
          if (found) return found;
        }
      }
      return undefined;
    },
    []
  );

  const placeholderSelectedItemsForDiscovery: StoredFile[] = useMemo(() => {
    if (selectedPathsSet.size > 0 && rawFileTree.length > 0) {
      const placeholders: StoredFile[] = [];
      selectedPathsSet.forEach((path) => {
        const node = findNodeInTree(rawFileTree, path);
        if (node && node.type === 'file') {
          const representativeMimeType = getMimeTypeForFile(node.name);
          placeholders.push({
            id: `zip-placeholder-${node.id.replace(/[^a-zA-Z0-9]/g, '-')}`,
            filename: node.name,
            type: representativeMimeType,
            size: 1,
            blob: new Blob(['p'], { type: representativeMimeType }),
            createdAt: new Date(),
            isTemporary: true,
          });
        }
      });
      return placeholders;
    }
    return [];
  }, [selectedPathsSet, rawFileTree, findNodeInTree]);

  const areFiltersActive = useMemo(
    () =>
      !!(
        persistentState.filterName ||
        persistentState.filterSelectedExtension ||
        persistentState.filterMinDate ||
        persistentState.filterMaxDate
      ),
    [
      persistentState.filterName,
      persistentState.filterSelectedExtension,
      persistentState.filterMinDate,
      persistentState.filterMaxDate,
    ]
  );

  const processZipFile = useCallback(
    async (fileToProcess: StoredFile) => {
      if (!fileToProcess.blob) {
        setClientError(
          `File content for "${fileToProcess.filename}" is missing.`
        );
        setIsLoadingZipProcessing(false);
        return;
      }
      setIsLoadingZipProcessing(true);
      setClientError(null);
      setRawFileTree([]);
      zipRef.current = null;

      const oldSelectedFileIdFromState = persistentState.selectedFileId;
      const isNewOrDifferentFile =
        oldSelectedFileIdFromState !== fileToProcess.id;

      try {
        const zip = new JSZip();
        zipRef.current = await zip.loadAsync(fileToProcess.blob);
        const rawEntries: RawZipEntry[] = [];
        zipRef.current.forEach((_, entry) => {
          if (entry.name && !entry.name.startsWith('__MACOSX/')) {
            rawEntries.push({
              name: entry.name,
              isDirectory: entry.dir,
              date: entry.date,
              _zipObject: entry,
            });
          }
        });
        setRawFileTree(buildFileTree(rawEntries));

        let finalStateUpdate: PersistedZipExplorerState;
        const baseUpdate: Partial<PersistedZipExplorerState> = {
          selectedFileId: fileToProcess.id,
          selectedFileName: fileToProcess.filename,
          selectedFileSize: fileToProcess.size,
        };

        if (isNewOrDifferentFile) {
          finalStateUpdate = { ...DEFAULT_ZIP_EXPLORER_STATE, ...baseUpdate };
        } else {
          finalStateUpdate = {
            ...persistentState,
            ...baseUpdate,
            extractedFileIds: [],
          };
        }
        setPersistentState(finalStateUpdate);
        await saveStateNow(finalStateUpdate);

        if (isNewOrDifferentFile && oldSelectedFileIdFromState) {
          console.log(
            `[ZipExplorer processZipFile] New ZIP loaded. Adding old main ZIP ID ${oldSelectedFileIdFromState} to cleanup candidates.`
          );
          cleanupOrphanedTemporaryFiles([oldSelectedFileIdFromState]).catch(
            (e) =>
              console.error(
                `[ZipExplorer processZipFile] Cleanup failed for old main ZIP ID ${oldSelectedFileIdFromState}:`,
                e
              )
          );
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : 'Failed to read or process zip file.';
        setClientError(errorMsg);
        zipRef.current = null;
        const errorState = {
          ...DEFAULT_ZIP_EXPLORER_STATE,
          selectedFileId: fileToProcess.id,
          selectedFileName: fileToProcess.filename,
          selectedFileSize: fileToProcess.size,
        };
        setPersistentState(errorState);
        await saveStateNow(errorState);
      } finally {
        setIsLoadingZipProcessing(false);
      }
    },
    [
      persistentState,
      setPersistentState,
      saveStateNow,
      cleanupOrphanedTemporaryFiles,
    ]
  );

  useEffect(() => {
    if (!isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
      initialToolStateLoadCompleteRef.current = true;
    }

    if (!initialToolStateLoadCompleteRef.current || isLoadingZipProcessing) {
      return;
    }

    if (
      currentZipFile &&
      (persistentState.selectedFileId !== currentZipFile.id ||
        (persistentState.selectedFileId === currentZipFile.id &&
          rawFileTree.length === 0 &&
          !clientError))
    ) {
      processZipFile(currentZipFile);
    } else if (
      persistentState.selectedFileId &&
      !currentZipFile &&
      !clientError
    ) {
      const loadLastZip = async () => {
        console.log(
          '[ZipExplorer useEffect] Attempting to load last used ZIP ID from state:',
          persistentState.selectedFileId
        );
        setIsLoadingZipProcessing(true);
        const file = await getFile(persistentState.selectedFileId!);
        if (file?.blob) {
          setCurrentZipFile(file);
          setIsLoadingZipProcessing(false);
        } else {
          setClientError(
            `Failed to load last used ZIP (ID: ${persistentState.selectedFileId}). It may no longer exist.`
          );
          const clearedState = {
            ...persistentState,
            selectedFileId: null,
            selectedFileName: null,
            selectedFileSize: null,
            extractedFileIds: [],
            selectedPaths: [],
            expandedFolderPaths: [],
          };
          setPersistentState(clearedState);
          await saveStateNow(clearedState);
          setIsLoadingZipProcessing(false);
        }
      };
      loadLastZip().catch(async (e) => {
        console.error('Error auto-loading last used ZIP from state:', e);
        const clearedState = {
          ...persistentState,
          selectedFileId: null,
          selectedFileName: null,
          selectedFileSize: null,
          extractedFileIds: [],
          selectedPaths: [],
          expandedFolderPaths: [],
        };
        setPersistentState(clearedState);
        await saveStateNow(clearedState);
        setIsLoadingZipProcessing(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    persistentState.selectedFileId,
    currentZipFile,
    isLoadingToolState,
    isLoadingZipProcessing,
    clientError,
    processZipFile,
    rawFileTree.length,
  ]);

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      console.log(
        `[ZipExplorer ITDE Receive] Signal from: ${signal.sourceDirective}`
      );
      setClientError(null);
      setIsLoadingZipProcessing(true);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setClientError(
          `Metadata not found for source: ${signal.sourceToolTitle}`
        );
        setIsLoadingZipProcessing(false);
        return;
      }

      const resolvedPayload: ResolvedItdeData = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );
      if (
        resolvedPayload.type === 'error' ||
        resolvedPayload.type === 'none' ||
        !resolvedPayload.data ||
        resolvedPayload.data.length === 0
      ) {
        setClientError(
          resolvedPayload.errorMessage || 'No data received from source.'
        );
        setIsLoadingZipProcessing(false);
        return;
      }

      const receivedFileItem = resolvedPayload.data[0];
      let fileToProcess: StoredFile | null = null;

      if (
        receivedFileItem &&
        (receivedFileItem.type === 'application/zip' ||
          receivedFileItem.type === 'application/x-zip-compressed' ||
          ('name' in receivedFileItem &&
            (receivedFileItem as StoredFile).filename
              .toLowerCase()
              .endsWith('.zip')))
      ) {
        if (!('id' in receivedFileItem)) {
          try {
            const tempName = `itde-received-${Date.now()}.zip`;
            const newId = await addFile(
              receivedFileItem.blob,
              tempName,
              receivedFileItem.type,
              true
            );
            const newlyFetchedFile = await getFile(newId);
            if (!newlyFetchedFile)
              throw new Error(
                `Failed to retrieve saved InlineFile (ID: ${newId})`
              );
            fileToProcess = newlyFetchedFile;
          } catch (e) {
            setClientError(
              `Failed to process incoming ZIP: ${e instanceof Error ? e.message : String(e)}`
            );
            setIsLoadingZipProcessing(false);
            return;
          }
        } else {
          fileToProcess = receivedFileItem as StoredFile;
        }
      } else if (receivedFileItem) {
        setClientError(
          `Received file from ${signal.sourceToolTitle} is not a ZIP (type: ${receivedFileItem.type}).`
        );
        setIsLoadingZipProcessing(false);
        return;
      } else {
        setClientError('No valid file found in ITDE data.');
        setIsLoadingZipProcessing(false);
        return;
      }

      if (fileToProcess) {
        const oldExtractedFileIds = persistentState.extractedFileIds;
        setCurrentZipFile(fileToProcess);
        setUserDeferredAutoPopup(false);
        if (oldExtractedFileIds.length > 0) {
          cleanupOrphanedTemporaryFiles(oldExtractedFileIds).catch((e) =>
            console.error(
              '[ZipExplorer ITDE Receive] Old extracted files cleanup failed:',
              e
            )
          );
        }
      } else {
        setIsLoadingZipProcessing(false);
      }
    },
    [
      getToolMetadata,
      persistentState.extractedFileIds,
      addFile,
      getFile,
      cleanupOrphanedTemporaryFiles,
    ]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (
      initialToolStateLoadCompleteRef.current &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !userDeferredAutoPopup
    )
      itdeTarget.openModalIfSignalsExist();
  }, [itdeTarget, userDeferredAutoPopup, directiveName]);

  const handleClearFilters = useCallback(() => {
    setPersistentState((prev) => ({
      ...prev,
      filterName: '',
      filterSelectedExtension: '',
      filterMinDate: '',
      filterMaxDate: '',
    }));
  }, [setPersistentState]);

  const getAllDescendantPaths = useCallback(
    (folderPath: string, treeToSearch: TreeNodeData[]): string[] => {
      const descendants: string[] = [];
      const node = findNodeInTree(treeToSearch, folderPath);
      const collect = (n: TreeNodeData) => {
        if (n.children)
          n.children.forEach((c) => {
            descendants.push(c.path);
            if (c.type === 'folder') collect(c);
          });
      };
      if (node?.type === 'folder') collect(node);
      return descendants;
    },
    [findNodeInTree]
  );

  const isPathIndeterminate = useCallback(
    (folderPath: string): boolean => {
      if (selectedPathsSet.has(folderPath)) return false;
      const descendants = getAllDescendantPaths(folderPath, rawFileTree);
      if (descendants.length === 0) return false;
      const someChildrenSelected = descendants.some((dp) =>
        selectedPathsSet.has(dp)
      );
      return someChildrenSelected;
    },
    [selectedPathsSet, getAllDescendantPaths, rawFileTree]
  );

  const handleToggleSelection = useCallback(
    (path: string) => {
      setPersistentState((prev) => {
        const newSelectedPaths = new Set(prev.selectedPaths);
        const node = findNodeInTree(rawFileTree, path);
        const descendants =
          node?.type === 'folder'
            ? getAllDescendantPaths(path, rawFileTree)
            : [];
        const pathsToUpdate = [path, ...descendants];
        const isCurrentlyIndeterminate =
          node?.type === 'folder' && isPathIndeterminate(path);
        const isCurrentlyFullySelected =
          newSelectedPaths.has(path) && !isCurrentlyIndeterminate;
        const shouldSelect = !isCurrentlyFullySelected;

        pathsToUpdate.forEach((p) => {
          if (shouldSelect) newSelectedPaths.add(p);
          else newSelectedPaths.delete(p);
        });

        let parentPath = path.substring(0, path.lastIndexOf('/'));
        while (parentPath) {
          const parentNode = findNodeInTree(rawFileTree, parentPath);
          if (parentNode?.type === 'folder' && parentNode.children) {
            const allChildrenNowSelected = parentNode.children.every((child) =>
              newSelectedPaths.has(child.path)
            );
            if (allChildrenNowSelected) newSelectedPaths.add(parentPath);
            else newSelectedPaths.delete(parentPath);
          }
          parentPath = parentPath.substring(0, parentPath.lastIndexOf('/'));
        }
        return { ...prev, selectedPaths: Array.from(newSelectedPaths) };
      });
    },
    [
      setPersistentState,
      rawFileTree,
      getAllDescendantPaths,
      findNodeInTree,
      isPathIndeterminate,
    ]
  );

  useEffect(() => {
    if (rawFileTree.length > 0 && currentZipFile) {
      const extMap: Record<string, number> = {};
      const collectExt = (nodes: TreeNodeData[]) =>
        nodes.forEach((n) => {
          if (n.type === 'file') {
            const p = n.name.split('.');
            if (p.length > 1) {
              const e = p.pop()!.toLowerCase();
              extMap[e] = (extMap[e] || 0) + 1;
            }
          }
          if (n.children) collectExt(n.children);
        });
      collectExt(rawFileTree);
      const sortedExt = Object.entries(extMap)
        .map(([e, c]) => ({
          value: e,
          label: `${e.toUpperCase()} (${c})`,
          count: c,
        }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
      setUniqueExtensionsInZip(sortedExt.slice(0, 30));
    } else setUniqueExtensionsInZip([]);
  }, [rawFileTree, currentZipFile]);

  const handleClear = useCallback(async () => {
    console.log(
      '[ZipExplorer Clear] Clearing current ZIP and all related state.'
    );
    const idsToCleanup: string[] = [...persistentState.extractedFileIds];
    if (persistentState.selectedFileId)
      idsToCleanup.push(persistentState.selectedFileId);

    setCurrentZipFile(null);
    setRawFileTree([]);
    setClientError(null);
    zipRef.current = null;
    setUniqueExtensionsInZip([]);
    setIsPreviewOpen(false);
    setPreviewContent(null);
    setPreviewType(null);
    setPreviewFilename(null);
    setPreviewError(null);

    const stateToSaveOnClear = DEFAULT_ZIP_EXPLORER_STATE;
    setPersistentState(stateToSaveOnClear);
    await saveStateNow(stateToSaveOnClear);

    if (idsToCleanup.length > 0) {
      console.log(
        '[ZipExplorer Clear] Attempting targeted cleanup for IDs:',
        idsToCleanup
      );
      cleanupOrphanedTemporaryFiles(idsToCleanup).catch((e) =>
        console.error('[ZipExplorer Clear] Cleanup failed:', e)
      );
    }
  }, [
    persistentState,
    setPersistentState,
    saveStateNow,
    cleanupOrphanedTemporaryFiles,
  ]);

  const handleFilesSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsSelectZipModalOpen(false);
      setClientError(null);
      const file = files[0];
      if (file) {
        if (
          file.type === 'application/zip' ||
          file.type === 'application/x-zip-compressed' ||
          file.filename.toLowerCase().endsWith('.zip')
        ) {
          const oldExtractedFileIds = persistentState.extractedFileIds;
          setCurrentZipFile(file);
          if (oldExtractedFileIds.length > 0) {
            cleanupOrphanedTemporaryFiles(oldExtractedFileIds).catch((e) =>
              console.error(
                'Cleanup of old extracted files failed on new ZIP selection:',
                e
              )
            );
          }
        } else {
          setClientError('Invalid file. Please select a .zip file.');
        }
      }
    },
    [persistentState.extractedFileIds, cleanupOrphanedTemporaryFiles]
  );

  const handleDownloadEntry = useCallback(
    async (entryData: {
      name: string;
      id: string;
      _zipObject: JSZip.JSZipObject;
    }) => {
      if (!entryData?._zipObject) {
        setClientError(`Download error: Missing data for ${entryData.name}`);
        return;
      }
      setClientError(null);
      setIsActionInProgress(true);
      const filenameToSave = entryData.name.split('/').pop() || entryData.name;
      try {
        const blob = await entryData._zipObject.async('blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filenameToSave;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        setClientError(
          `Download failed for ${filenameToSave}: ${err instanceof Error ? err.message : 'Unknown'}`
        );
      } finally {
        setIsActionInProgress(false);
      }
    },
    []
  );

  const handlePreviewEntry = useCallback(
    async (entryData: {
      name: string;
      id: string;
      _zipObject: JSZip.JSZipObject;
    }) => {
      if (!entryData?._zipObject) {
        setPreviewError(`Preview error: Missing data for ${entryData.name}`);
        setPreviewType('unsupported');
        setIsPreviewOpen(true);
        return;
      }
      setIsPreviewOpen(true);
      setPreviewFilename(entryData.name);
      setPreviewContent(null);
      setPreviewError(null);
      setPreviewType('loading');
      const filenameLower = entryData.name.toLowerCase();
      const extension = filenameLower.substring(
        filenameLower.lastIndexOf('.') + 1
      );
      try {
        if (PREVIEWABLE_TEXT_EXTENSIONS.includes(extension)) {
          const text = await entryData._zipObject.async('string');
          setPreviewContent(
            text.length > MAX_TEXT_PREVIEW_SIZE
              ? text.substring(0, MAX_TEXT_PREVIEW_SIZE) +
                  '\n\n--- Content truncated ---'
              : text
          );
          setPreviewType('text');
        } else if (PREVIEWABLE_IMAGE_EXTENSIONS.includes(extension)) {
          const blob = await entryData._zipObject.async('blob');
          setPreviewContent(URL.createObjectURL(blob));
          setPreviewType('image');
        } else setPreviewType('unsupported');
      } catch (err) {
        setPreviewError(
          `Failed to load preview: ${err instanceof Error ? err.message : 'Unknown'}`
        );
        setPreviewType('unsupported');
      }
    },
    []
  );

  useEffect(() => {
    let uRL: string | null = null;
    if (previewType === 'image' && previewContent?.startsWith('blob:'))
      uRL = previewContent;
    return () => {
      if (uRL) URL.revokeObjectURL(uRL);
    };
  }, [previewType, previewContent]);
  const closePreview = useCallback(() => {
    setIsPreviewOpen(false);
  }, []);

  const toggleFolder = useCallback(
    (path: string) =>
      setPersistentState((prev) => {
        const n = new Set(prev.expandedFolderPaths);
        if (n.has(path)) n.delete(path);
        else n.add(path);
        return { ...prev, expandedFolderPaths: Array.from(n) };
      }),
    [setPersistentState]
  );

  const handleDownloadSelected = useCallback(async () => {
    if (selectedPathsSet.size === 0 || !zipRef.current || isActionInProgress) {
      if (selectedPathsSet.size === 0)
        setClientError('No files selected to download.');
      return;
    }
    const filePathsToDownload = Array.from(selectedPathsSet).filter((p) => {
      const n = findNodeInTree(rawFileTree, p);
      return n && n.type === 'file';
    });
    if (filePathsToDownload.length === 0) {
      setClientError('No actual files in selection for download.');
      return;
    }

    setClientError(null);
    setIsActionInProgress(true);

    if (filePathsToDownload.length === 1) {
      const node = findNodeInTree(rawFileTree, filePathsToDownload[0]);
      if (node?._zipObject)
        await handleDownloadEntry({
          name: node.path,
          id: node.id,
          _zipObject: node._zipObject,
        });
      else setClientError('Could not find data for the selected file.');
      setIsActionInProgress(false);
      return;
    }
    try {
      const downloadZip = new JSZip();
      for (const path of filePathsToDownload) {
        const node = findNodeInTree(rawFileTree, path);
        if (node?._zipObject) {
          const content = await node._zipObject.async('blob');
          downloadZip.file(node.path, content);
        }
      }
      const newZipBlob = await downloadZip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      const base =
        currentZipFile?.filename?.replace(/\.zip$/i, '') ||
        persistentState.selectedFileName?.replace(/\.zip$/i, '') ||
        'archive';
      const dlFilename = `${base}_selection.zip`;
      const url = URL.createObjectURL(newZipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dlFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setClientError(
        `Failed to create ZIP for selection: ${err instanceof Error ? err.message : 'Unknown'}`
      );
    } finally {
      setIsActionInProgress(false);
    }
  }, [
    selectedPathsSet,
    rawFileTree,
    findNodeInTree,
    handleDownloadEntry,
    currentZipFile,
    persistentState.selectedFileName,
    isActionInProgress,
    setClientError,
  ]);

  const toggleShowOnlySelected = () =>
    setPersistentState((prev) => ({
      ...prev,
      showOnlySelected: !prev.showOnlySelected,
    }));
  const toggleHideEmptyFolders = () =>
    setPersistentState((prev) => ({
      ...prev,
      hideEmptyFolders: !prev.hideEmptyFolders,
    }));

  const displayFileTree = useMemo(() => {
    let nodes = [...rawFileTree];
    if (persistentState.filterName.trim()) {
      const term = persistentState.filterName.trim().toLowerCase();
      const filterRec = (n: TreeNodeData[]): TreeNodeData[] =>
        n.reduce((acc, node) => {
          const c = node.children ? filterRec(node.children) : undefined;
          if (node.path.toLowerCase().includes(term) || (c && c.length > 0))
            acc.push({ ...node, children: c });
          return acc;
        }, [] as TreeNodeData[]);
      nodes = filterRec(nodes);
    }
    if (persistentState.filterSelectedExtension) {
      const ext = persistentState.filterSelectedExtension;
      const filterRec = (n: TreeNodeData[]): TreeNodeData[] =>
        n.reduce((acc, node) => {
          const c = node.children ? filterRec(node.children) : undefined;
          let m = node.type === 'folder' && c && c.length > 0;
          if (node.type === 'file') {
            const p = node.name.split('.');
            if (p.length > 1 && p.pop()!.toLowerCase() === ext) m = true;
          }
          if (m) acc.push({ ...node, children: c });
          return acc;
        }, [] as TreeNodeData[]);
      nodes = filterRec(nodes);
    }
    if (persistentState.filterMinDate || persistentState.filterMaxDate) {
      const minTime = persistentState.filterMinDate
        ? new Date(persistentState.filterMinDate).getTime()
        : 0;
      const maxTime = persistentState.filterMaxDate
        ? new Date(persistentState.filterMaxDate).getTime() +
          (24 * 60 * 60 * 1000 - 1)
        : Infinity;
      const filterDateRec = (n: TreeNodeData[]): TreeNodeData[] =>
        n.reduce((acc, node) => {
          const c = node.children ? filterDateRec(node.children) : undefined;
          let matches = node.type === 'folder' && c && c.length > 0;
          if (node.type === 'file' && node.date) {
            const nodeTime = node.date.getTime();
            if (nodeTime >= minTime && nodeTime <= maxTime) matches = true;
          }
          if (matches) acc.push({ ...node, children: c });
          return acc;
        }, [] as TreeNodeData[]);
      nodes = filterDateRec(nodes);
    }
    if (persistentState.showOnlySelected && selectedPathsSet.size > 0) {
      const filterRec = (n: TreeNodeData[]): TreeNodeData[] =>
        n.reduce((acc, node) => {
          const c = node.children ? filterRec(node.children) : undefined;
          if (
            selectedPathsSet.has(node.path) ||
            (isPathIndeterminate(node.path) && node.type === 'folder') ||
            (c && c.length > 0)
          )
            acc.push({ ...node, children: c });
          return acc;
        }, [] as TreeNodeData[]);
      nodes = filterRec(nodes);
    }
    if (persistentState.hideEmptyFolders) {
      const pruneRec = (n: TreeNodeData[]): TreeNodeData[] =>
        n.filter((node) => {
          if (node.type === 'file') return true;
          if (node.children) {
            node.children = pruneRec(node.children);
            return node.children.length > 0;
          }
          return false;
        });
      nodes = pruneRec(nodes);
    }
    return nodes;
  }, [
    rawFileTree,
    persistentState.filterName,
    persistentState.filterSelectedExtension,
    persistentState.filterMinDate,
    persistentState.filterMaxDate,
    persistentState.showOnlySelected,
    persistentState.hideEmptyFolders,
    selectedPathsSet,
    isPathIndeterminate,
  ]);

  const fileCountInDisplayTree = useMemo(() => {
    let c = 0;
    const count = (n: TreeNodeData[]) => {
      n.forEach((node) => {
        if (node.type === 'file') c++;
        if (node.children) count(node.children);
      });
    };
    count(displayFileTree);
    return c;
  }, [displayFileTree]);

  const handlePreSignalForZip = async (): Promise<boolean | void> => {
    if (isLoadingUserActions) return false;
    const filePathsToExtract = Array.from(selectedPathsSet).filter((path) => {
      const node = findNodeInTree(rawFileTree, path);
      return node && node.type === 'file';
    });
    if (filePathsToExtract.length === 0) {
      setClientError('No actual files selected in ZIP to send for ITDE.');
      return false;
    }

    setIsActionInProgress(true);
    setClientError(null);
    const tempIds: string[] = [];
    try {
      for (const path of filePathsToExtract) {
        const node = findNodeInTree(rawFileTree, path);
        if (node?._zipObject) {
          const blob = await node._zipObject.async('blob');
          const mimeType = getMimeTypeForFile(node.name);
          const newId = await addFile(blob, node.name, mimeType, true);
          tempIds.push(newId);
        } else throw new Error(`Could not find zip object for path: ${path}`);
      }
      const newStateForSave = { ...persistentState, extractedFileIds: tempIds };
      setPersistentState(newStateForSave);
      await saveStateNow(newStateForSave);
      console.log(
        '[ZipExplorer PreSignalForITDE] Extracted temp file IDs for sending:',
        tempIds
      );
      return true;
    } catch (extractErr) {
      const errorMsg =
        extractErr instanceof Error
          ? extractErr.message
          : 'Unknown extraction error.';
      setClientError(`Failed to prepare files for sending: ${errorMsg}`);
      console.error(
        `[ZipExplorer PreSignalForITDE] Failed to extract files:`,
        extractErr
      );
      throw extractErr;
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleModalDeferAll = () => {
    setUserDeferredAutoPopup(true);
    itdeTarget.closeModal();
  };
  const handleModalIgnoreAll = () => {
    setUserDeferredAutoPopup(false);
    itdeTarget.ignoreAllSignals();
  };
  const handleModalAccept = (sd: string) => itdeTarget.acceptSignal(sd);
  const handleModalIgnore = (sd: string) => {
    itdeTarget.ignoreSignal(sd);
    if (
      itdeTarget.pendingSignals.filter((s) => s.sourceDirective !== sd)
        .length === 0
    )
      setUserDeferredAutoPopup(false);
  };

  if (isLoadingToolState && !initialToolStateLoadCompleteRef.current)
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading ZIP Explorer...
      </p>
    );

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="primary"
            onClick={() => setIsSelectZipModalOpen(true)}
            disabled={isLoadingUserActions}
            iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}
          >
            Select ZIP
          </Button>
          {(currentZipFile || rawFileTree.length > 0 || displayError) && (
            <Button
              variant="danger"
              onClick={handleClear}
              disabled={isLoadingUserActions}
              iconLeft={<TrashIcon className="h-5 w-5" />}
            >
              Clear ZIP
            </Button>
          )}
          <div className="ml-auto">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={
                itdeTarget.pendingSignals.length > 0 &&
                userDeferredAutoPopup &&
                !itdeTarget.isModalOpen
              }
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
          </div>
        </div>
        <div className="mt-2 text-sm text-[rgb(var(--color-text-muted))] h-5">
          {isLoadingZipProcessing && currentZipFile && (
            <span>
              Processing: <em>{currentZipFile.filename}</em>...
            </span>
          )}
          {!isLoadingZipProcessing &&
            currentZipFile &&
            rawFileTree.length > 0 && (
              <span>
                Loaded: <strong>{currentZipFile.filename}</strong> (
                {persistentState.selectedFileSize
                  ? formatBytesCompact(persistentState.selectedFileSize)
                  : 'size unknown'}
                ).
              </span>
            )}
          {!isLoadingZipProcessing &&
            currentZipFile &&
            rawFileTree.length === 0 &&
            !displayError && (
              <span>
                Loaded <strong>{currentZipFile.filename}</strong>, but it
                appears empty or unreadable.
              </span>
            )}
          {!isLoadingUserActions &&
            !currentZipFile &&
            !displayError &&
            persistentState.selectedFileName && (
              <span className="italic">
                Previously: {persistentState.selectedFileName} (
                {persistentState.selectedFileSize
                  ? formatBytesCompact(persistentState.selectedFileSize)
                  : '?'}
                ). Select new.
              </span>
            )}
          {!isLoadingUserActions &&
            !currentZipFile &&
            !displayError &&
            !persistentState.selectedFileName && (
              <span>Ready for ZIP file.</span>
            )}
        </div>
      </div>

      {!isLoadingDisplay && rawFileTree.length > 0 && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="text-lg font-semibold text-[rgb(var(--color-text-base))] flex items-center">
              <FunnelIcon className="h-5 w-5 mr-2 text-[rgb(var(--color-text-muted))]" />
              Filter & View
            </h3>
            <Button
              variant="neutral-outline"
              size="sm"
              onClick={handleClearFilters}
              disabled={!areFiltersActive || isLoadingUserActions}
              iconLeft={<ClearFilterIcon className="h-4 w-4" />}
              title="Clear filters"
            >
              Clear Filters
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-start">
            <Input
              label="Name/Path contains:"
              id="filterNameInput"
              value={persistentState.filterName}
              onChange={(e) =>
                setPersistentState((prev) => ({
                  ...prev,
                  filterName: e.target.value,
                }))
              }
              placeholder="e.g., .txt, image"
              disabled={isLoadingUserActions}
            />
            <Select
              label="File Type:"
              id="filterExtension"
              options={[
                {
                  value: '',
                  label: `All Types (${uniqueExtensionsInZip.reduce((s, ex) => s + ex.count, 0)})`,
                },
                ...uniqueExtensionsInZip,
              ]}
              value={persistentState.filterSelectedExtension}
              onChange={(e) =>
                setPersistentState((prev) => ({
                  ...prev,
                  filterSelectedExtension: e.target.value,
                }))
              }
              disabled={
                isLoadingUserActions || uniqueExtensionsInZip.length === 0
              }
              selectClassName="text-sm py-2"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-start pt-3 border-t border-[rgb(var(--color-border-base))]">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                View Toggles:
              </label>
              <div className="flex flex-wrap items-stretch gap-2">
                <Button
                  onClick={toggleShowOnlySelected}
                  variant={
                    persistentState.showOnlySelected
                      ? 'accent-outline'
                      : 'neutral-outline'
                  }
                  size="sm"
                  iconLeft={<FunnelIcon className="h-4 w-4" />}
                  disabled={isLoadingUserActions || selectedPathsSet.size === 0}
                  title={
                    persistentState.showOnlySelected
                      ? 'Show all'
                      : 'Filter selected'
                  }
                >
                  {persistentState.showOnlySelected
                    ? `Selected (${placeholderSelectedItemsForDiscovery.length})`
                    : 'Filter Selected'}
                </Button>
                <Button
                  onClick={toggleHideEmptyFolders}
                  variant={
                    persistentState.hideEmptyFolders
                      ? 'accent-outline'
                      : 'neutral-outline'
                  }
                  size="sm"
                  disabled={isLoadingUserActions}
                  title={
                    persistentState.hideEmptyFolders
                      ? 'Show empty'
                      : 'Hide empty'
                  }
                >
                  {persistentState.hideEmptyFolders
                    ? 'Hiding Empty'
                    : 'Hide Empty'}
                </Button>
                <Button
                  variant="neutral-outline"
                  size="sm"
                  disabled
                  title="Date Filter (Coming Soon)"
                  iconLeft={<CalendarDaysIcon className="h-4 w-4" />}
                >
                  Dates
                </Button>
              </div>
            </div>
            {/* Date Filter UI will go here (Input components) */}
          </div>
          <p className="text-xs text-right text-gray-500 mt-1 pr-1">
            Displaying {fileCountInDisplayTree} files / {displayFileTree.length}{' '}
            total entries in tree.
          </p>
        </div>
      )}

      {displayError && (
        <div
          role="alert"
          className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2"
        >
          <XCircleIcon className="h-5 w-5 shrink-0" />
          <strong className="font-semibold">Error:</strong> {displayError}
        </div>
      )}
      {isLoadingDisplay && !displayError && (
        <div className="p-4 text-center text-gray-500 italic animate-pulse">
          Loading tree view...
        </div>
      )}

      {!isLoadingDisplay && rawFileTree.length > 0 && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md">
          <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
            <h2 className="text-lg font-semibold text-[rgb(var(--color-text-base))]">
              Contents of “
              {currentZipFile?.filename ||
                persistentState.selectedFileName ||
                'Archive'}
              ”:
            </h2>
            <div className="flex gap-2 items-center">
              {selectedPathsSet.size > 0 &&
                placeholderSelectedItemsForDiscovery.length > 0 && (
                  <Button
                    variant="secondary"
                    onClick={handleDownloadSelected}
                    disabled={isLoadingUserActions}
                    isLoading={isActionInProgress && !isLoadingZipProcessing}
                    loadingText="Zipping..."
                    iconLeft={<DownloadIcon className="h-5 w-5" />}
                    title="Download selected files"
                  >{`Download (${placeholderSelectedItemsForDiscovery.length})`}</Button>
                )}
              {selectedPathsSet.size > 0 &&
                placeholderSelectedItemsForDiscovery.length > 0 && (
                  <SendToToolButton
                    currentToolDirective={directiveName}
                    currentToolOutputConfig={
                      ownMetadata.outputConfig as OutputConfig
                    }
                    selectedOutputItems={placeholderSelectedItemsForDiscovery}
                    onBeforeSignal={handlePreSignalForZip}
                    buttonText="Send To..."
                    className={
                      isLoadingUserActions
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }
                  />
                )}
            </div>
          </div>
          <div className="font-mono text-sm space-y-0.5 max-h-[60vh] overflow-auto border border-[rgb(var(--color-border-base))] rounded p-2 bg-[rgb(var(--color-bg-component))]">
            {displayFileTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                level={0}
                expandedFolders={expandedFoldersSet}
                selectedPaths={selectedPathsSet}
                isPathIndeterminate={isPathIndeterminate}
                onToggle={toggleFolder}
                onToggleSelection={handleToggleSelection}
                onDownload={handleDownloadEntry}
                onPreview={handlePreviewEntry}
              />
            ))}
            {displayFileTree.length === 0 && rawFileTree.length > 0 && (
              <p className="text-center text-gray-500 italic py-4">
                No items match current filters.
              </p>
            )}
          </div>
        </div>
      )}
      {!isLoadingDisplay &&
        !displayError &&
        !currentZipFile &&
        !persistentState.selectedFileId && (
          <p className="p-4 text-lg text-center text-gray-400 italic">
            Select a ZIP file to begin exploring.
          </p>
        )}

      <FileSelectionModal
        isOpen={isSelectZipModalOpen}
        onClose={() => setIsSelectZipModalOpen(false)}
        onFilesSelected={handleFilesSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".zip,application/zip,application/x-zip-compressed"
        selectionMode="single"
        libraryFilter={{ type: 'application/zip' }}
        initialTab="upload"
      />
      {isPreviewOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]"
          onClick={closePreview}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 px-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
              <h3
                className="text-lg font-semibold truncate"
                title={previewFilename || ''}
              >
                {previewFilename || 'Preview'}
              </h3>
              <Button variant="link" onClick={closePreview} className="!p-1">
                <XCircleIcon className="h-6 w-6 text-gray-500 hover:text-gray-700" />
              </Button>
            </div>
            <div className="p-4 overflow-auto flex-grow min-h-[200px]">
              {previewType === 'loading' && (
                <p className="text-center animate-pulse">Loading preview...</p>
              )}
              {previewError && (
                <div
                  role="alert"
                  className="p-2 bg-red-50 text-red-700 rounded text-sm"
                >
                  <strong className="font-semibold">Error:</strong>{' '}
                  {previewError}
                </div>
              )}
              {!previewError && previewType === 'text' && (
                <pre className="text-sm whitespace-pre-wrap break-words max-h-[calc(90vh-100px)] overflow-auto">
                  <code>{previewContent}</code>
                </pre>
              )}
              {!previewError && previewType === 'image' && previewContent && (
                <div className="flex justify-center items-center h-full max-h-[calc(90vh-100px)]">
                  <Image
                    src={previewContent}
                    alt={previewFilename || 'Preview'}
                    width={800}
                    height={600}
                    className="max-w-full max-h-full object-contain"
                    onError={() => setPreviewError('Failed to load image.')}
                    unoptimized
                  />
                </div>
              )}
              {!previewError && previewType === 'unsupported' && (
                <p className="text-center">
                  Preview not available for this file type.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={handleModalAccept}
        onIgnore={handleModalIgnore}
        onDeferAll={handleModalDeferAll}
        onIgnoreAll={handleModalIgnoreAll}
      />
    </div>
  );
}
