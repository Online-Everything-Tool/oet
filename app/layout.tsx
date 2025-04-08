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
        {/* Shoelace theme CSS is imported via the import statement above */}
        {/* Next.js will handle including it in the head */}
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