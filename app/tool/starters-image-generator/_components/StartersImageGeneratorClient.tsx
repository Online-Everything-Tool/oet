'use client';

import React, { useState, useCallback } from 'react';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '@/app/tool/_hooks/useToolState';
import Button from '@/app/tool/_components/form/Button';
import importedMetadata from '../metadata.json';
import type { ToolMetadata } from '@/src/types/tools';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';


interface StartersImageGeneratorState {
  generatedImage: string | null;
}

const DEFAULT_STATE: StartersImageGeneratorState = {
  generatedImage: null,
};

const metadata = importedMetadata as ToolMetadata;

const StartersImageGeneratorClient: React.FC = () => {
  const { state, setState, isLoadingState } = useToolState('starters-image-generator', DEFAULT_STATE);
  const [isGenerating, setIsGenerating] = useState(false);
  const { addFile } = useFileLibrary();
  const directiveName = metadata.directive;


  const generateImage = useCallback(async () => {
    setIsGenerating(true);
    try {
      // Replace this with actual image generation logic
      const newImage = await new Promise<string>((resolve) => {
        setTimeout(() => {
          resolve('/placeholder.png'); // Replace with actual image URL or data URL
        }, 1000);
      });

      const blob = await fetch(newImage).then((res) => res.blob());
      const fileId = await addFile(blob, 'starter-image.png', 'image/png', false);

      setState({ generatedImage: fileId });
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [addFile, setState]);

  const handleClear = useCallback(() => {
    setState(DEFAULT_STATE);
  }, [setState]);

  const canPerformActions = !!state.generatedImage && !isGenerating;

  if (isLoadingState) {
    return <p>Loading...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="primary"
        onClick={generateImage}
        isLoading={isGenerating}
        disabled={isGenerating}
        iconLeft={isGenerating ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : undefined}
      >
        Generate Starter Image
      </Button>

      {state.generatedImage && (
        <div>
          <Image
            src={`/api/file?id=${state.generatedImage}`}
            alt="Generated starter image"
            width={200}
            height={200}
          />
          <OutputActionButtons
            canPerform={canPerformActions}
            isSaveSuccess={false}
            isDownloadSuccess={false}
            onInitiateSave={() => {}}
            onInitiateDownload={() => {}}
            onClear={handleClear}
            directiveName={directiveName}
            outputConfig={metadata.outputConfig}
          />
        </div>
      )}
    </div>
  );
};

export default StartersImageGeneratorClient;
