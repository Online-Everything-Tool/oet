// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css"; // Keep your global styles
import { HistoryProvider } from "./context/HistoryContext";
import Header from "@/components/Header";

// --- Shoelace Integration Step 2: Import the setup component ---
import ShoelaceSetup from "@/components/ShoelaceSetup"; // Adjust path if needed
import '@shoelace-style/shoelace/dist/themes/light.css'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Online Everything Tool",
  description: "All-in-One Utility for transforming Data, Images, and Text",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="OET" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="OET" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#ffffff" />

        {/* --- Manifest Link (Inside Head) --- */}
        <link rel="manifest" href="/manifest.json" />
        {/* --- End Manifest Link --- */}

        {/* Optional: Add apple-touch-icon links if needed */}
        {/* <link rel="apple-touch-icon" href="/icons/touch-icon-iphone.png" /> */}

        {/* Other head elements like Shoelace theme CSS import handled via module imports */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* --- Shoelace Integration Step 3: Render the setup component --- */}
        {/* This component runs client-side to set the asset base path */}
        <ShoelaceSetup />

        <HistoryProvider>
          <Header /> {/* Header is rendered first */}
          <main className="flex-grow container mx-auto max-w-6xl px-4 py-8"> {/* Main content area grows */}
            {children} {/* Page content */}
          </main>
          {/* Optional: Add a Footer component here later */}
          {/* <Footer /> */}
        </HistoryProvider>
      </body>
    </html>
  );
}