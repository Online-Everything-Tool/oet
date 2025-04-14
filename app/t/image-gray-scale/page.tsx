import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import ImageGrayScaleClient from './_components/ImageGrayScaleClient';

export default function ImageGrayScalePage() {
  const toolTitle = metadata.title || "Image GrayScale";
  const toolRoute = "/t/image-gray-scale";

  return (
    <div className="flex flex-col gap-6">
      <ToolHeader
        title={toolTitle}
        description={metadata.description || ""}
      />
      <ToolSuspenseWrapper>
        <ImageGrayScaleClient
            toolTitle={toolTitle}
            toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}