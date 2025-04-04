import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { HistoryProvider } from "./context/HistoryContext";
import Header from "@/components/Header";

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
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.20.1/cdn/themes/light.css" />
        <script type="module" src="https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.20.1/cdn/shoelace-autoloader.js"></script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <HistoryProvider>
          <Header /> {/* Header is rendered first */}
          <main className="flex-grow container mx-auto max-w-6xl px-4 py-8"> {/* Main content area grows */}
            {children} {/* Page content */}
          </main>
          {/* Optional: Add a Footer component here later */}
          {/* <Footer /> */}        </HistoryProvider>
      </body>
    </html>
  );
}
