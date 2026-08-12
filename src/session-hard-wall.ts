/**
 * Fail-closed detection for browser states that require a human.
 *
 * IBR may try a different browser or transport after a wall, but it must not
 * repeat the same URL + strategy or type/submit credentials on the user's
 * behalf. The caller owns persistence of the returned attempt key.
 */

export type SessionHardWallKind =
  | 'authentication'
  | 'identity-verification'
  | 'captcha'
  | 'access-denied'
  | 'consent';

export interface SessionHardWallObservation {
  requestedUrl: string;
  currentUrl: string;
  title: string;
  bodyText: string;
  hasPasswordInput: boolean;
  hasEmailInput: boolean;
  hasOneTimeCodeInput: boolean;
  hasCaptcha: boolean;
}

export interface SessionHardWall {
  kind: SessionHardWallKind;
  requestedUrl: string;
  currentUrl: string;
  strategyKey: string;
  attemptKey: string;
  detectedAt: string;
  prompt: string;
}

export interface EvaluatingPage {
  evaluate(expression: string): Promise<unknown>;
}

const AUTH_URL = /(?:^|[/_?&.-])(login|log-in|signin|sign-in|authenticate|authentication|oauth)(?:$|[/_?&=.-])/i;
const AUTH_TEXT = /\b(sign in|log in|continue with google|continue to (?:investment|application)|enter your (?:email|password))\b/i;
const VERIFY_TEXT = /\b(verification (?:code|link)|verify your (?:email|identity)|resend verification|one[- ]time (?:code|password))\b/i;
const CAPTCHA_TEXT = /\b(captcha|recaptcha|prove you(?:'|’)re human|verify you(?:'|’)re human|security challenge)\b/i;
const ACCESS_TEXT = /\b(access denied|permission required|not authorized|unauthorized|request access|you do not have access)\b/i;
const CONSENT_TEXT = /\b(accept (?:the )?(?:terms|cookies)|consent required|agree and continue)\b/i;

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

export function sessionWallDisplayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '[redacted URL]';
  }
}

export function sessionAttemptKey(requestedUrl: string, strategyKey: string): string {
  return `${strategyKey.trim().toLowerCase()}::${normalizeUrl(requestedUrl)}`;
}

export function classifySessionHardWall(
  observation: SessionHardWallObservation,
  strategyKey: string,
  now = new Date(),
): SessionHardWall | null {
  const body = observation.bodyText.slice(0, 20_000);
  let kind: SessionHardWallKind | null = null;

  if (observation.hasCaptcha || CAPTCHA_TEXT.test(body)) {
    kind = 'captcha';
  } else if (observation.hasOneTimeCodeInput || VERIFY_TEXT.test(body)) {
    kind = 'identity-verification';
  } else if (
    AUTH_URL.test(observation.currentUrl)
    && (observation.hasPasswordInput || observation.hasEmailInput || AUTH_TEXT.test(body))
  ) {
    kind = 'authentication';
  } else if (ACCESS_TEXT.test(body)) {
    kind = 'access-denied';
  } else if (CONSENT_TEXT.test(body)) {
    kind = 'consent';
  }

  if (!kind) return null;

  const requestedUrl = normalizeUrl(observation.requestedUrl);
  const currentUrl = normalizeUrl(observation.currentUrl);
  return {
    kind,
    requestedUrl,
    currentUrl,
    strategyKey,
    attemptKey: sessionAttemptKey(requestedUrl, strategyKey),
    detectedAt: now.toISOString(),
    prompt: hardWallPrompt(kind, strategyKey),
  };
}

export async function inspectSessionHardWall(
  page: EvaluatingPage,
  requestedUrl: string,
  strategyKey: string,
): Promise<SessionHardWall | null> {
  const observation = await page.evaluate(`(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    return {
      requestedUrl: '',
      currentUrl: window.location.href,
      title: document.title || '',
      bodyText: document.body?.innerText || '',
      hasPasswordInput: inputs.some((input) => input.type === 'password'),
      hasEmailInput: inputs.some((input) => input.type === 'email' || /email/i.test(input.name || input.autocomplete || '')),
      hasOneTimeCodeInput: inputs.some((input) => input.autocomplete === 'one-time-code' || /otp|verification.?code/i.test(input.name || input.id)),
      hasCaptcha: Boolean(document.querySelector('[class*="captcha" i], [id*="captcha" i], iframe[src*="captcha" i], textarea[name="g-recaptcha-response"]')),
    };
  })()`) as SessionHardWallObservation;

  return classifySessionHardWall({ ...observation, requestedUrl }, strategyKey);
}

export function hardWallPrompt(kind: SessionHardWallKind, strategyKey = ''): string {
  if (strategyKey.toLowerCase().includes('headless')) {
    return 'IBR stopped and will not retry this URL with the same headless strategy. Start one visible browser strategy, enter the required information yourself, then tell the agent to continue. IBR will not type or submit credentials.';
  }

  const action = kind === 'captcha'
    ? 'Complete the human-verification challenge in the open browser.'
    : kind === 'access-denied'
      ? 'Resolve access in the open browser or ask the site owner for permission.'
      : kind === 'consent'
        ? 'Review and complete the consent step in the open browser.'
        : 'Enter the required sign-in or verification information in the open browser.';

  return `${action} IBR stopped and will not type, submit, or retry this URL with the same browser strategy. After you finish, tell the agent to continue; a meaningfully different browser strategy may be tried once.`;
}

export function formatUserActionRequired(wall: SessionHardWall, repeatBlocked = false): string {
  return [
    'USER_ACTION_REQUIRED',
    `Wall: ${wall.kind}`,
    `Current URL: ${sessionWallDisplayUrl(wall.currentUrl)}`,
    repeatBlocked ? 'Repeat blocked: this URL and browser strategy already reached the same hard wall.' : 'Automation stopped at the first hard wall.',
    wall.prompt,
  ].join('\n');
}
