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
import type { RawZipEntry, TreeNodeData, ActionEntryData } from './types';
import { buildFileTree } from './utils';
import TreeNode from './TreeNode';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import Button from '../../_components/form/Button';
import Select from '../../_components/form/Select';
import useToolState from '../../_hooks/useToolState';
import type { StoredFile, InlineFile as AppInlineFile } from '@/src/types/storage';
import {
  PREVIEWABLE_TEXT_EXTENSIONS,
  PREVIEWABLE_IMAGE_EXTENSIONS,
  formatBytesCompact,
} from '@/app/lib/utils';
import {
  ArrowUpTrayIcon,
  TrashIcon,
  XCircleIcon,
  ArrowDownTrayIcon as DownloadIcon,
  FunnelIcon,
  XMarkIcon as ClearFilterIcon,
} from '@heroicons/react/24/outline';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import SendToToolButton from '../../_components/shared/SendToToolButton';
import toolSpecificMetadata from '../metadata.json';
import type { ToolMetadata as AppToolMetadata, OutputConfig } from '@/src/types/tools';

interface ZipFileExplorerClientProps {
  toolRoute: string;
}

interface PersistedZipExplorerState {
  selectedFileId: string | null;
  selectedFileName: string | null;
  selectedFileSize: number | null;
  expandedFolderPaths: string[];
  selectedPaths: string[];
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
  filterName: '',
  filterSelectedExtension: '',
  filterMinDate: '',
  filterMaxDate: '',
  showOnlySelected: false,
  hideEmptyFolders: true,
};

const MAX_TEXT_PREVIEW_SIZE: number = 1024 * 50;
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
  const [clientError, setClientError] = useState<string | null>(null);
  const zipRef = useRef<JSZip | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<
    'text' | 'image' | 'unsupported' | 'loading' | null
  >(null);
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);
  
  const directiveName = ownMetadata.directive;

  const isLoading = isLoadingToolState || isLoadingZipProcessing;
  const error = clientError || errorLoadingState;

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
    if (selectedPathsSet.size > 0) {
      const placeholders: StoredFile[] = [];
      selectedPathsSet.forEach(path => {
        const node = findNodeInTree(rawFileTree, path);
        let representativeMimeType = 'application/octet-stream';
        let nodeName = "Selected Item";

        if (node && node.type === 'file') {
          nodeName = node.name;
          const nameParts = node.name.split('.');
          const ext = nameParts.length > 1 ? nameParts.pop()!.toLowerCase() : '';
          if (PREVIEWABLE_TEXT_EXTENSIONS.includes(ext)) {
            representativeMimeType = 'text/plain';
          } else if (PREVIEWABLE_IMAGE_EXTENSIONS.includes(ext)) {
            if (['png', 'jpeg', 'jpg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
              representativeMimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            } else {
              representativeMimeType = 'image/*';
            }
          } else if (ext === 'zip') {
            representativeMimeType = 'application/zip';
          } else if (ext === 'pdf') {
            representativeMimeType = 'application/pdf';
          }
        } else if (node && node.type === 'folder') {
            nodeName = node.name;
            representativeMimeType = 'application/x-directory'; 
        }
        
        placeholders.push({
          id: `zip-placeholder-${node ? node.id.replace(/[^a-zA-Z0-9]/g, '-') : path.replace(/[^a-zA-Z0-9]/g, '-')}`,
          name: nodeName,
          type: representativeMimeType,
          size: 1, 
          blob: new Blob(['p'], {type: representativeMimeType}),
          createdAt: new Date(),
          isTemporary: true,
        });
      });
      return placeholders;
    }
    return [];
  }, [selectedPathsSet, rawFileTree, findNodeInTree]);

  const areFiltersActive = useMemo(() => {
    return !!(
      persistentState.filterName ||
      persistentState.filterSelectedExtension ||
      persistentState.filterMinDate ||
      persistentState.filterMaxDate
    );
  }, [
    persistentState.filterName,
    persistentState.filterSelectedExtension,
    persistentState.filterMinDate,
    persistentState.filterMaxDate,
  ]);

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      setClientError(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) { setClientError(`Metadata not found for source: ${signal.sourceToolTitle}`); return; }
      const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);
      if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
        setClientError(resolvedPayload.errorMessage || 'No data received from source.'); return;
      }
      const receivedFileItem: StoredFile | AppInlineFile | null = resolvedPayload.data[0];
      let fileToProcess: StoredFile | null = null;

      if (receivedFileItem && (receivedFileItem.type === 'application/zip' || receivedFileItem.type === 'application/x-zip-compressed' || ('name' in receivedFileItem && (receivedFileItem as StoredFile).name.toLowerCase().endsWith('.zip')) )) {
        if (!('id' in receivedFileItem)) { 
          try {
            const tempName = `itde-received-${Date.now()}.zip`;
            const newId = await addFile(receivedFileItem.blob, tempName, receivedFileItem.type, true);
            const newlyFetchedFile = await getFile(newId);
            if (!newlyFetchedFile) {
              throw new Error(`Failed to retrieve newly saved InlineFile (ID: ${newId}) as StoredFile from library.`);
            }
            fileToProcess = newlyFetchedFile;
          } catch(e) { setClientError(`Failed to process incoming ZIP data: ${e instanceof Error ? e.message : String(e)}`); return; }
        } else { 
          fileToProcess = receivedFileItem as StoredFile
        }
      } else if (receivedFileItem) {
        setClientError(`Received file from ${signal.sourceToolTitle} is not a ZIP (type: ${receivedFileItem.type}).`); return;
      } else {
        setClientError('No valid file found in received ITDE data.'); return;
      }

      if (fileToProcess) {
        const oldSelectedId = persistentState.selectedFileId;
        const newState: PersistedZipExplorerState = { ...DEFAULT_ZIP_EXPLORER_STATE, selectedFileId: fileToProcess.id, selectedFileName: fileToProcess.name, selectedFileSize: fileToProcess.size };
        setPersistentState(newState); await saveStateNow(newState);
        setCurrentZipFile(null); setRawFileTree([]); zipRef.current = null; setUniqueExtensionsInZip([]); setUserDeferredAutoPopup(false);
        const destatedIds = [oldSelectedId].filter((id): id is string => !!(id && id !== fileToProcess!.id));
        if (destatedIds.length > 0) { cleanupOrphanedTemporaryFiles(destatedIds).catch(e => console.error('[ZipExplorer ITDE Receive] Cleanup failed:', e)); }
      }
    },
    [getToolMetadata, persistentState.selectedFileId, setPersistentState, saveStateNow, cleanupOrphanedTemporaryFiles, addFile, getFile]
  );

  const itdeTarget = useItdeTargetHandler({ targetToolDirective: directiveName, onProcessSignal: handleProcessIncomingSignal });

  useEffect(() => { if (!isLoadingToolState) { if (!initialToolStateLoadCompleteRef.current) { initialToolStateLoadCompleteRef.current = true; } } else { if (initialToolStateLoadCompleteRef.current) { initialToolStateLoadCompleteRef.current = false; } } }, [isLoadingToolState]);
  useEffect(() => { const canProceed = !isLoadingToolState && initialToolStateLoadCompleteRef.current; if ( canProceed && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup ) { itdeTarget.openModalIfSignalsExist(); } }, [isLoadingToolState, itdeTarget, userDeferredAutoPopup, directiveName]);
  
  const handleClearFilters = useCallback(() => { setPersistentState((prev) => ({ ...prev, filterName: '', filterSelectedExtension: '', filterMinDate: '', filterMaxDate: '' })); }, [setPersistentState]);

  const getAllDescendantPaths = useCallback(
    (folderPath: string, treeToSearch: TreeNodeData[]): string[] => {
      const descendants: string[] = [];
      const folderNode = findNodeInTree(treeToSearch, folderPath);
      const collect = (node: TreeNodeData) => {
        if (node.children) {
          node.children.forEach((child) => {
            descendants.push(child.path);
            if (child.type === 'folder') collect(child);
          });
        }
      };
      if (folderNode?.type === 'folder') collect(folderNode);
      return descendants;
    },
    [findNodeInTree]
  );

  const isPathIndeterminate = useCallback(
    (folderPath: string): boolean => {
      if (selectedPathsSet.has(folderPath)) return false;
      const descendants = getAllDescendantPaths(folderPath, rawFileTree);
      if (descendants.length === 0) return false;
      return descendants.some(descPath => selectedPathsSet.has(descPath));
    },
    [selectedPathsSet, getAllDescendantPaths, rawFileTree]
  );

  const handleToggleSelection = useCallback(
    (path: string) => {
      setPersistentState((prev) => {
        const currentSelectedPaths = new Set(prev.selectedPaths);
        const isCurrentlySelected = currentSelectedPaths.has(path);
        const node = findNodeInTree(rawFileTree, path);
        const descendants = node?.type === 'folder' ? getAllDescendantPaths(path, rawFileTree) : [];
        
        const pathsToUpdate = [path, ...descendants];
        pathsToUpdate.forEach(p => {
            if (!isCurrentlySelected) currentSelectedPaths.add(p);
            else currentSelectedPaths.delete(p);
        });

        let parentPath = path.substring(0, path.lastIndexOf('/'));
        while(parentPath) {
            const parentNode = findNodeInTree(rawFileTree, parentPath);
            if (parentNode?.type === 'folder' && parentNode.children) {
                const allChildrenSelected = parentNode.children.every(child => currentSelectedPaths.has(child.path));
                if (allChildrenSelected) currentSelectedPaths.add(parentPath);
                else currentSelectedPaths.delete(parentPath);
            }
            parentPath = parentPath.substring(0, parentPath.lastIndexOf('/'));
        }
        return { ...prev, selectedPaths: Array.from(currentSelectedPaths) };
      });
    },
    [setPersistentState, rawFileTree, getAllDescendantPaths, findNodeInTree]
  );

  useEffect(() => { 
    if (rawFileTree.length > 0 && currentZipFile) {
      const extensionsMap: Record<string, number> = {};
      const collectExtensions = (nodes: TreeNodeData[]) => {
        nodes.forEach(node => {
          if (node.type === 'file') {
            const parts = node.name.split('.');
            if (parts.length > 1) { const ext = parts.pop()!.toLowerCase(); extensionsMap[ext] = (extensionsMap[ext] || 0) + 1; }
          }
          if (node.children) collectExtensions(node.children);
        });
      };
      collectExtensions(rawFileTree);
      const sortedExtArray = Object.entries(extensionsMap).map(([ext, count]) => ({ value: ext, label: `${ext.toUpperCase()} (${count})`, count })).sort((a,b) => b.count - a.count || a.value.localeCompare(b.value));
      setUniqueExtensionsInZip(sortedExtArray.slice(0,30));
    } else {
      setUniqueExtensionsInZip([]);
    }
  }, [rawFileTree, currentZipFile]);

  const processZipFile = useCallback(
    async (fileToProcess: StoredFile) => {
      if (!fileToProcess.blob) { setClientError('Selected file is missing content.'); return; }
      setIsLoadingZipProcessing(true); setClientError(null); setRawFileTree([]); zipRef.current = null;
      const isNewOrDifferentFile = persistentState.selectedFileId !== fileToProcess.id;
      try {
        const zip = new JSZip();
        zipRef.current = await zip.loadAsync(fileToProcess.blob);
        const rawEntries: RawZipEntry[] = [];
        zipRef.current.forEach((_, zipEntry) => { if (zipEntry.name && !zipEntry.name.startsWith('__MACOSX/')) rawEntries.push({ name: zipEntry.name, isDirectory: zipEntry.dir, date: zipEntry.date, _zipObject: zipEntry }); });
        setRawFileTree(buildFileTree(rawEntries));
        const baseUpdate: Partial<PersistedZipExplorerState> = { selectedFileId: fileToProcess.id, selectedFileName: fileToProcess.name, selectedFileSize: fileToProcess.size };
        if (isNewOrDifferentFile) setPersistentState(_prev => ({ ...DEFAULT_ZIP_EXPLORER_STATE, ...baseUpdate }));
        else setPersistentState(prev => ({ ...prev, ...baseUpdate }));
      } catch (err) {
        setClientError(err instanceof Error ? err.message : 'Failed to read zip file.'); zipRef.current = null;
        setPersistentState(prev => ({ ...prev, selectedFileId: null, selectedFileName: null, selectedFileSize: null, selectedPaths: [], expandedFolderPaths: [] }));
      } finally { setIsLoadingZipProcessing(false); }
    },
    [setPersistentState, persistentState.selectedFileId]
  );

  useEffect(() => { 
    if (!isLoadingToolState && !isLoadingZipProcessing && persistentState.selectedFileId && (!currentZipFile || currentZipFile.id !== persistentState.selectedFileId)) {
      const load = async () => {
        if (!persistentState.selectedFileId) return;
        const file = await getFile(persistentState.selectedFileId);
        if (file?.blob?.size) { setCurrentZipFile(file); await processZipFile(file); } 
        else { setPersistentState(prev => ({ ...prev, selectedFileId: null, selectedFileName: null, selectedFileSize: null })); }
      };
      load().catch(e => { console.error("Error auto-loading last ZIP:", e); setPersistentState(prev => ({ ...prev, selectedFileId: null, selectedFileName: null, selectedFileSize: null })); });
    }
  }, [persistentState.selectedFileId, isLoadingToolState, isLoadingZipProcessing, currentZipFile, getFile, processZipFile, setPersistentState]);

  const handleClear = useCallback(async () => { setCurrentZipFile(null); setRawFileTree([]); setClientError(null); zipRef.current = null; setPersistentState(DEFAULT_ZIP_EXPLORER_STATE); setIsPreviewOpen(false); setUniqueExtensionsInZip([]); setUserDeferredAutoPopup(false); }, [setPersistentState]);

  const handleFilesSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsModalOpen(false); setClientError(null);
      const file = files[0];
      if (file) {
        if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || file.name.toLowerCase().endsWith('.zip')) {
          const oldId = persistentState.selectedFileId;
          const update: Partial<PersistedZipExplorerState> = { ...DEFAULT_ZIP_EXPLORER_STATE, selectedFileId: file.id, selectedFileName: file.name, selectedFileSize: file.size };
          setPersistentState(update); await saveStateNow({ ...persistentState, ...update });
          setCurrentZipFile(file); await processZipFile(file); setUserDeferredAutoPopup(false);
          const destated = [oldId].filter((id): id is string => !!(id && id !== file.id));
          if (destated.length > 0) cleanupOrphanedTemporaryFiles(destated).catch(e => console.error('Cleanup failed after new ZIP selection:', e));
        } else { setClientError('Invalid file type. Please select a .zip file.'); }
      }
    },
    [processZipFile, persistentState, setPersistentState, saveStateNow, cleanupOrphanedTemporaryFiles]
  );

  const handleDownload = useCallback(async (entryData: ActionEntryData) => {
    if (!entryData?._zipObject) { setClientError(`Download error: Zip object missing for ${entryData.name}`); return; }
    setClientError(null);
    const zipObject = entryData._zipObject;
    const filenameToSave = entryData.id.split('/').pop() || entryData.name;
    try {
      const blob = await zipObject.async('blob');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = filenameToSave;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown download error';
      setClientError(`Download failed for ${filenameToSave}: ${message}`);
    }
  }, []);

  const handlePreview = useCallback(async (entryData: ActionEntryData) => {
    if (!entryData?._zipObject) { setPreviewError(`Preview error: Zip object missing for ${entryData.name}`); setPreviewType('unsupported'); setIsPreviewOpen(true); return; }
    setIsPreviewOpen(true); setPreviewFilename(entryData.id); setPreviewContent(null);
    setPreviewError(null); setPreviewType('loading');
    const zipObject = entryData._zipObject;
    const filenameLower = entryData.id.toLowerCase();
    const extension = filenameLower.substring(filenameLower.lastIndexOf('.') + 1);
    let generatedPreviewType: typeof previewType = 'unsupported';
    try {
      if (PREVIEWABLE_TEXT_EXTENSIONS.includes(extension)) {
        const textContent = await zipObject.async('string');
        setPreviewContent(MAX_TEXT_PREVIEW_SIZE > 0 && textContent.length > MAX_TEXT_PREVIEW_SIZE ? textContent.substring(0, MAX_TEXT_PREVIEW_SIZE) + '\n\n--- Content truncated ---' : textContent);
        generatedPreviewType = 'text';
      } else if (PREVIEWABLE_IMAGE_EXTENSIONS.includes(extension)) {
        const blob = await zipObject.async('blob');
        const objectUrl = URL.createObjectURL(blob);
        setPreviewContent(objectUrl);
        generatedPreviewType = 'image';
      }
      setPreviewType(generatedPreviewType);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown preview error';
      setPreviewError(`Failed to load preview: ${message}`); setPreviewType('unsupported');
    }
  }, []);

  useEffect(() => {
    let currentObjectUrl: string | null = null;
    if (previewType === 'image' && previewContent?.startsWith('blob:')) currentObjectUrl = previewContent;
    return () => { if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl); };
  }, [previewType, previewContent]);

  const closePreview = useCallback(() => { setIsPreviewOpen(false); setPreviewContent(null); setPreviewType(null); setPreviewFilename(null); setPreviewError(null); }, []);
  
  const toggleFolder = useCallback(
    (folderPath: string) => {
      setPersistentState((prev) => {
        const currentPaths = new Set(prev.expandedFolderPaths);
        if (currentPaths.has(folderPath)) currentPaths.delete(folderPath);
        else currentPaths.add(folderPath);
        return { ...prev, expandedFolderPaths: Array.from(currentPaths) };
      });
    },
    [setPersistentState]
  );

  const handleDownloadSelected = () => { alert(`Download Selected clicked. ${selectedPathsSet.size} items. (Not implemented)`); };
  const toggleShowOnlySelected = () => setPersistentState((prev) => ({ ...prev, showOnlySelected: !prev.showOnlySelected }));
  const toggleHideEmptyFolders = () => setPersistentState((prev) => ({ ...prev, hideEmptyFolders: !prev.hideEmptyFolders }));
  
  const displayFileTree = useMemo(() => {
    let nodesToFilter = [...rawFileTree];
    if (persistentState.filterName.trim()) {
      const searchTerm = persistentState.filterName.trim().toLowerCase();
      const filterByNameRec = (nodes: TreeNodeData[]): TreeNodeData[] => nodes.reduce((acc, node) => { const children = node.children ? filterByNameRec(node.children) : undefined; if (node.path.toLowerCase().includes(searchTerm) || (children && children.length > 0)) { acc.push({ ...node, children }); } return acc; }, [] as TreeNodeData[]);
      nodesToFilter = filterByNameRec(nodesToFilter);
    }
    if (persistentState.filterSelectedExtension) {
      const targetExt = persistentState.filterSelectedExtension;
      const filterByExtRec = (nodes: TreeNodeData[]): TreeNodeData[] => nodes.reduce((acc, node) => { const children = node.children ? filterByExtRec(node.children) : undefined; let matches = node.type === 'folder' && children && children.length > 0; if (node.type === 'file') { const nameParts = node.name.split('.'); if (nameParts.length > 1 && nameParts.pop()!.toLowerCase() === targetExt) matches = true; } if (matches) acc.push({ ...node, children }); return acc; }, [] as TreeNodeData[]);
      nodesToFilter = filterByExtRec(nodesToFilter);
    }
    if (persistentState.filterMinDate || persistentState.filterMaxDate) {
      const minDate = persistentState.filterMinDate ? new Date(persistentState.filterMinDate).getTime() : 0;
      const maxDate = persistentState.filterMaxDate ? new Date(persistentState.filterMaxDate).getTime() + (24*60*60*1000 -1) : Infinity;
      const filterByDateRec = (nodes: TreeNodeData[]): TreeNodeData[] => nodes.reduce((acc, node) => { const children = node.children ? filterByDateRec(node.children) : undefined; let matches = node.type === 'folder' && children && children.length > 0; if (node.type === 'file' && node.date) { const nodeTime = node.date.getTime(); if (nodeTime >= minDate && nodeTime <= maxDate) matches = true; } if (matches) acc.push({ ...node, children }); return acc; }, [] as TreeNodeData[]);
      nodesToFilter = filterByDateRec(nodesToFilter);
    }
    if (persistentState.showOnlySelected && selectedPathsSet.size > 0) {
      const filterSelectedRec = (nodes: TreeNodeData[]): TreeNodeData[] => nodes.reduce((acc, node) => { const children = node.children ? filterSelectedRec(node.children) : undefined; if (selectedPathsSet.has(node.path) || (children && children.length > 0)) { acc.push({ ...node, children }); } return acc; }, [] as TreeNodeData[]);
      nodesToFilter = filterSelectedRec(nodesToFilter);
    }
    if (persistentState.hideEmptyFolders) {
      const pruneEmptyRec = (nodes: TreeNodeData[]): TreeNodeData[] => nodes.filter((node) => { if (node.type === 'file') return true; if (node.children) { node.children = pruneEmptyRec(node.children); return node.children.length > 0; } return false; });
      nodesToFilter = pruneEmptyRec(nodesToFilter);
    }
    return nodesToFilter;
  }, [rawFileTree, persistentState.filterName, persistentState.filterSelectedExtension, persistentState.filterMinDate, persistentState.filterMaxDate, persistentState.showOnlySelected, persistentState.hideEmptyFolders, selectedPathsSet]);

  const fileCountInDisplayTree = useMemo(() => {
    let count = 0;
    const countFiles = (nodes: TreeNodeData[]) => { nodes.forEach(node => { if (node.type === 'file') count++; if (node.children) countFiles(node.children); }); };
    countFiles(displayFileTree);
    return count;
  }, [displayFileTree]);
  
  const handleModalDeferAll = () => { setUserDeferredAutoPopup(true); itdeTarget.closeModal(); };
  const handleModalIgnoreAll = () => { setUserDeferredAutoPopup(false); itdeTarget.ignoreAllSignals(); };
  const handleModalAccept = (sourceDirective: string) => { itdeTarget.acceptSignal(sourceDirective); };
  const handleModalIgnore = (sourceDirective: string) => { itdeTarget.ignoreSignal(sourceDirective); if (itdeTarget.pendingSignals.filter(s => s.sourceDirective !== sourceDirective).length === 0) setUserDeferredAutoPopup(false); };

  if (isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-gray-500 animate-pulse">Loading ZIP File Explorer...</p>;
  }

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Button variant="primary" onClick={() => setIsModalOpen(true)} disabled={isLoading} iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}>Select or Upload ZIP File</Button>
          {(currentZipFile || rawFileTree.length > 0 || error) && (<Button variant="danger" onClick={handleClear} disabled={isLoading} iconLeft={<TrashIcon className="h-5 w-5" />}>Clear Current ZIP</Button>)}
          <div className="ml-auto"><ReceiveItdeDataTrigger hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen} pendingSignalCount={itdeTarget.pendingSignals.length} onReviewIncomingClick={itdeTarget.openModalIfSignalsExist} /></div>
        </div>
        <div className="mt-2 text-sm text-[rgb(var(--color-text-muted))] h-5">
          {isLoadingZipProcessing && currentZipFile && (<span>Processing: <em>{currentZipFile.name}</em>...</span>)}
          {!isLoadingZipProcessing && currentZipFile && rawFileTree.length > 0 && (<span>Loaded: <strong>{currentZipFile.name}</strong>.</span>)}
          {!isLoadingZipProcessing && currentZipFile && rawFileTree.length === 0 && !error && (<span>Loaded <strong>{currentZipFile.name}</strong>, appears empty or contains no standard files/folders.</span>)}
          {!isLoadingZipProcessing && !currentZipFile && !error && persistentState.selectedFileName && (<span className="italic">Previously: {persistentState.selectedFileName} ({persistentState.selectedFileSize ? formatBytesCompact(persistentState.selectedFileSize) : 'size unknown'}). Select new.</span>)}
          {!isLoadingZipProcessing && !currentZipFile && !error && !persistentState.selectedFileName && (<span>Ready for file selection.</span>)}
        </div>
      </div>

      {!isLoading && rawFileTree.length > 0 && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="text-lg font-semibold text-[rgb(var(--color-text-base))] flex items-center"><FunnelIcon className="h-5 w-5 mr-2 text-[rgb(var(--color-text-muted))]" />Filter & View Options</h3>
            <Button variant="neutral-outline" size="sm" onClick={handleClearFilters} disabled={!areFiltersActive || isLoading} iconLeft={<ClearFilterIcon className="h-4 w-4" />} title="Clear all text/type/date filters">Clear Filters</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-start">
            <div><label htmlFor="filterName" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Name/Path contains:</label><input type="text" id="filterName" value={persistentState.filterName} onChange={(e) => setPersistentState((prev) => ({ ...prev, filterName: e.target.value }))} placeholder="e.g., .txt, image" className="w-full px-3 py-2 border border-[rgb(var(--color-input-border))] rounded-md shadow-sm bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] focus:border-[rgb(var(--color-input-focus-border))] focus:ring-1 focus:ring-[rgb(var(--color-input-focus-border))] text-sm" disabled={isLoading || rawFileTree.length === 0} /></div>
            <div><Select label="File Type:" id="filterExtension" options={[{ value: '', label: `All Types (${uniqueExtensionsInZip.reduce((sum, ext) => sum + ext.count, 0)})` }, ...uniqueExtensionsInZip]} value={persistentState.filterSelectedExtension} onChange={(e) => setPersistentState((prev) => ({ ...prev, filterSelectedExtension: e.target.value }))} disabled={isLoading || uniqueExtensionsInZip.length === 0} selectClassName="text-sm py-2" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-start pt-3 border-t border-[rgb(var(--color-border-base))]">
            <div className="space-y-1"><label className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">View Toggles:</label><div className="flex flex-wrap items-center gap-2">
                <Button onClick={toggleShowOnlySelected} variant={persistentState.showOnlySelected ? 'accent-outline' : 'neutral-outline'} size="sm" disabled={isLoading || rawFileTree.length === 0 || selectedPathsSet.size === 0} title={persistentState.showOnlySelected ? 'Show all items' : 'Show only selected'}>{persistentState.showOnlySelected ? `Selected (${selectedPathsSet.size})` : 'Show Selected'}</Button>
                <Button onClick={toggleHideEmptyFolders} variant={persistentState.hideEmptyFolders ? 'accent-outline' : 'neutral-outline'} size="sm" disabled={isLoading || rawFileTree.length === 0} title={persistentState.hideEmptyFolders ? 'Show empty folders' : 'Hide empty folders'}>{persistentState.hideEmptyFolders ? 'Hiding Empty' : 'Hide Empty'}</Button>
                <Button variant="neutral-outline" size="sm" disabled title="Date Filter (Coming Soon)">🗓️ Dates</Button>
            </div></div>
            <div> {/* Placeholder */} </div>
          </div>
          <p className="text-xs text-right text-gray-500 mt-1 pr-1">Displaying {fileCountInDisplayTree} files / {displayFileTree.length} total entries based on current filters.</p>
        </div>
      )}

      {isLoadingZipProcessing && (<p className="text-center text-[rgb(var(--color-text-link))] p-4 animate-pulse">Processing zip file...</p>)}
      {isLoadingToolState && !isLoadingZipProcessing && (<p className="text-center text-[rgb(var(--color-text-link))] p-4 animate-pulse">Loading saved state...</p>)}
      {error && (<div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-center gap-2"><XCircleIcon className="h-5 w-5 flex-shrink-0 text-red-500" aria-hidden="true" /><strong className="font-semibold">Error:</strong> {error}</div>)}

      {!isLoading && rawFileTree.length > 0 && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md">
          <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
            <h2 className="text-lg font-semibold text-[rgb(var(--color-text-base))]">Contents of “{currentZipFile?.name || persistentState.selectedFileName || 'Archive'}”:</h2>
            <div className="flex gap-2 items-center">
              {selectedPathsSet.size > 0 && (<Button variant="secondary-outline" size="sm" onClick={handleDownloadSelected} disabled iconLeft={<DownloadIcon className="h-4 w-4" />} title="Download selected (Not Implemented)">Download Sel ({selectedPathsSet.size})</Button>)}
              {selectedPathsSet.size > 0 && (
                <SendToToolButton
                  currentToolDirective={directiveName}
                  currentToolOutputConfig={ownMetadata.outputConfig as OutputConfig}
                  selectedOutputItems={placeholderSelectedItemsForDiscovery}
                  buttonText={`Send Selected (${selectedPathsSet.size})`}
                  className={isLoading || isLoadingZipProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                />
              )}
            </div>
          </div>
          <div className="font-mono text-sm space-y-0.5 max-h-[60vh] overflow-auto border border-[rgb(var(--color-border-base))] rounded p-2 bg-[rgb(var(--color-bg-component))]">
            {displayFileTree.map((node) => (<TreeNode key={node.id} node={node} level={0} expandedFolders={expandedFoldersSet} selectedPaths={selectedPathsSet} isPathIndeterminate={isPathIndeterminate} onToggle={toggleFolder} onToggleSelection={handleToggleSelection} onDownload={handleDownload} onPreview={handlePreview} />))}
            {displayFileTree.length === 0 && rawFileTree.length > 0 && (<p className="text-center text-gray-500 italic py-4">No items match current filters.</p>)}
          </div>
        </div>
      )}
      {!isLoading && !error && (currentZipFile || persistentState.selectedFileId) && rawFileTree.length === 0 && displayFileTree.length === 0 && (<p className="p-4 text-[rgb(var(--color-text-muted))] italic">No files or folders to display. The ZIP might be empty or an error occurred.</p>)}

      <FileSelectionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onFilesSelected={handleFilesSelectedFromModal} mode="selectExistingOrUploadNew" accept=".zip,application/zip,application/x-zip-compressed" selectionMode="single" libraryFilter={{ type: 'application/zip' }} initialTab="upload" />
      {isPreviewOpen && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={closePreview} aria-modal="true" role="dialog" aria-labelledby="preview-modal-title"><div className="bg-[rgb(var(--color-bg-component))] rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col text-[rgb(var(--color-text-base))]" onClick={(e) => e.stopPropagation()}><div className="p-3 px-4 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center bg-[rgb(var(--color-bg-subtle))] rounded-t-lg"><h3 id="preview-modal-title" className="text-lg font-semibold truncate" title={previewFilename || ''}>{previewFilename || 'Preview'}</h3><Button variant="link" onClick={closePreview} title="Close Preview" className="text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-base))] !p-1"><XCircleIcon className="h-6 w-6" /></Button></div><div className="p-4 overflow-auto flex-grow min-h-[200px]">{previewType === 'loading' && (<p className="text-center text-[rgb(var(--color-text-muted))] animate-pulse">Loading preview...</p>)}{previewError && (<div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-center gap-2"><XCircleIcon className="h-5 w-5 flex-shrink-0 text-red-500" aria-hidden="true" /><strong className="font-semibold">Error:</strong> {previewError}</div>)}{!previewError && previewType === 'text' && (<pre className="text-sm whitespace-pre-wrap break-words max-h-[75vh] overflow-auto"><code>{previewContent}</code></pre>)}{!previewError && previewType === 'image' && previewContent && (<div className="flex justify-center items-center h-full"><Image src={previewContent} alt={previewFilename || 'Image preview'} width={800} height={600} className="max-w-full max-h-[75vh] object-contain" onError={() => setPreviewError('Failed to load image resource.')} unoptimized={true} /></div>)}{!previewError && previewType === 'unsupported' && (<p className="text-center text-[rgb(var(--color-text-muted))]">Preview not available for this file type.</p>)}</div></div></div>)}
      <IncomingDataModal isOpen={itdeTarget.isModalOpen} signals={itdeTarget.pendingSignals} onAccept={handleModalAccept} onIgnore={handleModalIgnore} onDeferAll={handleModalDeferAll} onIgnoreAll={handleModalIgnoreAll} />
    </div>
  );
}