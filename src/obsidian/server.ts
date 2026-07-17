import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Ephemeral loopback server for the generated harness.
 *
 * WHY NOT file:// — the harness inlines everything and fetches nothing, so the
 * usual objection (file:// pages cannot fetch same-directory resources, as
 * `src/engine/compat.test.ts:320` notes) does NOT apply here. The reasons that
 * do apply are narrower:
 *  - a file:// page is an OPAQUE origin, so storage, `fetch`, and same-origin
 *    checks behave unlike anywhere the plugin really runs, and a view that
 *    touches them would fail for reasons about the harness, not the view;
 *  - this repo has no file:// precedent in non-test code and does not launch
 *    Chrome with `--allow-file-access-from-files`, so it is untested ground.
 *
 * `data:` URLs and CDP `Page.setDocumentContent` were the other server-less
 * options; both share the opaque-origin problem, and setDocumentContent would
 * also mean the harness had no URL a human could open. An ordinary origin is
 * worth ~20 lines.
 */

export interface HarnessServer {
  url: string;
  port: number;
  close: () => Promise<void>;
}

/**
 * Serve one HTML document on an OS-assigned loopback port.
 * Every path returns the same document; the harness has no subresources.
 */
export async function serveHarness(html: string): Promise<HarnessServer> {
  const server: Server = createServer((req, res) => {
    // Anything but the document (e.g. a stray favicon request) gets a clean 404
    // so it does not land in scan()'s console-error capture as noise.
    if (req.url && req.url !== '/' && !req.url.startsWith('/?')) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(html);
  });

  await new Promise<void>((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolvePromise());
  });

  const address = server.address() as AddressInfo | null;
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('harness server failed to bind a loopback port');
  }

  return {
    url: `http://127.0.0.1:${address.port}/`,
    port: address.port,
    close: () =>
      new Promise<void>((resolvePromise) => {
        server.closeAllConnections?.();
        server.close(() => resolvePromise());
      }),
  };
}
