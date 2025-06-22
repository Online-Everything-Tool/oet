// FILE: app/_components/AnalyticsBeacon.tsx
'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function AnalyticsBeacon() {
  const pathname = usePathname();
  const sessionStartTimeRef = useRef<number | null>(null);
  const landingPathRef = useRef<string | null>(null);

  useEffect(() => {
    sessionStartTimeRef.current = Date.now();
    landingPathRef.current = pathname;

    const handleUnload = () => {
      if (!sessionStartTimeRef.current) return;

      const sessionEndTime = Date.now();
      const durationSeconds = Math.round(
        (sessionEndTime - sessionStartTimeRef.current) / 1000
      );

      const data = JSON.stringify({
        event: 'session-end',
        duration_sec: durationSeconds,
        path: landingPathRef.current,
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/beacon', data);
        console.log(
          `Beacon sent for session on path "${landingPathRef.current}" with duration:`,
          durationSeconds,
          's'
        );
      }
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [pathname]);
  return null;
}
