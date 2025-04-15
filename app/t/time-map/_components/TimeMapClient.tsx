'use client';

import React, { useState, useEffect } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import * as dateFns from 'date-fns';
import { ThreeGlobe } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

interface TimeMapClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function TimeMapClient({ toolTitle, toolRoute }: TimeMapClientProps) {
  const [currentTime, setCurrentTime] = useState({});
  const { addHistoryEntry } = useHistory();

  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = new Date();
      const timeZones = {
        "America/New_York": dateFns.format(now, 'HH:mm:ss zzz'),
        "Europe/London": dateFns.format(dateFns.utcToZonedTime(now, 'Europe/London'), 'HH:mm:ss zzz'),
        "Asia/Tokyo": dateFns.format(dateFns.utcToZonedTime(now, 'Asia/Tokyo'), 'HH:mm:ss zzz'),
        // Add more time zones as needed
      };
      setCurrentTime(timeZones);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        action: 'update',
        input: {},
        output: timeZones,
        status: 'success'
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [addHistoryEntry, toolTitle, toolRoute]);

  return (
    <div>
      <h1>{toolTitle}</h1>
      <pre>{JSON.stringify(currentTime, null, 2)}</pre>      
      <Canvas>
        <ThreeGlobe />
      </Canvas>      
    </div>
  );
}