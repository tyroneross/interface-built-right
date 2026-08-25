/**
 * Tests for extractContentElements + extractPageMetadata — the opt-in
 * CONTENT lane (headings/paragraphs/images with real bounds) and <head>
 * metadata extraction added alongside the existing interactive-only scan.
 *
 * Served over a local HTTP server (not file://) and driven via the real
 * EngineDriver/CompatPage pair, mirroring src/engine/compat.test.ts's
 * pattern rather than mocking the DOM.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'http';
import { EngineDriver } from './engine/driver.js';
import { CompatPage } from './engine/compat.js';
import { extractContentElements, extractPageMetadata } from './extract.js';

const ROUTES: Record<string, string> = {
  '/content': `<!doctype html>
<html><head><title>Content Fixture</title></head>
<body>
<h1>Heading One</h1>
<h2>Heading Two</h2>
<h3>Heading Three</h3>
<p>A paragraph of body text.</p>
<img src="/photo.png" alt="A test photo">
<figcaption>Figure caption text</figcaption>
<blockquote>A quoted statement.</blockquote>
<p style="display:none">Hidden paragraph zero area</p>
</body></html>`,
  '/metadata-full': `<!doctype html>
<html><head>
<title>Metadata Fixture</title>
<meta name="description" content="A test page description">
<link rel="canonical" href="https://example.com/canonical">
<meta property="og:title" content="OG Title">
<meta property="og:description" content="OG Description">
<meta property="og:image" content="https://example.com/img.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Twitter Title">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Test"}</script>
</head><body><p>Body</p></body></html>`,
  '/metadata-invalid-jsonld': `<!doctype html>
<html><head><title>Invalid JSONLD Fixture</title>
<script type="application/ld+json">{not valid json,,,}</script>
</head><body></body></html>`,
  '/no-metadata': `<!doctype html>
<html><head></head><body><p>No metadata here</p></body></html>`,
};

describe('extractContentElements + extractPageMetadata', () => {
  const driver = new EngineDriver();
  let page: CompatPage;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await driver.launch({ headless: true, userDataDir: '/tmp/ibr-extract-content-test-profile' });
    page = new CompatPage(driver);

    const result = await new Promise<{ server: Server; url: string }>((resolve) => {
      const srv = createServer((req, res) => {
        const path = (req.url || '/').split('?')[0];
        const html = ROUTES[path];
        res.writeHead(html ? 200 : 404, { 'Content-Type': 'text/html' });
        res.end(html ?? 'not found');
      });
      srv.listen(0, '127.0.0.1', () => {
        const address = srv.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        resolve({ server: srv, url: `http://127.0.0.1:${port}` });
      });
    });
    server = result.server;
    baseUrl = result.url;
  });

  afterAll(async () => {
    await driver.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('extractContentElements', () => {
    it('captures heading levels 1-3 with non-zero bounds and headingLevel set', async () => {
      await page.goto(`${baseUrl}/content`, { waitUntil: 'load' });
      const elements = await extractContentElements(page);

      for (const level of [1, 2, 3] as const) {
        const heading = elements.find(el => el.tagName === `h${level}`);
        expect(heading, `h${level} should be captured`).toBeDefined();
        expect(heading!.contentKind).toBe('heading');
        expect(heading!.headingLevel).toBe(level);
        expect(heading!.bounds.width).toBeGreaterThan(0);
        expect(heading!.bounds.height).toBeGreaterThan(0);
      }
    }, 15000);

    it('assigns contentKind correctly per tag (paragraph/image/caption/quote)', async () => {
      await page.goto(`${baseUrl}/content`, { waitUntil: 'load' });
      const elements = await extractContentElements(page);
      const kindOf = (tag: string) => elements.find(el => el.tagName === tag)?.contentKind;

      expect(kindOf('p')).toBe('paragraph');
      expect(kindOf('img')).toBe('image');
      expect(kindOf('figcaption')).toBe('caption');
      expect(kindOf('blockquote')).toBe('quote');
    }, 15000);

    it('captures alt and src for <img>', async () => {
      await page.goto(`${baseUrl}/content`, { waitUntil: 'load' });
      const elements = await extractContentElements(page);
      const img = elements.find(el => el.tagName === 'img');

      expect(img).toBeDefined();
      expect(img!.alt).toBe('A test photo');
      expect(img!.src).toBe('/photo.png');
    }, 15000);

    it('skips zero-area elements — a display:none paragraph is absent from results', async () => {
      await page.goto(`${baseUrl}/content`, { waitUntil: 'load' });
      const elements = await extractContentElements(page);

      const hidden = elements.find(el => el.text?.includes('Hidden paragraph'));
      expect(hidden).toBeUndefined();
      // Sanity: the visible paragraph on the same page IS captured, so the
      // absence above is the zero-area guard, not a broken selector.
      const visible = elements.find(el => el.text === 'A paragraph of body text.');
      expect(visible).toBeDefined();
      expect(visible!.bounds.width).toBeGreaterThan(0);
    }, 15000);
  });

  describe('extractPageMetadata', () => {
    it('parses title, description, canonical, og: and twitter: meta tags', async () => {
      await page.goto(`${baseUrl}/metadata-full`, { waitUntil: 'load' });
      const metadata = await extractPageMetadata(page);

      expect(metadata.title).toBe('Metadata Fixture');
      expect(metadata.description).toBe('A test page description');
      expect(metadata.canonical).toBe('https://example.com/canonical');
      expect(metadata.og['title']).toBe('OG Title');
      expect(metadata.og['description']).toBe('OG Description');
      expect(metadata.og['image']).toBe('https://example.com/img.png');
      expect(metadata.twitter['card']).toBe('summary_large_image');
      expect(metadata.twitter['title']).toBe('Twitter Title');
    }, 15000);

    it('parses JSON-LD script blocks', async () => {
      await page.goto(`${baseUrl}/metadata-full`, { waitUntil: 'load' });
      const metadata = await extractPageMetadata(page);

      expect(metadata.jsonLd).toHaveLength(1);
      expect(metadata.jsonLd[0]).toEqual({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Test',
      });
    }, 15000);

    it('keeps invalid JSON-LD as a raw string instead of throwing', async () => {
      await page.goto(`${baseUrl}/metadata-invalid-jsonld`, { waitUntil: 'load' });

      const metadata = await extractPageMetadata(page);

      expect(metadata.jsonLd).toHaveLength(1);
      expect(typeof metadata.jsonLd[0]).toBe('string');
      expect(metadata.jsonLd[0]).toContain('not valid json');
    }, 15000);

    it('returns empty containers, not undefined explosions, for a page with no metadata', async () => {
      await page.goto(`${baseUrl}/no-metadata`, { waitUntil: 'load' });
      const metadata = await extractPageMetadata(page);

      expect(metadata.title).toBeUndefined();
      expect(metadata.description).toBeUndefined();
      expect(metadata.canonical).toBeUndefined();
      expect(metadata.og).toEqual({});
      expect(metadata.twitter).toEqual({});
      expect(metadata.jsonLd).toEqual([]);
    }, 15000);
  });
});
