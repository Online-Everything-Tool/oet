'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import { format, parseISO } from 'date-fns';

interface Event {
  title: string;
  date: string; // ISO 8601 format
}

interface TimeMapClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function TimeMapClient({ toolTitle, toolRoute }: TimeMapClientProps) {
  const [events, setEvents] = useState<Event[]>([ ]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const { addHistoryEntry } = useHistory();

  const addEvent = useCallback(() => {
    if (!newEventTitle || !newEventDate) return;
    const newEvent: Event = {
      title: newEventTitle,
      date: newEventDate,
    };
    setEvents([...events, newEvent]);
    addHistoryEntry({
      toolName: toolTitle,
      toolRoute: toolRoute,
      action: 'addEvent',
      input: { title: newEventTitle, date: newEventDate },
      output: newEvent,
      status: 'success',
    });
    setNewEventTitle('');
    setNewEventDate('');
  }, [events, newEventTitle, newEventDate, addHistoryEntry, toolTitle, toolRoute]);

  useEffect(() => {
    // Load events from local storage or other persistent storage if needed.
  }, []);

  const renderCalendar = () => {
    const calendarEvents = events.map(event => (
      <div key={event.date} className="p-2 border-b">
        <span>{format(parseISO(event.date), 'MMMM dd, yyyy')}:</span> <span>{event.title}</span>
      </div>
    ));
    return (
      <div>
        {calendarEvents}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <input
          type="text"
          placeholder="Event Title"
          value={newEventTitle}
          onChange={(e) => setNewEventTitle(e.target.value)}
          className="p-2 border rounded"
        />
        <input
          type="date"
          value={newEventDate}
          onChange={(e) => setNewEventDate(e.target.value)}
          className="p-2 border rounded"
        />
        <button onClick={addEvent} className="p-2 bg-blue-500 text-white rounded">Add Event</button>
      </div>
      <div className="border rounded p-4">
        {renderCalendar()}
      </div>
    </div>
  );
}