// app/_components/Footer.tsx
import React from 'react';
import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-text-muted))] border-t border-[rgb(var(--color-border-base))] mt-auto">
      <div className="container mx-auto max-w-6xl px-4 py-6 text-center sm:text-left sm:flex sm:justify-between sm:items-center">
        <p className="text-sm mb-2 sm:mb-0">
          © {currentYear} Online Everything Tool. All Rights Reserved. 🔮
        </p>
        <div className="flex justify-center sm:justify-start space-x-4">
          <Link
            href="https://github.com/Online-Everything-Tool/oet"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:text-[rgb(var(--color-text-link))] hover:underline"
          >
            GitHub
          </Link>
          {/* You can add more links here if needed, e.g., Privacy Policy, Terms of Service */}
          {/*
          <Link href="/privacy" className="text-sm hover:text-[rgb(var(--color-text-link))] hover:underline">
            Privacy
          </Link>
          */}
        </div>
      </div>
    </footer>
  );
}
