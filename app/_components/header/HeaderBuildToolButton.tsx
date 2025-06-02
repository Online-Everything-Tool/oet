// FILE: app/_components/header/HeaderBuildToolButton.tsx
'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { WrenchScrewdriverIcon } from '@heroicons/react/24/solid';
import Button from '@/app/tool/_components/form/Button';

export default function HeaderBuildToolButton() {
  const router = useRouter();
  const pathname = usePathname();
  const isBuildPage = pathname.startsWith('/build/tool');

  const goToBuildTool = () => {
    if (!isBuildPage) {
      router.push('/build/tool');
    }
  };

  return (
    <Button
      onClick={goToBuildTool}
      disabled={isBuildPage}
      className="rounded bg-[rgba(255,255,255,0.2)] hover:!bg-[rgba(255,255,255,0.4)] text-white disabled:opacity-70 px-2.5 py-1.5"
      aria-label="Build a New Tool"
      title={
        isBuildPage ? 'Currently on AI Tool Builder page' : 'AI Tool Builder'
      }
      iconLeft={<WrenchScrewdriverIcon className="h-5 w-5" />}
    >
      <span className="hidden sm:inline ml-1">Build</span>
    </Button>
  );
}
