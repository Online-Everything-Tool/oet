// FILE: app/robots.ts
import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const baseUrl = 'https://online-everything-tool.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/build-tool/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
