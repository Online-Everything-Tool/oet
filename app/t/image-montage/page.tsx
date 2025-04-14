// FILE: app/t/image-montage/page.tsx
import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import ImageMontageClient from './_components/ImageMontageClient';

export default function ImageMontagePage() {
  const toolTitle = metadata.title || "Image Montage";
  const toolRoute = "/t/image-montage";

  return (
    <div className="flex flex-col gap-6">
      <ToolHeader
        title={toolTitle}
        description={metadata.description || ""}
      />
      <ToolSuspenseWrapper>
        <ImageMontageClient
            toolTitle={toolTitle}
            toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}