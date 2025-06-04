// FILE: app/_components/header/HeaderRecentlyUsed.tsx
'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { usePathname } from 'next/navigation';
import { useRecentlyUsed } from '@/app/context/RecentlyUsedContext';
import RecentlyUsedToolsWidget from '@/app/_components/RecentlyUsedToolsWidget';
import { ListBulletIcon } from '@heroicons/react/24/solid';
import Button from '@/app/tool/_components/form/Button';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-fade';

interface MegaToolMessage {
  id: string;
  source: string;
  emoji: string;
  text: string;
}
interface MegaToolMessageFile {
  title: string;
  messages: MegaToolMessage[];
}

export default function HeaderRecentlyUsed() {
  const pathname = usePathname();
  const { recentTools, isLoaded: recentsLoaded } = useRecentlyUsed();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [megaToolMessageData, setMegaToolMessageData] =
    useState<MegaToolMessageFile | null>(null);
  const [currentMegaToolMessage, setCurrentMegaToolMessage] =
    useState<MegaToolMessage | null>(null);
  const [megaToolMessagesLoading, setMegaToolMessagesLoading] = useState(true);

  const currentToolDirective = useMemo(() => {
    if (pathname.startsWith('/tool/')) {
      return pathname.split('/tool/')[1]?.replace(/\/$/, '');
    }
    return undefined;
  }, [pathname]);

  const headerRecentToolsCount = useMemo(() => {
    if (!recentsLoaded) return 0;
    return recentTools.filter((tool) => tool.directive !== currentToolDirective)
      .length;
  }, [recentTools, recentsLoaded, currentToolDirective]);

  useEffect(() => {
    const fetchMegaToolMessages = async () => {
      setMegaToolMessagesLoading(true);
      try {
        const response = await fetch('/data/build/megatool_messages.json');
        if (!response.ok) {
          if (response.status === 404)
            console.warn('megatool_messages.json not found.');
          else
            throw new Error(
              `Failed to fetch megatool_messages.json: ${response.status}`
            );
          setMegaToolMessageData(null);
          return;
        }
        const data: MegaToolMessageFile = await response.json();
        if (data && data.messages && data.messages.length > 0) {
          setMegaToolMessageData(data);

          if (!currentMegaToolMessage || !isDropdownOpen) {
            setCurrentMegaToolMessage(
              data.messages[Math.floor(Math.random() * data.messages.length)]
            );
          }
        } else {
          setMegaToolMessageData(null);
        }
      } catch (error) {
        console.error('Error fetching megatool_messages.json:', error);
        setMegaToolMessageData(null);
      } finally {
        setMegaToolMessagesLoading(false);
      }
    };
    fetchMegaToolMessages();
  }, []);

  const changeMegaToolMessage = useCallback(() => {
    if (megaToolMessageData && megaToolMessageData.messages.length > 0) {
      let newMessage = currentMegaToolMessage;
      if (megaToolMessageData.messages.length > 1) {
        let attempts = 0;
        while (
          newMessage === currentMegaToolMessage &&
          attempts < megaToolMessageData.messages.length * 2
        ) {
          newMessage =
            megaToolMessageData.messages[
              Math.floor(Math.random() * megaToolMessageData.messages.length)
            ];
          attempts++;
        }
      }
      setCurrentMegaToolMessage(newMessage);
    }
  }, [megaToolMessageData, currentMegaToolMessage]);

  const toggleDropdown = useCallback(() => {
    if (!recentsLoaded || megaToolMessagesLoading) return;
    const newIsOpen = !isDropdownOpen;
    setIsDropdownOpen(newIsOpen);
    if (newIsOpen) {
      changeMegaToolMessage();
    }
  }, [
    recentsLoaded,
    megaToolMessagesLoading,
    isDropdownOpen,
    changeMegaToolMessage,
  ]);

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    }
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isDropdownOpen, closeDropdown]);

  const MegaToolSwiperBanner = () => {
    if (
      megaToolMessagesLoading ||
      !megaToolMessageData ||
      megaToolMessageData.messages.length === 0
    ) {
      return null;
    }

    if (!currentMegaToolMessage) return null;

    return (
      <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2.5 min-h-[150px]">
        <p className="pt-3 pb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
          {megaToolMessageData.title}
        </p>
        <Swiper
          modules={[Autoplay, EffectFade]}
          spaceBetween={0}
          slidesPerView={1}
          loop={true}
          autoplay={{
            delay: 7000,
            disableOnInteraction: true,
            pauseOnMouseEnter: true,
          }}
          effect="fade"
          fadeEffect={{ crossFade: true }}
          className="megatool-swiper h-full"
          allowTouchMove={false}
          noSwipingClass="swiper-no-swiping"
          key={currentMegaToolMessage.id}
          initialSlide={
            megaToolMessageData.messages.findIndex(
              (m) => m.id === currentMegaToolMessage.id
            ) || 0
          }
        >
          {megaToolMessageData.messages.map((msg) => (
            <SwiperSlide key={msg.id} className="!bg-transparent">
              <div className="flex gap-1 justify-start">
                <span className="text-2xl">{msg.emoji}</span>
                <div className="flex flex-col gap-1 justify-between">
                  <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-tight px-2">
                    {msg.text}
                  </p>
                  <p className="text-[13px] text-gray-500 dark:text-gray-400 self-end">
                    - {msg.source}
                  </p>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    );
  };

  const isLoading = !recentsLoaded || megaToolMessagesLoading;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <Button
        isEmpty={true}
        onClick={toggleDropdown}
        disabled={isLoading}
        className="rounded bg-[rgba(255,255,255,0.2)] relative hover:!bg-[rgba(255,255,255,0.4)] text-white disabled:opacity-70 px-2.5 py-1.5"
        aria-label="View Recently Used Tools"
        title={
          isLoading
            ? 'Loading...'
            : headerRecentToolsCount === 0
              ? 'No other recent tools'
              : 'View Recently Used Tools'
        }
        aria-haspopup="true"
        aria-expanded={isDropdownOpen}
        iconLeft={<ListBulletIcon className="h-5 w-5" />}
      >
        {recentsLoaded && headerRecentToolsCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-green-600 text-white text-[10px] font-bold px-1 pointer-events-none transform translate-x-1/4 -translate-y-1/4 shadow"
            title={`${headerRecentToolsCount} other recent tool${headerRecentToolsCount === 1 ? '' : 's'}`}
            aria-hidden="true"
          >
            {headerRecentToolsCount > 9 ? '9+' : headerRecentToolsCount}
          </span>
        )}
        <span className="sr-only">
          Recently Used ({headerRecentToolsCount} items)
        </span>
      </Button>

      {/* Dropdown container */}
      {isDropdownOpen && !isLoading && (
        <div
          className={`absolute right-0 mt-2 w-72 md:w-80 origin-top-right z-[60] 
                     bg-white dark:bg-gray-800 rounded-md shadow-xl
                     ${isDropdownOpen ? 'block animate-slide-down' : 'hidden'}
                     flex flex-col justify-between`}
          onClick={(e) => e.stopPropagation()}
          aria-hidden={!isDropdownOpen}
        >
          <div>
            <RecentlyUsedToolsWidget
              key="status-recent-builds-dropdown-widget"
              currentToolDirectiveToExclude={currentToolDirective}
              onItemClick={closeDropdown}
            />
          </div>
          <MegaToolSwiperBanner />
        </div>
      )}
    </div>
  );
}
