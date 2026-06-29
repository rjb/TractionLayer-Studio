import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import TurndownService from 'turndown';

const turndown = new TurndownService({ headingStyle: 'atx' });

// Helper to calculate reading time based on 200 WPM
function calculateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function extractPublishDate($: cheerio.CheerioAPI): string {
  const structuredData = $('script[type="application/ld+json"]').first().html();
  if (structuredData) {
    try {
      const parsed = JSON.parse(structuredData) as Record<string, unknown>;
      const datePublished = parsed.datePublished as string | undefined;
      if (datePublished) {
        const parsedDate = new Date(datePublished);
        if (!Number.isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString().slice(0, 10);
        }
      }
    } catch {
      // fall through
    }
  }

  const selectors = [
    'meta[property="article:published_time"]',
    'meta[name="article:published_time"]',
    'time[datetime]',
  ];

  for (const selector of selectors) {
    const value = $(selector).first().attr('datetime') ?? $(selector).first().attr('content');
    if (value) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }
    }
  }

  return new Date().toISOString().slice(0, 10);
}

function extractTitle($: cheerio.CheerioAPI): string {
  return $('h1.post-title').first().text().trim();
}

function extractSubtitle($: cheerio.CheerioAPI): string {
  return $('h3.subtitle').first().text().trim();
}

function extractAuthor($: cheerio.CheerioAPI): string {
  return (
    $('meta[name="author"]').first().attr('content') ??
    $('.post-author').first().text().trim() ??
    $('a.navbar-title').first().text().trim() ??
    ''
  );
}

function extractHeroImageUrl($: cheerio.CheerioAPI): string {
  return (
    $('meta[property="og:image"]').first().attr('content') ??
    $('meta[name="twitter:image"]').first().attr('content') ??
    ''
  );
}

function extractAuthorImageUrl($: cheerio.CheerioAPI): string {
  return (
    $('.author-profile-pic img').first().attr('src') ??
    $('meta[name="twitter:image:src"]').first().attr('content') ??
    ''
  );
}

function extractDescription($: cheerio.CheerioAPI): string {
  return (
    $('meta[name="description"]').first().attr('content') ??
    $('meta[property="og:description"]').first().attr('content') ??
    ''
  );
}

function extractBodyHtml($: cheerio.CheerioAPI): string {
  const selectors = ['.available-content', 'article', '.post-content'];
  let container: cheerio.Cheerio<AnyNode> = $('body');

  for (const selector of selectors) {
    const el = $(selector).first();
    if (el.length > 0) {
      container = el;
      break;
    }
  }

  const html = container.html() ?? '';
  const $body = cheerio.load(html, null, false);

  $body(
    'script, style, iframe, noscript, .subscription-widget, .subscribe-section, .paywall, ' +
    '.post-footer, .comments, .comment-section, .post-aux, .like-button, .comment-button, ' +
    '[data-component-name="PostFooter"], [data-component-name="SubscriptionWidget"]'
  ).remove();

  return $body.html() ?? '';
}

export async function GET(request: Request) {
  // 1. SECURITY GATE
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.API_MASTER_SECRET;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json([{ success: false, error: 'Unauthorized: Missing Bearer Token' }], { status: 401 });
  }

  const providedToken = authHeader.replace('Bearer ', '').trim();

  if (!expectedSecret || providedToken !== expectedSecret) {
    return NextResponse.json([{ success: false, error: 'Forbidden: Invalid API Token' }], { status: 403 });
  }

  // 2. PARAMETER VALIDATION
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json([{ success: false, error: 'Bad Request: Missing "url" query parameter' }], { status: 400 });
  }

  // 3. EXECUTION
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Substack returned status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = extractTitle($);
    const subtitle = extractSubtitle($);
    const description = extractDescription($);
    const author = extractAuthor($);
    const publishDate = extractPublishDate($);
    const heroImageUrl = extractHeroImageUrl($);
    const authorImageUrl = extractAuthorImageUrl($);
    const bodyHtml = extractBodyHtml($);
    const bodyMarkdown = turndown.turndown(bodyHtml).trim();

    // Generate slug from URL pathname
    const urlObj = new URL(targetUrl);
    const slug = urlObj.pathname.split('/').filter(Boolean).pop() ?? '';
    const readingTime = calculateReadingTime(bodyMarkdown);

    return NextResponse.json([
      {
        success: true,
        data: {
          slug,
          url: targetUrl,
          title,
          subtitle,
          description,
          excerpt: description, // Substack descriptions serve well as excerpts
          body_html: bodyHtml,
          body_markdown: bodyMarkdown,
          reading_time_minutes: readingTime,
          date: publishDate,
          author,
          hero_image_url: heroImageUrl,
          author_image_url: authorImageUrl,
        }
      }
    ]);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to scrape Substack post';
    return NextResponse.json([
      {
        success: false,
        error: message
      }
    ], { status: 500 });
  }
}
