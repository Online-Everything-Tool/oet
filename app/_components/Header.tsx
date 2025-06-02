// FILE: app/_components/Header.tsx (R-L Unfurl for CTAs)
'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { useFullscreenFocus } from '@/app/context/FullscreenFocusContext';
import type { OfficerDisplayState } from './header/StatusOfficerDisplay';
import type { ApiStatusResponse } from '@/app/api/status/route';

import HeaderDynamicTitle from './header/HeaderDynamicTitle';
import StatusOfficerDisplay from './header/StatusOfficerDisplay';
import HeaderFavorites from './header/HeaderFavorites';
import HeaderRecentlyUsed from './header/HeaderRecentlyUsed';
import HeaderBuildToolButton from './header/HeaderBuildToolButton';
import HeaderRecentBuilds from './header/HeaderRecentBuilds';

const HeaderTitleFallback = () => (
  <div className="h-7 w-24 bg-white/10 rounded animate-pulse"></div>
);
const StatusOfficerFallback = () => (
  <div className="h-10 w-40 bg-black/10 rounded-md animate-pulse"></div>
);
const GenericButtonFallback = ({
  width = 'w-10',
  height = 'h-8',
}: {
  width?: string;
  height?: string;
}) => (
  <div
    className={`${height} ${width} bg-white/10 rounded animate-pulse mx-0.5`}
  ></div>
);

const ANIMATION_SPEED_MULTIPLIER = 1;

export default function Header() {
  const { isFocusMode } = useFullscreenFocus();
  const [officerDisplayState, setOfficerDisplayState] =
    useState<OfficerDisplayState>('hidden');
  const [apiStatus, setApiStatus] = useState<ApiStatusResponse | null>(null);
  const [isLoadingApiStatus, setIsLoadingApiStatus] = useState(true);

  const titleControls = useAnimationControls();
  const kevinWrapperControls = useAnimationControls();
  const ctaGroupControls = useAnimationControls();

  const mainItemSettleVariant = {
    hidden: (customDirection: number) => ({
      opacity: 0,
      x: customDirection * 30,
    }),
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.6 * ANIMATION_SPEED_MULTIPLIER,
        ease: 'circOut',
      },
    },
  };

  const ctaGroupVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: 'beforeChildren',
        staggerChildren: 0.1 * ANIMATION_SPEED_MULTIPLIER,
        staggerDirection: -1,
      },
    },
  };

  const ctaItemVariant = {
    hidden: { opacity: 0, x: 20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        ease: 'easeOut',
        duration: 0.4 * ANIMATION_SPEED_MULTIPLIER,
      },
    },
  };

  useEffect(() => {
    const initialSequence = async () => {
      console.log(
        'Header (Step 1 - Settle): Title and KevinWrapper appearing.'
      );
      setOfficerDisplayState('pending');

      const titleSettlePromise = titleControls.start('visible');
      const kevinWrapperSettlePromise = kevinWrapperControls.start('visible', {
        delay: 0.1 * ANIMATION_SPEED_MULTIPLIER,
      });

      setIsLoadingApiStatus(true);
      fetch('/api/status')
        .then((res) => (res.ok ? res.json() : Promise.reject('API Error')))
        .then((data) => setApiStatus(data as ApiStatusResponse))
        .catch((err) => {
          console.error('API Status Fetch Error:', err);
          setApiStatus({
            globalStatus: 'degraded',
            featureFlags: {
              favoritesEnabled: true,
              recentlyUsedEnabled: true,
              recentBuildsEnabled: false,
              buildToolEnabled: false,
            },
            timestamp: new Date().toISOString(),
          });
        })
        .finally(() => setIsLoadingApiStatus(false));

      await Promise.all([titleSettlePromise, kevinWrapperSettlePromise]);
      console.log(
        'Header (Step 1 - Settle): Title and KevinWrapper in final L/R positions.'
      );
    };
    initialSequence();
  }, [titleControls, kevinWrapperControls]);

  useEffect(() => {
    if (!isLoadingApiStatus && apiStatus) {
      console.log(
        'Header (Step 2 - Unfurl & Status): API status received.',
        apiStatus
      );
      setOfficerDisplayState(
        apiStatus.globalStatus === 'operational' ? 'operational' : 'error'
      );

      const canShowAnyCTA =
        apiStatus.featureFlags.favoritesEnabled ||
        apiStatus.featureFlags.recentlyUsedEnabled ||
        (apiStatus.globalStatus === 'operational' &&
          (apiStatus.featureFlags.recentBuildsEnabled ||
            apiStatus.featureFlags.buildToolEnabled));

      if (canShowAnyCTA) {
        console.log(
          'Header (Step 2 - Unfurl & Status): Triggering CTA group visibility.'
        );
        setTimeout(
          () => {
            ctaGroupControls.start('visible');
          },
          0.2 * ANIMATION_SPEED_MULTIPLIER * 1000
        );
      } else {
        console.log(
          'Header (Step 2 - Unfurl & Status): No CTAs to show based on API status.'
        );
      }
    }
  }, [isLoadingApiStatus, apiStatus, ctaGroupControls, officerDisplayState]);

  const headerBaseClasses =
    'bg-[rgb(var(--color-button-primary-bg))] text-[rgb(var(--color-button-primary-text))] shadow-md';
  const stickyClasses = 'sticky top-0 z-50';

  if (isFocusMode) return null;

  return (
    <header
      className={`${headerBaseClasses} ${stickyClasses} flex items-center`}
    >
      <nav className="container mx-auto max-w-6xl px-4 min-h-[68px] flex justify-between items-center overflow-hidden relative">
        <motion.div
          className="flex-none"
          variants={mainItemSettleVariant}
          custom={-1}
          initial="hidden"
          animate={titleControls}
        >
          <Suspense fallback={<HeaderTitleFallback />}>
            <HeaderDynamicTitle />
          </Suspense>
        </motion.div>

        <motion.div
          className="flex items-center flex-none"
          variants={mainItemSettleVariant}
          custom={1}
          initial="hidden"
          animate={kevinWrapperControls}
        >
          <div className="flex items-center">
            <motion.div
              className="flex items-center space-x-1 md:space-x-2 mr-2 md:mr-3"
              variants={ctaGroupVariants}
              initial="hidden"
              animate={ctaGroupControls}
            >
              {!isLoadingApiStatus && apiStatus && (
                <>
                  {apiStatus.globalStatus === 'operational' &&
                    apiStatus.featureFlags.buildToolEnabled && (
                      <motion.div variants={ctaItemVariant}>
                        <Suspense
                          fallback={<GenericButtonFallback width="w-[88px]" />}
                        >
                          <HeaderBuildToolButton />
                        </Suspense>
                      </motion.div>
                    )}
                  {apiStatus.globalStatus === 'operational' &&
                    apiStatus.featureFlags.recentBuildsEnabled && (
                      <motion.div variants={ctaItemVariant}>
                        <Suspense
                          fallback={<GenericButtonFallback width="w-[100px]" />}
                        >
                          <HeaderRecentBuilds />
                        </Suspense>
                      </motion.div>
                    )}
                  {apiStatus.featureFlags.recentlyUsedEnabled && (
                    <motion.div variants={ctaItemVariant}>
                      <Suspense
                        fallback={<GenericButtonFallback width="w-10" />}
                      >
                        <HeaderRecentlyUsed />
                      </Suspense>
                    </motion.div>
                  )}
                  {apiStatus.featureFlags.favoritesEnabled && (
                    <motion.div variants={ctaItemVariant}>
                      <Suspense
                        fallback={<GenericButtonFallback width="w-10" />}
                      >
                        <HeaderFavorites />
                      </Suspense>
                    </motion.div>
                  )}
                </>
              )}
              {!isLoadingApiStatus &&
                apiStatus &&
                !apiStatus.featureFlags.favoritesEnabled &&
                !apiStatus.featureFlags.recentlyUsedEnabled &&
                !(
                  apiStatus.globalStatus === 'operational' &&
                  (apiStatus.featureFlags.buildToolEnabled ||
                    apiStatus.featureFlags.recentBuildsEnabled)
                ) && (
                  <div className="text-xs text-indigo-200 italic mr-2">
                    (No actions available)
                  </div>
                )}
            </motion.div>

            {officerDisplayState !== 'hidden' && (
              <Suspense fallback={<StatusOfficerFallback />}>
                <StatusOfficerDisplay displayState={officerDisplayState} />
              </Suspense>
            )}
          </div>
        </motion.div>
      </nav>
    </header>
  );
}
