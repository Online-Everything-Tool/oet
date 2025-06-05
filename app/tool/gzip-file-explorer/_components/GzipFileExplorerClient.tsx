// FILE: app/tool/gzip-file-explorer/_components/GzipFileExplorerClient.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import useGzipDecompress from '../_hooks/useGzipDecompress'; // Removed unused GzipHeaderInfo import
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import Button from '../../_components/form/Button';
import Textarea from '../../_components/form/Textarea';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import type { StoredFile } from '@/src/types/storage';
import {
  formatBytes,
  getMimeTypeForFile,
  isTextBasedMimeType,
  bufferToHex,
} from '@/app/lib/utils';
import {
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  PhotoIcon,
  CpuChipIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import Image from 'next/image';

import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import toolSpecificMetadata from '../metadata.json';
import type { ToolMetadata as AppToolMetadata } from '@/src/types/tools';

const ownMetadata = toolSpecificMetadata as AppToolMetadata;
const MAX_TEXT_PREVIEW_SIZE_BYTES = 1024 * 100; // 100KB
const MAX_HEX_PREVIEW_BYTES = 512; // Show first 512 bytes for hex

interface GzipExplorerToolState {
  inputFileId: string | null;
  inputFileName: string | null;
  inputFileSize: number | null;
  processedInputFileIdForDecompressedOutput: string | null; // ID of the .gz file that resulted in current decompressedFileId

  originalFileNameFromHeader: string | null;
  modificationTimeFromHeader: number | null;
  commentFromHeader: string | null;

  decompressedFileId: string | null;
  decompressedFileType: string | null;
  decompressedFileSize: number | null;
}

const DEFAULT_TOOL_STATE: GzipExplorerToolState = {
  inputFileId: null,
  inputFileName: null,
  inputFileSize: null,
  processedInputFileIdForDecompressedOutput: null,
  originalFileNameFromHeader: null,
  modificationTimeFromHeader: null,
  commentFromHeader: null,
  decompressedFileId: null,
  decompressedFileType: null,
  decompressedFileSize: null,
};

interface GzipFileExplorerClientProps {
  toolRoute: string;
}

export default function GzipFileExplorerClient({ toolRoute }: GzipFileExplorerClientProps) {
  const { getFile, addFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  // ... (rest of the code)

  // Load preview content when decompressedFileId is set
  useEffect(() => {
    let objectUrlToRevoke: string | null = null;

    if (toolState.decompressedFileId && toolState.decompressedFileType) {
      // ...

      getFile(toolState.decompressedFileId)
        .then(async (file) => {
          if (file && file.blob) {
            if (isTextBasedMimeType(toolState.decompressedFileType)) {
              // ...
            } else if (toolState.decompressedFileType.startsWith('image/')) {
              // ...
            } else {
              // Hex preview for other binary types
              const buffer = await file.blob.arrayBuffer();
              const firstBytes = new Uint8Array(buffer, 0, MAX_HEX_PREVIEW_BYTES); // Fixed Uint8Array constructor
              setHexPreview(bufferToHex(firstBytes));
            }
          }
        })
        // ...
    } else {
      // ...
    }
    return () => {
      // ...
    };
  }, [toolState.decompressedFileId, toolState.decompressedFileType, getFile]);


  // ... (rest of the code)

        } catch (err: any) { // Added type annotation to catch clause
          console.error("Error processing decompressed data:", err);
          setClientError(`Error saving decompressed file: ${err.message}`);
        } finally {
          setIsLoadingPreview(false);
        }
      };
      processDecompressedOutput();
    }
  }, [decompressedData, headerInfo, currentInputFile, toolState.decompressedFileId, addFile, setToolState, toolRoute]);

  // ... rest of the code
}
