import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LiveAttachError,
  resolveLiveWsEndpoint,
  selectTarget,
  toLiveTarget,
  type LiveTarget,
} from './attach.js';

function target(over: Partial<LiveTarget> = {}): LiveTarget {
  return {
    targetId: 'T1',
    type: 'page',
    title: 'Writers Block - personal-llm-wiki - Obsidian 1.13.4',
    url: 'app://obsidian.md/index.html',
    attached: false,
    ...over,
  };
}

describe('selectTarget', () => {
  const wiki = target();
  const workWiki = target({ targetId: 'T2', title: 'Daily Planner - WorkWiki - Obsidian 1.13.4' });
  const worker = target({ targetId: 'T3', type: 'worker', title: '', url: '' });

  it('matches a page by case-insensitive title substring', () => {
    expect(selectTarget([wiki, workWiki, worker], { targetTitle: 'personal-llm-wiki' }))
      .toBe(wiki);
    expect(selectTarget([wiki, workWiki, worker], { targetTitle: 'DAILY PLANNER' }))
      .toBe(workWiki);
  });

  it('matches by url substring', () => {
    const external = target({ targetId: 'T4', title: 'Docs', url: 'https://example.com/docs' });
    expect(selectTarget([wiki, external], { targetUrl: 'example.com' })).toBe(external);
  });

  it('applies title and url filters together', () => {
    expect(selectTarget([wiki, workWiki], {
      targetTitle: 'Writers Block',
      targetUrl: 'obsidian.md',
    })).toBe(wiki);
  });

  it('takes the only page target when no filter is given', () => {
    expect(selectTarget([wiki, worker], {})).toBe(wiki);
  });

  it('refuses to guess when several page targets match', () => {
    // Picking the wrong window means auditing someone else's live editor.
    expect(() => selectTarget([wiki, workWiki], {})).toThrow(LiveAttachError);
    expect(() => selectTarget([wiki, workWiki], {})).toThrow(/refusing to guess/i);
  });

  it('lists the available page targets when nothing matches', () => {
    let message = '';
    try {
      selectTarget([wiki, workWiki], { targetTitle: 'nope' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/No page target matched/);
    expect(message).toContain('personal-llm-wiki');
    expect(message).toContain('WorkWiki');
  });

  it('errors clearly when the browser exposes no page targets', () => {
    expect(() => selectTarget([worker], {})).toThrow(/no page targets/i);
  });

  it('honours an exact target id, including non-page types', () => {
    expect(selectTarget([wiki, worker], { targetId: 'T3' })).toBe(worker);
    expect(() => selectTarget([wiki], { targetId: 'missing' })).toThrow(/No target with id/);
  });
});

describe('toLiveTarget', () => {
  it('fills in missing title/url rather than emitting undefined', () => {
    const info = { targetId: 'X', type: 'page' } as never;
    expect(toLiveTarget(info)).toEqual({
      targetId: 'X', type: 'page', title: '', url: '', attached: false,
    });
  });
});

describe('resolveLiveWsEndpoint', () => {
  it('passes an explicit ws endpoint straight through without probing', async () => {
    const out = await resolveLiveWsEndpoint({ wsEndpoint: 'ws://127.0.0.1:9222/devtools/browser/abc' });
    expect(out.wsEndpoint).toBe('ws://127.0.0.1:9222/devtools/browser/abc');
  });

  it('says which endpoint is dead and what to do about it', async () => {
    // Port 1 is never a CDP server, so this exercises the dead-port path
    // without depending on anything being (or not being) up on 9222.
    let message = '';
    try {
      await resolveLiveWsEndpoint({ cdpUrl: 'http://127.0.0.1:1', probeTimeoutMs: 1500 });
    } catch (error) {
      expect(error).toBeInstanceOf(LiveAttachError);
      message = (error as Error).message;
    }
    // The pre-existing engine path surfaced a bare `TypeError: fetch failed`.
    expect(message).not.toMatch(/^TypeError/);
    expect(message).toContain('http://127.0.0.1:1');
    expect(message).toMatch(/Nothing is listening/);
    expect(message).toMatch(/--remote-debugging-port=9222/);
    expect(message).toMatch(/curl http:\/\/127\.0\.0\.1:1\/json\/version/);
  }, 15_000);

  it('names the missing flag when no endpoint at all is supplied', async () => {
    // The resolver falls back to IBR_CDP_URL / IBR_WS_ENDPOINT, so the
    // no-endpoint case only exists with both unset.
    const saved = { cdp: process.env.IBR_CDP_URL, ws: process.env.IBR_WS_ENDPOINT };
    delete process.env.IBR_CDP_URL;
    delete process.env.IBR_WS_ENDPOINT;
    try {
      await expect(
        resolveLiveWsEndpoint({ cdpUrl: undefined, wsEndpoint: undefined }),
      ).rejects.toThrow(/--cdp-url/);
    } finally {
      if (saved.cdp !== undefined) process.env.IBR_CDP_URL = saved.cdp;
      if (saved.ws !== undefined) process.env.IBR_WS_ENDPOINT = saved.ws;
    }
  });
});

describe('read-only contract', () => {
  const stripComments = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const sources = () => ['attach.ts', 'measure.ts']
    .map((f) => stripComments(readFileSync(join(__dirname, f), 'utf8')));

  it('never reaches for a CDP verb that would mutate the live app', () => {
    // The whole point of this module is that it attaches to someone's running
    // editor. Creating, navigating, reloading or closing the target is out of
    // bounds; this test fails the moment such a call is introduced.
    const banned = [
      'Target.createTarget',
      'Target.closeTarget',
      'Page.navigate',
      'Page.reload',
      'Page.close',
      'Browser.close',
    ];
    for (const source of sources()) {
      for (const verb of banned) {
        expect(source).not.toContain(verb);
      }
    }
  });

  it('only forces a viewport size in a form that also puts it back', () => {
    // `Emulation.setDeviceMetricsOverride` was banned outright until the width
    // sweep needed it: a responsive rule can only be checked at the width it
    // fires at, and a desktop window cannot be resized past the display. It is
    // now allowed under one condition — the same file must clear it. Leaving
    // someone's editor pinned at an emulated width is the failure this guards.
    // The revert itself is proved behaviourally in measure.test.ts ("clears the
    // override even when the measurement throws"); this only stops a future
    // edit from introducing a set without a clear.
    for (const source of sources()) {
      if (source.includes('Emulation.setDeviceMetricsOverride')) {
        expect(source).toContain('Emulation.clearDeviceMetricsOverride');
      }
    }
  });
});
