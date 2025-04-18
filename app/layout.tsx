// --- FILE: app/layout.tsx ---
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import fs from 'fs/promises';
import path from 'path';

import "./globals.css";
import { HistoryProvider } from "./context/HistoryContext";
import { ImageLibraryProvider } from "./context/ImageLibraryContext";
import { FavoritesProvider } from "./context/FavoritesContext"; // Import FavoritesProvider
import Header from "./_components/Header";
import ShoelaceSetup from "@/app/_components/ShoelaceSetup";
import ClientOnly from "./_components/ClientOnly";
import '@shoelace-style/shoelace/dist/themes/light.css';

// Font setup
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const DEFAULT_TITLE = "Online Everything Tool";
const DEFAULT_DESCRIPTION = "A versatile collection of free, client-side utilities for transforming data, images, and text.";

interface ProjectAnalysisData {
    siteTagline?: string;
    siteDescription?: string;
}

// generateMetadata function (remains unchanged)
export async function generateMetadata(): Promise<Metadata> {
    const analysisFilePath = path.join(process.cwd(), 'public', 'data', 'project_analysis.json');
    let analysisData: ProjectAnalysisData | null = null;
    try {
        await fs.access(analysisFilePath);
        const analysisContent = await fs.readFile(analysisFilePath, 'utf-8');
        analysisData = JSON.parse(analysisContent);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const isFsError = typeof error === 'object' && error !== null && 'code' in error;
        const errorCode = isFsError ? (error as { code: string }).code : null;
        if (errorCode !== 'ENOENT') {
            console.error("[Layout Metadata] Error reading or parsing project_analysis.json:", message);
        } else {
            console.log("[Layout Metadata] project_analysis.json not found. Using default metadata.");
        }
    }
    const description = analysisData?.siteDescription?.trim() || DEFAULT_DESCRIPTION;
    return {
        metadataBase: new URL('https://online-everything-tool.com'),
        title: { default: DEFAULT_TITLE, template: `%s | ${DEFAULT_TITLE}` },
        description: description,
        applicationName: 'OET',
        openGraph: { title: DEFAULT_TITLE, description: description, url: 'https://online-everything-tool.com', siteName: DEFAULT_TITLE, locale: 'en_US', type: 'website' },
        twitter: { card: 'summary_large_image', title: DEFAULT_TITLE, description: description },
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
                className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
            >
                <ShoelaceSetup />
                <ClientOnly>
                    <ImageLibraryProvider>
                        <HistoryProvider>
                            <FavoritesProvider> {/* Add FavoritesProvider here */}
                                <Header />
                                <main className="flex-grow container mx-auto max-w-6xl px-4 py-8">
                                    {children}
                                </main>
                            </FavoritesProvider> {/* Close FavoritesProvider */}
                        </HistoryProvider>
                    </ImageLibraryProvider>
                </ClientOnly>
            </body>
        </html>
    );
}
// --- END FILE: app/layout.tsx ---