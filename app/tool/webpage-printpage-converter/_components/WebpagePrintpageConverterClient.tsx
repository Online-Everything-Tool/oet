'use client';

import React from 'react';
import { useWebpageScraper } from '../_hooks/useWebpageScraper';
import Button from '@/app/tool/_components/form/Button';
import PrintablePage from './PrintablePage';
import { PrinterIcon, SparklesIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon } from '@heroicons/react/20/solid';

interface WebpagePrintpageConverterClientProps {
  toolRoute: string;
}

export default function WebpagePrintpageConverterClient({ toolRoute }: WebpagePrintpageConverterClientProps) {
  const { scrapedPages, isLoading, progress, overallError, scrapePages, reset } = useWebpageScraper();

  const handlePrint = () => {
    window.print();
  };
  
  const hasResults = scrapedPages.length > 0;
  const successfulPages = scrapedPages.filter(p => p.status === 'success');
  const failedPages = scrapedPages.filter(p => p.status === 'error');

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .printable-section {
            page-break-after: always;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex flex-wrap gap-4 items-center no-print">
        <Button
          variant="primary"
          onClick={scrapePages}
          disabled={isLoading}
          isLoading={isLoading}
          loadingText="Scraping..."
          iconLeft={<SparklesIcon className="h-5 w-5" />}
        >
          Start Scraping
        </Button>
        {hasResults && (
          <>
            <Button
              variant="secondary"
              onClick={handlePrint}
              disabled={isLoading || (successfulPages.length === 0 && failedPages.length === 0)}
              iconLeft={<PrinterIcon className="h-5 w-5" />}
            >
              Print All Pages
            </Button>
            <Button
              variant="neutral"
              onClick={reset}
              disabled={isLoading}
              iconLeft={<XCircleIcon className="h-5 w-5" />}
            >
              Reset
            </Button>
          </>
        )}
      </div>

      {isLoading && (
        <div className="w-full bg-[rgb(var(--color-bg-neutral))] rounded-full h-2.5 no-print">
          <div
            className="bg-[rgb(var(--color-button-primary-bg))] h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
          <p className="text-center text-sm mt-2 text-[rgb(var(--color-text-muted))]">{Math.round(progress)}% Complete</p>
        </div>
      )}

      {overallError && (
         <div role="alert" className="p-4 my-4 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-3 no-print">
          <ExclamationTriangleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold">Scraping Error</h4>
            <p>{overallError}</p>
            <p className="mt-2 text-xs">
              This is expected due to browser security (CORS). A real-world version of this tool would require a server-side proxy to fetch external web pages, which is outside the scope of this client-side-only project.
            </p>
          </div>
        </div>
      )}

      {hasResults && (
        <div className="print-container mt-6">
          {scrapedPages.map((page) => (
            page.status === 'success' ? (
              <PrintablePage key={page.id} title={page.title} content={page.content} />
            ) : page.status === 'error' ? (
              <div key={page.id} className="printable-section mb-8 p-6 border border-[rgb(var(--color-border-error))] rounded-lg bg-[rgb(var(--color-bg-error-subtle))] shadow-md">
                <h2 className="text-2xl font-bold mb-4 border-b border-[rgb(var(--color-border-base))] pb-2 text-[rgb(var(--color-text-error))]">{page.title} - Failed</h2>
                <p className="text-[rgb(var(--color-text-error))]">{page.error}</p>
              </div>
            ) : null
          ))}
        </div>
      )}
    </div>
  );
}