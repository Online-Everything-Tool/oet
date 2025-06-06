// app/build/tool/_components/BuildToolInfoCarousel.tsx
'use client';

import React, { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, A11y } from 'swiper/modules';
import type { Swiper as SwiperCore } from 'swiper/types';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

interface BuildToolInfoCarouselProps {
  onSwiperReady: (swiper: SwiperCore) => void;
  initialSlide?: number;
  formatSlug: (value: string) => string;
  toolDirective: string;
}

const Slide1Content = ({
  formatSlug,
  toolDirective,
}: {
  formatSlug: (v: string) => string;
  toolDirective: string;
}) => (
  <div className="p-4 space-y-3">
    <p className="text-[rgb(var(--color-text-subtle))] mb-2">
      Your tool&apos;s name (&ldquo;directive&rdquo;) is key! It defines its URL
      and purpose.
    </p>
    <ul className="list-disc list-outside pl-5 space-y-3 text-[rgb(var(--color-text-subtle))]">
      <li>
        <strong>Format:</strong> Must be <code>lowercase-kebab-case</code>{' '}
        (e.g., <code>text-reverse</code>).
      </li>
      <li>
        <strong>Structure:</strong> Clear names like{' '}
        <code>thing-operation</code> (<code>json-formatter</code>),{' '}
        <code>thing-operation-operation</code> (<code>image-resize-rotate</code>
        ), or <code>thing-thing-operation</code> (
        <code>png-jpeg-converter</code>).
      </li>
      <li>
        <strong>No Small Words:</strong> Minimize &lsquo;to&rsquo;,
        &lsquo;for&rsquo;{' '}
        <code>
          <s>png-to-jpeg-converter</s>
        </code>
        .
      </li>
      <li>
        <strong>URL:</strong>{' '}
        <code>/tool/{formatSlug(toolDirective) || 'your-chosen-name'}</code>
      </li>
    </ul>
  </div>
);

const Slide2Content = ({
  formatSlug,
  toolDirective,
}: {
  formatSlug: (v: string) => string;
  toolDirective: string;
}) => (
  <div className="p-4 space-y-3">
    <p className="text-[rgb(var(--color-text-subtle))] my-3">
      AI guided tool creation.{' '}
      <strong>It takes several minutes (3-5+ min).</strong>
    </p>
    <ol className="list-decimal list-outside pl-5 space-y-3 text-[rgb(var(--color-text-subtle))]">
      <li>
        <strong>Validate Description:</strong> Verify AI&apos;s suggested
        description suits your purposes.
      </li>
      <li>
        <strong>Add Training Examples:</strong> Help AI best craft{' '}
        <code>/tool/{formatSlug(toolDirective) || 'your-chosen-name'}</code>
      </li>
      <li>
        <strong>Additional Description:</strong> Looking for a particular
        feature? Let AI know!
      </li>
    </ol>
  </div>
);

const Slide3Content = ({
  formatSlug,
  toolDirective,
}: {
  formatSlug: (v: string) => string;
  toolDirective: string;
}) => (
  <div className="p-4 space-y-3">
    <p className="my-3 text-[rgb(var(--color-text-subtle))]">
      Your <code>/tool/{formatSlug(toolDirective) || 'your-chosen-name'}</code>{' '}
      code is ready. Now what?!
    </p>
    <ul className="list-disc list-outside pl-5 space-y-3 text-[rgb(var(--color-text-subtle))]">
      <li>
        <strong>Submit Pull Request (PR):</strong> Anonymously set the tool
        creation wheels into motion.
      </li>
      <li>
        <strong>Track Automation:</strong> The PR triggers builds & quality
        checks. Follow along as your tool is assembled.
      </li>
      <li>
        <strong>Preview URL:</strong> If successful, a{' '}
        <strong>live Deploy Preview URL</strong> is generated.
      </li>
      <li>
        <strong>Test Instantly:</strong> Use this URL to test your new tool
        immediately! Progress can be monitored here.
      </li>
    </ul>
  </div>
);

const h2: string[] = [
  'Step 1. Naming Your Tool (Directive)',
  'Step 2. The AI Build Process',
  'Step 3. From PR to Live Preview',
];

export default function BuildToolInfoCarousel({
  onSwiperReady,
  initialSlide = 0,
  formatSlug,
  toolDirective,
}: BuildToolInfoCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(initialSlide);

  const handleSlideChange = (swiper: { activeIndex: number }) => {
    console.log('Slide changed to:', swiper.activeIndex);
    setActiveIndex(swiper.activeIndex);
  };

  return (
    <div className="mb-6 border border-[rgb(var(--color-border-soft))] rounded-lg bg-[rgb(var(--color-bg-subtle))] shadow">
      <div className="p-3 bg-[rgb(var(--color-bg-subtle-hover))] rounded-t-lg border-b border-[rgb(var(--color-border-soft))] flex items-end">
        <InformationCircleIcon className="h-7 w-7 mr-2 text-[rgb(var(--color-text-link))]" />
        <h2 className="font-semibold text-[rgb(var(--color-text-emphasis))]">
          {h2[activeIndex]}
        </h2>
      </div>
      <Swiper
        modules={[Navigation, Pagination, A11y]}
        onSlideChange={handleSlideChange}
        spaceBetween={0}
        slidesPerView={1}
        navigation={false}
        pagination={{ clickable: true }}
        onSwiper={onSwiperReady}
        initialSlide={initialSlide}
        className="h-auto oet-swiper-build-tool"
        style={
          {
            '--swiper-navigation-size': '30px',
          } as React.CSSProperties & Record<string, string>
        }
      >
        <SwiperSlide>
          <Slide1Content
            formatSlug={formatSlug}
            toolDirective={toolDirective}
          />
        </SwiperSlide>
        <SwiperSlide>
          <Slide2Content
            formatSlug={formatSlug}
            toolDirective={toolDirective}
          />
        </SwiperSlide>
        <SwiperSlide>
          <Slide3Content
            formatSlug={formatSlug}
            toolDirective={toolDirective}
          />
        </SwiperSlide>
      </Swiper>
    </div>
  );
}
