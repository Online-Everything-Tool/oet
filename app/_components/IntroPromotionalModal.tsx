// FILE: app/_components/IntroPromotionalModal.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Swiper as SwiperClass } from 'swiper';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade, Navigation } from 'swiper/modules';
import { motion, AnimatePresence } from 'framer-motion';

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
  ArrowLeftIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

import 'swiper/css';
import 'swiper/css/effect-fade';

interface IntroPromotionalModalProps {
  isOpen: boolean;
  isDismissedForever: boolean;
  onDismiss: (shouldDismissForever: boolean) => void;
}

// MODIFICATION: Re-integrated SEO story and adjusted all for consistent length
const storyChapters = [
  {
    icon: SparklesIcon,
    title: 'The Golden Age',
    text: 'In the beginning, the web was full of simple, clever tools. They did one thing, they did it well, and they asked for nothing in return. It was a glorious era.',
  },
  {
    icon: MagnifyingGlassIcon,
    title: 'The SEO Creep',
    text: 'Then, "Big Tool" got greedy. They bought all the good domain names for SEO, plastered their brand everywhere, and made it impossible to find anyone else.',
  },
  {
    icon: LockClosedIcon,
    title: 'The Login Gate',
    text: 'To "personalize your experience," a login became mandatory. Suddenly, our favorite simple tools were locked behind a gate that watched our every move.',
  },
  {
    icon: CurrencyDollarIcon,
    title: 'The Product',
    text: "That data was bundled, sliced, and sold to the highest bidder. We weren't the customers anymore; we were the product being traded in the open market.",
  },
  {
    icon: MegaphoneIcon,
    title: 'The Ad-pocalypse',
    text: 'Then came the ads. Banners, pop-ups, and trackers infested every corner. The "free" tools now came at the cost of our sanity and our precious privacy.',
  },
  {
    icon: KeyIcon,
    title: 'The Paywall',
    text: 'Finally, the most useful features were hidden behind a subscription. The tools were no longer ours. They belonged to Big Tool, and they made sure we knew it.',
  },
  {
    icon: RocketLaunchIcon,
    title: 'The Rebellion',
    text: "This site is different. It's a collection of simple, powerful tools that run in your browser. No logins, no ads, no trackers. Go build something cool. Or useless.",
  },
];

const headerVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      type: 'spring',
      stiffness: 260,
      damping: 20,
    },
  }),
  exit: { opacity: 0, y: 10, transition: { duration: 0.2 } },
};

const textVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.3,
      duration: 0.4,
      ease: 'easeOut',
    },
  },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2, ease: 'easeIn' } },
};

export default function IntroPromotionalModal({
  isOpen,
  isDismissedForever,
  onDismiss,
}: IntroPromotionalModalProps) {
  const [localDontShowAgain, setLocalDontShowAgain] =
    useState(isDismissedForever);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const swiperRef = useRef<SwiperClass | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalDontShowAgain(isDismissedForever);
      setActiveSlideIndex(0);
      swiperRef.current?.slideTo(0, 0);
    }
  }, [isOpen, isDismissedForever]);

  if (!isOpen) {
    return null;
  }

  const handleDismiss = () => {
    onDismiss(localDontShowAgain);
  };

  const CurrentChapterIcon = storyChapters[activeSlideIndex].icon;

  const handleNext = () => swiperRef.current?.slideNext();
  const handlePrev = () => swiperRef.current?.slidePrev();

  return (
    <div
      className="fixed inset-0 bg-[rgb(var(--color-overlay-backdrop))]/70 flex items-center justify-center z-[70] p-4 animate-slide-down"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-modal-title"
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-8 pb-4 flex flex-row items-center justify-center gap-4 text-center border-b border-[rgb(var(--color-border-base))]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSlideIndex}
              className="flex flex-row items-center justify-center gap-4"
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div custom={0} variants={headerVariants}>
                <CurrentChapterIcon className="h-10 w-10 text-[rgb(var(--color-icon-brand))]" />
              </motion.div>
              <motion.h2
                id="intro-modal-title"
                custom={1}
                variants={headerVariants}
                className="text-xl font-bold text-[rgb(var(--color-text-emphasis))]"
              >
                {storyChapters[activeSlideIndex].title}
              </motion.h2>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-4 flex-grow h-48">
          <Swiper
            onSwiper={(swiper) => (swiperRef.current = swiper)}
            modules={[Autoplay, EffectFade, Navigation]}
            effect="fade"
            fadeEffect={{ crossFade: true }}
            navigation={{
              nextEl: '.intro-swiper-next',
              prevEl: '.intro-swiper-prev',
            }}
            // MODIFICATION: Autoplay now stops at the end and has a longer delay
            autoplay={{
              delay: 6000,
              disableOnInteraction: true,
              stopOnLastSlide: true,
            }}
            loop={false}
            className="w-full h-full"
            onSlideChange={(swiper) => setActiveSlideIndex(swiper.activeIndex)}
            allowTouchMove={false}
          >
            {storyChapters.map((chapter) => (
              <SwiperSlide key={chapter.title} className="!bg-transparent">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={chapter.title}
                    variants={textVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex items-center justify-center h-full"
                  >
                    {/* MODIFICATION: Removed `text-center` for left-aligned text */}
                    <p className="text-[rgb(var(--color-text-subtle))] text-base max-w-md">
                      {chapter.text}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        <div className="flex justify-between items-center px-6 py-4">
          <motion.button
            onClick={handlePrev}
            className="p-2 rounded-full hover:bg-[rgb(var(--color-bg-subtle-hover))] disabled:cursor-not-allowed transition-colors"
            aria-label="Previous slide"
            animate={{ opacity: activeSlideIndex === 0 ? 0.3 : 1 }}
            disabled={activeSlideIndex === 0}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.1 }}
          >
            <ArrowLeftIcon className="h-6 w-6 text-[rgb(var(--color-text-muted))]" />
          </motion.button>
          <motion.button
            onClick={handleNext}
            className="p-2 rounded-full hover:bg-[rgb(var(--color-bg-subtle-hover))] disabled:cursor-not-allowed transition-colors"
            aria-label="Next slide"
            animate={{
              opacity:
                activeSlideIndex === storyChapters.length - 1 ? 0.3 : 1,
            }}
            disabled={activeSlideIndex === storyChapters.length - 1}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.1 }}
          >
            <ArrowRightIcon className="h-6 w-6 text-[rgb(var(--color-text-muted))]" />
          </motion.button>
        </div>

        <div className="p-4 border-t border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] flex flex-col sm:flex-row justify-between items-center gap-4">
          <Checkbox
            id="dismiss-forever-checkbox"
            label="Don't show this again"
            checked={localDontShowAgain}
            onChange={(e) => setLocalDontShowAgain(e.target.checked)}
          />
          <Button
            variant="primary"
            onClick={handleDismiss}
            className="w-full sm:w-auto"
          >
            Got It, Let&apos;s Go!
          </Button>
        </div>
      </div>
    </div>
  );
}