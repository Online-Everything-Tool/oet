// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import fs from 'fs/promises';
import path from 'path';

import "./globals.css";
import { HistoryProvider } from "./context/HistoryContext";
import Header from "./_components/Header";
import ShoelaceSetup from "@/app/_components/ShoelaceSetup";
import '@shoelace-style/shoelace/dist/themes/light.css';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DEFAULT_TITLE = "Online Everything Tool";
const DEFAULT_DESCRIPTION = "A versatile collection of free, client-side utilities for transforming data, images, and text.";

interface ProjectAnalysisData {
  siteTagline?: string;
  siteDescription?: string;
}

// --- Dynamic Metadata Generation ---
export async function generateMetadata(): Promise<Metadata> {
  const analysisFilePath = path.join(process.cwd(), 'public', 'data', 'project_analysis.json');
  let analysisData: ProjectAnalysisData | null = null;

  try {
    await fs.access(analysisFilePath);
    const analysisContent = await fs.readFile(analysisFilePath, 'utf-8');
    analysisData = JSON.parse(analysisContent);
  } catch (error: unknown) { // <-- Changed from any to unknown
    // --- Type checking before accessing properties ---
    const message = error instanceof Error ? error.message : String(error);
    // Check if it's a Node.js filesystem error with a code property
    const isFsError = typeof error === 'object' && error !== null && 'code' in error;
    const errorCode = isFsError ? (error as { code: string }).code : null;

    if (errorCode !== 'ENOENT') { // Log only if NOT file not found
      console.error("[Layout Metadata] Error reading or parsing project_analysis.json:", message);
    } else {
      console.log("[Layout Metadata] project_analysis.json not found. Using default metadata.");
    }
    // --- End Type Checking ---
  }

  const description = analysisData?.siteDescription?.trim() || DEFAULT_DESCRIPTION;

  return {
    metadataBase: new URL('https://online-everything-tool.com'),
    title: {
        default: DEFAULT_TITLE,
        template: `%s | ${DEFAULT_TITLE}`,
    },
    description: description,
    applicationName: 'OET',
    openGraph: {
        title: DEFAULT_TITLE,
        description: description,
        url: 'https://online-everything-tool.com',
        siteName: DEFAULT_TITLE,
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: DEFAULT_TITLE,
        description: description,
    },
    manifest: '/manifest.json',
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="OET" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ShoelaceSetup />
        <HistoryProvider>
          <Header />
          <main className="flex-grow container mx-auto max-w-6xl px-4 py-8">
            {children}
          </main>
        </HistoryProvider>
      </body>
    </html>
  );
}