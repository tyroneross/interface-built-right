/**
 * Login Flow
 *
 * Handles common login patterns with semantic field detection.
 */

import type { Page } from 'playwright';
import { findFieldByLabel, findButton, waitForNavigation, type FlowResult, type FlowStep, type FlowOptions } from './types.js';
import { detectAuthState } from '../semantic/state-detector.js';

export interface FlowLoginOptions extends FlowOptions {
  /** Email or username */
  email: string;
  /** Password */
  password: string;
  /** What indicates successful login (intent like 'dashboard' or selector) */
  successIndicator?: string;
  /** Whether to check "remember me" if present */
  rememberMe?: boolean;
}

export interface LoginResult extends FlowResult {
  /** Whether user is now authenticated */
  authenticated: boolean;
  /** Detected username after login */
  username?: string;
}

/**
 * Execute login flow
 */
export async function loginFlow(
  page: Page,
  options: FlowLoginOptions
): Promise<LoginResult> {
  const startTime = Date.now();
  const steps: FlowStep[] = [];
  const timeout = options.timeout || 30000;

  try {
    // Step 1: Find email/username field
    const emailField = await findFieldByLabel(page, [
      'email',
      'username',
      'login',
      'user',
      'mail',
    ]);

    if (!emailField) {
      return {
        success: false,
        authenticated: false,
        steps,
        error: 'Could not find email/username field',
        duration: Date.now() - startTime,
      };
    }

    await emailField.fill(options.email);
    steps.push({ action: 'fill email/username', success: true });

    // Step 2: Find password field
    const passwordField = await page.$('input[type="password"]');

    if (!passwordField) {
      return {
        success: false,
        authenticated: false,
        steps,
        error: 'Could not find password field',
        duration: Date.now() - startTime,
      };
    }

    await passwordField.fill(options.password);
    steps.push({ action: 'fill password', success: true });

    // Step 3: Handle remember me (optional)
    if (options.rememberMe) {
      const rememberCheckbox = await page.$(
        'input[type="checkbox"][name*="remember"], ' +
        'input[type="checkbox"][id*="remember"], ' +
        'label:has-text("remember") input[type="checkbox"]'
      );
      if (rememberCheckbox) {
        await rememberCheckbox.check();
        steps.push({ action: 'check remember me', success: true });
      }
    }

    // Step 4: Find and click submit button
    const submitButton = await findButton(page, [
      'login',
      'sign in',
      'log in',
      'submit',
      'continue',
    ]);

    if (!submitButton) {
      return {
        success: false,
        authenticated: false,
        steps,
        error: 'Could not find submit button',
        duration: Date.now() - startTime,
      };
    }

    await submitButton.click();
    steps.push({ action: 'click submit', success: true });

    // Step 5: Wait for navigation/response
    await waitForNavigation(page, timeout);
    steps.push({ action: 'wait for response', success: true });

    // Step 6: Verify authentication
    const authState = await detectAuthState(page);
    const authenticated = authState.authenticated === true;

    // Check for success indicator if provided
    let successVerified = authenticated;
    if (options.successIndicator && authenticated) {
      // Check if it's a selector or an intent
      if (options.successIndicator.startsWith('.') ||
          options.successIndicator.startsWith('#') ||
          options.successIndicator.startsWith('[')) {
        // It's a selector
        const indicator = await page.$(options.successIndicator);
        successVerified = !!indicator;
      }
      // For intents, we'd need to check page intent - simplified for now
    }

    steps.push({
      action: 'verify authentication',
      success: successVerified,
    });

    return {
      success: successVerified,
      authenticated: successVerified,
      username: authState.username,
      steps,
      duration: Date.now() - startTime,
    };

  } catch (error) {
    return {
      success: false,
      authenticated: false,
      steps,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}
