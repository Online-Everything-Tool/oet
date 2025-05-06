// FILE: app/robots.ts
import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

// Define your site's base URL again (should match sitemap.ts)
const baseUrl = 'https://online-everything-tool.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*', // Applies to all crawlers
        allow: '/', // Allow crawling the entire site by default
        disallow: [
          '/api/', // Disallow crawling API routes
          '/build-tool/', // Disallow crawling the tool builder interface
          '/history/', // Disallow crawling the user-specific history page
          // Add any other specific paths you want to exclude
          // e.g., '/private/',
        ],
      },
      // Add specific rules for other user agents if needed
      // {
      //   userAgent: 'Googlebot',
      //   allow: ['/'],
      //   disallow: ['/api/'],
      // },
    ],
    sitemap: `${baseUrl}/sitemap.xml`, // Point crawlers to your sitemap
  };
}
