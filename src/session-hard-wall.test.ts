import { describe, expect, it } from 'vitest';
import {
  classifySessionHardWall,
  formatUserActionRequired,
  sessionAttemptKey,
  sessionWallDisplayUrl,
  type SessionHardWallObservation,
} from './session-hard-wall.js';

function observation(overrides: Partial<SessionHardWallObservation> = {}): SessionHardWallObservation {
  return {
    requestedUrl: 'https://example.com/private/data-room?access=abc',
    currentUrl: 'https://example.com/private/data-room?access=abc',
    title: 'Data room',
    bodyText: 'Private investment materials',
    hasPasswordInput: false,
    hasEmailInput: false,
    hasOneTimeCodeInput: false,
    hasCaptcha: false,
    ...overrides,
  };
}

describe('session hard-wall policy', () => {
  it('detects a redirected sign-in wall and tells the user to act', () => {
    const wall = classifySessionHardWall(observation({
      currentUrl: 'https://auth.example.com/login?return_to=%2Fprivate',
      bodyText: 'Continue to investment\nEmail\nContinue with Google',
      hasEmailInput: true,
    }), 'chrome:local', new Date('2026-08-12T20:00:00Z'));

    expect(wall).toMatchObject({
      kind: 'authentication',
      strategyKey: 'chrome:local',
      detectedAt: '2026-08-12T20:00:00.000Z',
    });
    expect(formatUserActionRequired(wall!)).toContain('IBR stopped');
    expect(formatUserActionRequired(wall!)).toContain('will not type, submit, or retry');
  });

  it('detects CAPTCHA and identity-verification walls before auth heuristics', () => {
    expect(classifySessionHardWall(observation({ hasCaptcha: true }), 'chrome:local')?.kind).toBe('captcha');
    expect(classifySessionHardWall(observation({
      currentUrl: 'https://example.com/verify',
      bodyText: 'Enter the verification code',
      hasOneTimeCodeInput: true,
    }), 'chrome:local')?.kind).toBe('identity-verification');
  });

  it('does not block an ordinary page that merely contains a sign-in link', () => {
    expect(classifySessionHardWall(observation({
      bodyText: 'Read the report. Sign in for optional personalization.',
    }), 'chrome:local')).toBeNull();
  });

  it('deduplicates the same URL and strategy but allows a different strategy', () => {
    const chrome = sessionAttemptKey('https://example.com/a#section', 'chrome:local');
    const chromeAgain = sessionAttemptKey('https://example.com/a', 'CHROME:LOCAL');
    const safari = sessionAttemptKey('https://example.com/a', 'safari:webdriver');

    expect(chrome).toBe(chromeAgain);
    expect(safari).not.toBe(chrome);
  });

  it('does not expose URL credentials, query tokens, or fragments in prompts', () => {
    const privateUrl = 'https://user:pass@example.com/sign-in?accessLink=secret#challenge';
    expect(sessionWallDisplayUrl(privateUrl)).toBe('https://example.com/sign-in');

    const wall = classifySessionHardWall(observation({
      currentUrl: privateUrl,
      bodyText: 'Sign in with email',
      hasEmailInput: true,
    }), 'chrome:mcp:headed');
    const output = formatUserActionRequired(wall!);

    expect(output).not.toContain('secret');
    expect(output).not.toContain('user:pass');
    expect(output).not.toContain('#challenge');
  });
});
