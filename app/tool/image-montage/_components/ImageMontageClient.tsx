// --- FILE: app/tool/image-montage/_components/ImageMontageClient.tsx ---
'use client';

import React, { useState, useCallback } from 'react';
import { useHistory } from '../../../context/HistoryContext'; // Use updated hook
import { useImageLibrary } from '@/app/context/ImageLibraryContext'; // Use updated hook
import { useMontageState } from '../_hooks/useMontageState';
import { useMontageCanvas } from '../_hooks/useMontageCanvas';
import ImageAdjustmentCard from './ImageAdjustmentCard';
import MontageControls from './MontageControls';

interface ImageMontageClientProps {
    toolTitle: string;
    toolRoute: string;
}

export default function ImageMontageClient({ toolTitle, toolRoute }: ImageMontageClientProps) {
    const {
        montageImages,
        addImagesFromFiles,
        clearMontage,
        handleTiltChange,
        handleOverlapChange,
        handleMoveImageLeft,
        handleMoveImageRight,
        isLoading: isProcessingFiles,
        error: fileProcessingError,
        setError: setFileProcessingError
    } = useMontageState(toolTitle, toolRoute); // Uses updated hook

    const { canvasRef, generateMontageBlob } = useMontageCanvas(montageImages);

    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const { addHistoryEntry } = useHistory(); // Use updated hook
    const { addImage } = useImageLibrary(); // Use updated hook

    const isLoading = isProcessingFiles || isActionLoading;
    const error = actionError || fileProcessingError;

    const clearError = useCallback(() => {
        setActionError(null);
        setFileProcessingError(null);
    }, [setFileProcessingError]);

    // handleSaveToLibrary: Added eventTimestamp
    const handleSaveToLibrary = useCallback(async () => {
        setIsActionLoading(true); clearError(); setIsSaved(false);

        const blob = await generateMontageBlob();
        let historyOutput: Record<string, unknown> = {};
        let status: 'success' | 'error' = 'success';
        let newImageId: string | undefined;

        if (blob) {
             const outputFileName = `oet-montage-save-${Date.now()}.png`;
             try {
                 newImageId = await addImage(blob, outputFileName, 'image/png');
                 historyOutput = { message: `Saved montage (${montageImages.length} images) to library.`, imageId: newImageId };
                 setIsSaved(true);
                 setTimeout(() => setIsSaved(false), 2000);
             } catch (saveErr) {
                  status = 'error';
                  const message = saveErr instanceof Error ? saveErr.message : "Failed to save to library";
                  setActionError(message);
                  historyOutput = { message: `Save failed: ${message}` };
             }
        } else {
            status = 'error';
            const message = "Failed to generate montage blob for saving.";
            setActionError(message);
            historyOutput = { message: message };
        }

        setIsActionLoading(false);
        // Add eventTimestamp here
        addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            trigger: 'click',
            input: { action: 'save', imageCount: montageImages.length },
            output: historyOutput,
            status: status,
            eventTimestamp: Date.now() // Add timestamp
        });
    }, [generateMontageBlob, addImage, montageImages.length, addHistoryEntry, toolTitle, toolRoute, clearError]);

    // handleDownload: Added eventTimestamp
    const handleDownload = useCallback(async () => {
        setIsActionLoading(true); clearError();

        const blob = await generateMontageBlob();
        let historyOutput: Record<string, unknown> = {};
        let status: 'success' | 'error' = 'success';
        let newImageId: string | undefined;
        let saveErrorMsg: string | undefined;

        if (blob) {
            const outputFileName = `oet-montage-download-${Date.now()}.png`;
             try {
                 newImageId = await addImage(blob, outputFileName, 'image/png');
             } catch (saveErr) {
                 saveErrorMsg = saveErr instanceof Error ? saveErr.message : String(saveErr);
                 console.error("[MontageDownload] Failed to save montage to library:", saveErrorMsg);
             }

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = outputFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

             if (newImageId) { historyOutput = { message: `Downloaded and saved montage (${montageImages.length} images).`, imageId: newImageId }; }
             else { historyOutput = { message: `Downloaded montage (${montageImages.length} images). Save to library failed.`, error: saveErrorMsg }; }
        } else {
            status = 'error';
            const message = "Failed to generate montage blob for download.";
            setActionError(message);
            historyOutput = { message: message };
        }

        setIsActionLoading(false);
        // Add eventTimestamp here
        addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            trigger: 'click',
            input: { action: 'download', imageCount: montageImages.length },
            output: historyOutput,
            status: status,
            eventTimestamp: Date.now() // Add timestamp
        });
    }, [generateMontageBlob, addImage, montageImages.length, addHistoryEntry, toolTitle, toolRoute, clearError]);

    // handleCopyToClipboard: Added eventTimestamp
    const handleCopyToClipboard = useCallback(async () => {
        if (!navigator.clipboard?.write) {
             setActionError("Clipboard API (write) not available or not permitted.");
             // Add eventTimestamp here
             addHistoryEntry({
                 toolName: toolTitle, toolRoute: toolRoute, trigger: 'click',
                 input: { action: 'copy', imageCount: montageImages.length },
                 output: { message: "Copy failed: Clipboard API not available." }, status: 'error',
                 eventTimestamp: Date.now() // Add timestamp
             });
             return;
         }

        setIsActionLoading(true); clearError(); setIsCopied(false);

        const blob = await generateMontageBlob();
        let historyOutput: Record<string, unknown> = {};
        let status: 'success' | 'error' = 'success';
        let newImageId: string | undefined;
        let saveErrorMsg: string | undefined;

        if (blob) {
            const outputFileName = `oet-montage-copy-${Date.now()}.png`;
             try { newImageId = await addImage(blob, outputFileName, 'image/png'); }
             catch (saveErr) { saveErrorMsg = saveErr instanceof Error ? saveErr.message : String(saveErr); console.error("[MontageCopy] Failed to save montage to library:", saveErrorMsg); }

            try {
                const clipboardItem = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([clipboardItem]);
                setIsCopied(true); setTimeout(() => setIsCopied(false), 2000);
                 if (newImageId) { historyOutput = { message: `Copied and saved montage (${montageImages.length} images).`, imageId: newImageId }; }
                 else { historyOutput = { message: `Copied montage (${montageImages.length} images). Save to library failed.`, error: saveErrorMsg }; }
            } catch (clipboardError) {
                status = 'error'; const message = clipboardError instanceof Error ? clipboardError.message : 'Unknown clipboard write error';
                console.error('Failed to write image to clipboard:', clipboardError); setActionError(`Copy failed: ${message}`);
                historyOutput = { message: `Copy failed: ${message}`, underlyingSaveError: saveErrorMsg };
            }
        } else {
            status = 'error'; const message = "Failed to generate montage blob for copy.";
            setActionError(message); historyOutput = { message: message };
        }

        setIsActionLoading(false);
        // Add eventTimestamp here
        addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            trigger: 'click',
            input: { action: 'copy', imageCount: montageImages.length },
            output: historyOutput,
            status: status,
            eventTimestamp: Date.now() // Add timestamp
        });
    }, [generateMontageBlob, addImage, montageImages.length, addHistoryEntry, toolTitle, toolRoute, clearError]);

    // handleAdjustment remains the same
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAdjustment = useCallback( (action: (...args: any[]) => void) => (...args: any[]) => { setIsSaved(false); setIsCopied(false); action(...args); }, []);

    // JSX Render logic remains the same
    return (
        <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
            <MontageControls isLoading={isLoading} isProcessingFiles={isProcessingFiles} isSaved={isSaved} isCopied={isCopied} imageCount={montageImages.length} onFileChange={addImagesFromFiles} onClear={() => { clearMontage(); setIsSaved(false); setIsCopied(false); }} onSave={handleSaveToLibrary} onDownload={handleDownload} onCopy={handleCopyToClipboard} />
             {error && ( <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"> <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg> <div><strong className="font-semibold">Error:</strong> {error}</div> </div> )}
            {montageImages.length > 0 && (
                <div className="flex-shrink-0 pb-4 border-b border-[rgb(var(--color-border-base))]">
                    <h2 className="text-base font-semibold mb-2 text-[rgb(var(--color-text-muted))]">Adjust & Reorder Images ({montageImages.length})</h2>
                    <div className="flex space-x-4 overflow-x-auto py-2 px-1">
                        {montageImages.map((img, index) => ( <ImageAdjustmentCard key={img.id} image={img} index={index} isFirst={index === 0} isLast={index === montageImages.length - 1} isLoading={isLoading} onTiltChange={handleAdjustment(handleTiltChange)} onOverlapChange={handleAdjustment(handleOverlapChange)} onMoveLeft={handleAdjustment(handleMoveImageLeft)} onMoveRight={handleAdjustment(handleMoveImageRight)} /> ))}
                    </div>
                </div>
            )}
            <div className="flex-grow overflow-auto border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] p-2 min-h-[300px] flex items-start justify-start relative">
                <canvas ref={canvasRef} className="block max-w-full max-h-full"> Your browser does not support the canvas element. </canvas>
                {montageImages.length === 0 && !isLoading && ( <div className="absolute inset-0 flex items-center justify-center text-[rgb(var(--color-text-muted))] text-center p-4 pointer-events-none text-sm italic"> Add images to create your montage. </div> )}
            </div>
        </div>
    );
}