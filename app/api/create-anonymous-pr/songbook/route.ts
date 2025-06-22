import { NextRequest, NextResponse } from 'next/server';

const SCRAPER_API_URL = 'http://localhost:3001/scrape';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targetUrl = body.url;

    if (!targetUrl || typeof targetUrl !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "url" in request body' },
        { status: 400 }
      );
    }

    console.log(
      `[Next.js Route Handler] Received request to scrape: ${targetUrl}`
    );

    const scrapeResponse = await fetch(SCRAPER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: targetUrl }),
    });

    console.log(
      `[Next.js Route Handler] Scraper responded with status: ${scrapeResponse.status}`
    );

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      console.error(
        '[Next.js Route Handler] Error from scraper service:',
        scrapeData
      );
      return NextResponse.json(scrapeData, { status: scrapeResponse.status });
    }

    return NextResponse.json(scrapeData, { status: 200 });
  } catch (error) {
    const err = error as Error;
    console.error(
      '[Next.js Route Handler] Internal error:',
      err.message,
      err.stack
    );

    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body to Next.js route handler.' },
        { status: 400 }
      );
    }

    // prettier-ignore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (err.message.includes('fetch failed') ||(err.cause && (err.cause as any).code === 'ECONNREFUSED')) {
      console.error(
        '[Next.js Route Handler] Failed to connect to the scraper service at',
        SCRAPER_API_URL
      );
      return NextResponse.json(
        { error: 'Scraping service is unavailable.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: 'An unexpected error occurred in the Next.js route handler.',
        details: err.message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST with a JSON body: { "url": "ug_url"}',
  });
}
