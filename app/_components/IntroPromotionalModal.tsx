// FILE: app/_components/IntroPromotionalModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Button from '@/app/tool/_components/form/Button';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import {
  SparklesIcon,
  MagnifyingGlassIcon,
  LockClosedIcon,
  CurrencyDollarIcon,
  MegaphoneIcon,
  KeyIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-fade';
import 'swiper/css/navigation';

interface IntroPromotionalModalProps {
  isOpen: boolean;
  isDismissedForever: boolean;
  onDismiss: (shouldDismissForever: boolean) => void;
}

const storyChapters = [
  {
    icon: SparklesIcon,
    title: 'The Golden Age',
    text: 'In the beginning, the internet was full of simple, free tools. "Big Tool" gave us everything we wanted, and it was good.',
  },
  {
    icon: MagnifyingGlassIcon,
    title: 'The SEO Creep',
    text: 'Then, "Big Tool" got greedy. They bought up all the good domain names and plastered their brand everywhere, making it hard to find anyone else.',
  },
  {
    icon: LockClosedIcon,
    title: 'The All-Seeing Eye',
    text: 'To "improve our experience," they started tracking every click, every keystroke. Our data was no longer our own.',
  },
  {
    icon: CurrencyDollarIcon,
    title: 'The Highest Bidder',
    text: "Soon, that data was packaged and sold. We weren't the customer anymore; we were the product being sold to advertisers.",
  },
  {
    icon: MegaphoneIcon,
    title: 'The Ad-pocalypse',
    text: 'Our screens filled with ads. Pop-ups, banners, and auto-playing videos became the price of "free" tools.',
  },
  {
    icon: KeyIcon,
    title: 'The Gated Kingdom',
    text: 'Finally, the best features were locked behind paywalls. The simple, free web felt like a distant memory.',
  },
  {
    icon: RocketLaunchIcon,
    title: 'The OET Mission',
    text: "This tool is different. It's free, private, and runs in your browser. No tracking, no ads, no nonsense. This is for you.",
  },
];

export default function IntroPromotionalModal({
  isOpen,
  isDismissedForever,
  onDismiss,
}: IntroPromotionalModalProps) {
  const [localDontShowAgain, setLocalDontShowAgain] =
    useState(isDismissedForever);

  useEffect(() => {
    if (isOpen) {
      setLocalDontShowAgain(isDismissedForever);
    }
  }, [isOpen, isDismissedForever]);

  if (!isOpen) {
    return null;
  }

  const handleDismiss = () => {
    onDismiss(localDontShowAgain);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4 animate-slide-down"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-modal-title"
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-200">
          <h2
            id="intro-modal-title"
            className="text-xl font-bold text-center text-gray-800"
          >
            A Quick Story...
          </h2>
        </div>

        <div className="p-2 m-2 oet-swiper-build-tool">
          <Swiper
            modules={[Autoplay, EffectFade, Navigation]}
            effect="fade"
            fadeEffect={{ crossFade: true }}
            navigation={true}
            autoplay={{ delay: 5000, disableOnInteraction: true }}
            loop={false}
            className="w-full"
          >
            {storyChapters.map((chapter, index) => (
              <SwiperSlide key={index} className="!bg-transparent">
                {/* MODIFICATION: Changed flex-col to flex-col justify-start and added a wrapper for the header */}
                <div className="flex flex-col justify-start text-left px-8 pb-2 h-full">
                  {/* MODIFICATION: New wrapper for icon and title */}
                  <div className="flex flex-row items-center gap-4 mb-4">
                    <chapter.icon className="h-12 w-12 text-indigo-500 flex-shrink-0" />
                    <h3 className="text-lg font-semibold text-gray-800">
                      {chapter.title}
                    </h3>
                  </div>
                  <p className="text-gray-600 text-base">{chapter.text}</p>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <Checkbox
            id="dismiss-forever-checkbox"
            className=""
            label="Don't show this again"
            checked={localDontShowAgain}
            onChange={(e) => setLocalDontShowAgain(e.target.checked)}
          />
          <Button
            variant="primary"
            onClick={handleDismiss}
            className="w-full sm:w-auto"
          >
            Got It, Let's Go!
          </Button>
        </div>
      </div>
    </div>
  );
}
