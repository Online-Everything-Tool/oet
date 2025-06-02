// FILE: app/_components/Header.tsx
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

const IS_STATIC_BUILD_VALIDATION =
  process.env.NEXT_PUBLIC_IS_STATIC_BUILD_VALIDATION === 'true';

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
    useState<OfficerDisplayState>(
      IS_STATIC_BUILD_VALIDATION ? 'operational' : 'hidden'
    );
  const [apiStatus, setApiStatus] = useState<ApiStatusResponse | null>(null);
  const [isLoadingApiStatus, setIsLoadingApiStatus] = useState(
    !IS_STATIC_BUILD_VALIDATION
  );

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
      if (!IS_STATIC_BUILD_VALIDATION) {
        setOfficerDisplayState('pending');
      }

      const titleSettlePromise = titleControls.start('visible');
      const kevinWrapperSettlePromise = kevinWrapperControls.start('visible', {
        delay: 0.1 * ANIMATION_SPEED_MULTIPLIER,
      });

      if (IS_STATIC_BUILD_VALIDATION) {
        console.log(
          '[Header] Static build validation mode: Mocking API status as operational.'
        );
        const mockStatus: ApiStatusResponse = {
          globalStatus: 'operational',
          featureFlags: {
            favoritesEnabled: true,
            recentlyUsedEnabled: true,
            recentBuildsEnabled: true,
            buildToolEnabled: true,
          },
          services: { githubApi: 'operational', aiServices: 'operational' },
          message: 'All systems operational (Static Build Mode)',
          timestamp: new Date().toISOString(),
        };
        setApiStatus(mockStatus);
      } else {
        fetch('/api/status')
          .then((res) =>
            res.ok
              ? res.json()
              : Promise.reject(new Error(`API Error: ${res.status}`))
          )
          .then((data: ApiStatusResponse) => setApiStatus(data))
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
              message: `Error fetching status: ${err.message}`,
            });
          })
          .finally(() => setIsLoadingApiStatus(false));
      }
      await Promise.all([titleSettlePromise, kevinWrapperSettlePromise]);
    };
    initialSequence();
  }, [titleControls, kevinWrapperControls]);

  useEffect(() => {
    if (!IS_STATIC_BUILD_VALIDATION && !isLoadingApiStatus && apiStatus) {
      setOfficerDisplayState(
        apiStatus.globalStatus === 'operational' ? 'operational' : 'error'
      );
    }
  }, [isLoadingApiStatus, apiStatus]);

  useEffect(() => {
    let canShowAnyCTA = false;

    if (IS_STATIC_BUILD_VALIDATION) {
      canShowAnyCTA = true;
    } else if (!isLoadingApiStatus && apiStatus) {
      canShowAnyCTA =
        apiStatus.featureFlags.favoritesEnabled ||
        apiStatus.featureFlags.recentlyUsedEnabled ||
        (apiStatus.globalStatus === 'operational' &&
          (apiStatus.featureFlags.recentBuildsEnabled ||
            apiStatus.featureFlags.buildToolEnabled));
    }

    if (canShowAnyCTA && !isFocusMode) {
      setTimeout(
        () => {
          ctaGroupControls.start('visible');
        },
        (IS_STATIC_BUILD_VALIDATION ? 0.05 : 0.2) *
          ANIMATION_SPEED_MULTIPLIER *
          1000
      );
    } else {
      ctaGroupControls.start('hidden');
    }
  }, [isLoadingApiStatus, apiStatus, ctaGroupControls, isFocusMode]);

  const headerBaseClasses =
    'bg-[rgb(var(--color-button-primary-bg))] text-[rgb(var(--color-button-primary-text))] shadow-md';
  const stickyClasses = 'sticky top-0 z-50';

  return (
    <header
      className={`${headerBaseClasses} ${stickyClasses} flex items-center ${isFocusMode ? 'invisible' : ''}`}
    >
      <nav className="container mx-auto max-w-6xl px-4 min-h-[68px] flex justify-between items-center relative">
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
                  {apiStatus?.globalStatus === 'operational' &&
                    apiStatus?.featureFlags.buildToolEnabled && (
                      <motion.div variants={ctaItemVariant}>
                        <Suspense
                          fallback={<GenericButtonFallback width="w-[88px]" />}
                        >
                          <HeaderBuildToolButton />
                        </Suspense>
                      </motion.div>
                    )}
                  {apiStatus?.globalStatus === 'operational' &&
                    apiStatus?.featureFlags.recentBuildsEnabled && (
                      <motion.div variants={ctaItemVariant}>
                        <Suspense
                          fallback={<GenericButtonFallback width="w-[100px]" />}
                        >
                          <HeaderRecentBuilds />
                        </Suspense>
                      </motion.div>
                    )}
                  {apiStatus?.featureFlags.recentlyUsedEnabled && (
                    <motion.div variants={ctaItemVariant}>
                      <Suspense
                        fallback={<GenericButtonFallback width="w-10" />}
                      >
                        <HeaderRecentlyUsed />
                      </Suspense>
                    </motion.div>
                  )}
                  {apiStatus?.featureFlags.favoritesEnabled && (
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
