'use client';

import React, { useEffect } from 'react';
import useToolState from '@/app/tool/_hooks/useToolState';
import Button from '@/app/tool/_components/form/Button';
import Input from '@/app/tool/_components/form/Input';
import Select from '@/app/tool/_components/form/Select';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import Textarea from '@/app/tool/_components/form/Textarea';
import type { ParamConfig } from '@/src/types/tools';
import { ClipboardDocumentIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface LoremIpsumToolState {
  count: number;
  type: 'paragraphs' | 'sentences' | 'words';
  startWithLorem: boolean;
  generatedText: string;
}

const DEFAULT_STATE: LoremIpsumToolState = {
  count: 5,
  type: 'paragraphs',
  startWithLorem: true,
  generatedText: '',
};

interface LoremIpsumClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

const LATIN_WORDS = [
  "ad", "adipiscing", "aliqua", "aliquip", "amet", "anim", "aute", "cillum", "commodo", "consectetur",
  "consequat", "culpa", "cupidatat", "deserunt", "do", "dolor", "dolore", "duis", "ea", "eiusmod",
  "elit", "enim", "esse", "est", "et", "eu", "ex", "excepteur", "exercitation", "fugiat",
  "id", "in", "incididunt", "ipsum", "irure", "labore", "laboris", "laborum", "lorem", "magna",
  "minim", "mollit", "nisi", "non", "nostrud", "nulla", "occaecat", "officia", "pariatur", "proident",
  "qui", "quis", "reprehenderit", "sed", "sit", "sunt", "tempor", "ullamco", "ut", "velit",
  "veniam", "voluptate"
];

export default function LoremIpsumClient({
  urlStateParams,
  toolRoute,
}: LoremIpsumClientProps) {
  const {
    state,
    setState,
    isLoadingState,
  } = useToolState<LoremIpsumToolState>(toolRoute, DEFAULT_STATE);

  const getRandomWord = () => LATIN_WORDS[Math.floor(Math.random() * LATIN_WORDS.length)];
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const generateWords = (num: number, startWithLorem: boolean): string => {
    let words: string[] = [];
    if (startWithLorem) {
        words = ["Lorem", "ipsum", "dolor", "sit", "amet"];
        if (num < 5) words = words.slice(0, num);
        else {
            for (let i = 5; i < num; i++) {
                words.push(getRandomWord());
            }
        }
    } else {
        for (let i = 0; i < num; i++) {
            words.push(getRandomWord());
        }
    }
    return words.join(' ');
  };

  const generateSentences = (num: number, startWithLorem: boolean): string => {
      let sentences: string[] = [];
      for(let i=0; i<num; i++) {
          let sentence = "";
          if (i === 0 && startWithLorem) {
              sentence = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
          } else {
              const wordCount = Math.floor(Math.random() * 10) + 5; // 5-15 words
              const words = [];
              for(let j=0; j<wordCount; j++) {
                  words.push(getRandomWord());
              }
              sentence = capitalize(words.join(' ')) + ".";
          }
          sentences.push(sentence);
      }
      return sentences.join(' ');
  };

  const generateParagraphs = (num: number, startWithLorem: boolean): string => {
      let paragraphs: string[] = [];
      for(let i=0; i<num; i++) {
          const sentenceCount = Math.floor(Math.random() * 5) + 3; // 3-8 sentences
          let paragraph = generateSentences(sentenceCount, i === 0 && startWithLorem);
          paragraphs.push(paragraph);
      }
      return paragraphs.join('\n\n');
  };

  const generateText = () => {
    let result = '';
    const { count, type, startWithLorem } = state;

    if (type === 'words') {
      result = generateWords(count, startWithLorem);
    } else if (type === 'sentences') {
      result = generateSentences(count, startWithLorem);
    } else {
      result = generateParagraphs(count, startWithLorem);
    }

    setState({ ...state, generatedText: result });
  };

  useEffect(() => {
      if (!isLoadingState) {
          generateText();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.count, state.type, state.startWithLorem, isLoadingState]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(state.generatedText);
  };

  if (isLoadingState) return <div>Loading...</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[rgb(var(--color-card-bg))] rounded-lg border border-[rgb(var(--color-border))]">
        <div className="flex flex-col gap-2">
          <Input
            label="Count"
            type="number"
            value={state.count}
            onChange={(e) => setState({ ...state, count: parseInt(e.target.value) || 0 })}
            min={1}
            max={1000}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Select
            label="Type"
            value={state.type}
            onChange={(e) => setState({ ...state, type: e.target.value as any })}
            options={[
              { value: 'paragraphs', label: 'Paragraphs' },
              { value: 'sentences', label: 'Sentences' },
              { value: 'words', label: 'Words' },
            ]}
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
           <Checkbox
            label="Start with 'Lorem ipsum...'"
            checked={state.startWithLorem}
            onChange={(e) => setState({ ...state, startWithLorem: e.target.checked })}
          />
        </div>
      </div>

      <div className="relative">
        <Textarea
          value={state.generatedText}
          readOnly
          className="min-h-[300px] font-serif text-lg leading-relaxed"
        />
        <div className="absolute top-2 right-2 flex gap-2">
            <Button onClick={generateText} variant="secondary" size="sm" title="Regenerate">
                <ArrowPathIcon className="h-4 w-4" />
            </Button>
            <Button onClick={copyToClipboard} variant="primary" size="sm" title="Copy to Clipboard">
                <ClipboardDocumentIcon className="h-4 w-4" />
            </Button>
        </div>
      </div>
    </div>
  );
}
