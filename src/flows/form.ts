/**
 * Form Submit Flow
 *
 * Handles generic form submission with field detection.
 */

import type { Page } from 'playwright';
import { findFieldByLabel, findButton, waitForNavigation, type FlowResult, type FlowStep, type FlowOptions } from './types.js';

export interface FormField {
  /** Field name or label to search for */
  name: string;
  /** Value to fill */
  value: string;
  /** Field type (defaults to 'text') */
  type?: 'text' | 'select' | 'checkbox' | 'radio' | 'textarea';
}

export interface FlowFormOptions extends FlowOptions {
  /** Fields to fill */
  fields: FormField[];
  /** Button text to click (defaults to 'submit') */
  submitButton?: string;
  /** Selector for success message */
  successSelector?: string;
}

export interface FormResult extends FlowResult {
  /** Which fields were successfully filled */
  filledFields: string[];
  /** Which fields failed */
  failedFields: string[];
}

/**
 * Execute form submission flow
 */
export async function formFlow(
  page: Page,
  options: FlowFormOptions
): Promise<FormResult> {
  const startTime = Date.now();
  const steps: FlowStep[] = [];
  const filledFields: string[] = [];
  const failedFields: string[] = [];
  const timeout = options.timeout || 10000;

  try {
    // Step 1: Fill each field
    for (const field of options.fields) {
      const fieldType = field.type || 'text';

      let element;

      if (fieldType === 'textarea') {
        element = await page.$(`textarea[name*="${field.name}" i], textarea[id*="${field.name}" i]`);
      } else if (fieldType === 'select') {
        element = await page.$(`select[name*="${field.name}" i], select[id*="${field.name}" i]`);
      } else if (fieldType === 'checkbox' || fieldType === 'radio') {
        element = await page.$(
          `input[type="${fieldType}"][name*="${field.name}" i], ` +
          `input[type="${fieldType}"][id*="${field.name}" i]`
        );
      } else {
        element = await findFieldByLabel(page, [field.name]);
      }

      if (element) {
        try {
          if (fieldType === 'select') {
            await element.selectOption(field.value);
          } else if (fieldType === 'checkbox') {
            if (field.value === 'true' || field.value === '1') {
              await element.check();
            } else {
              await element.uncheck();
            }
          } else if (fieldType === 'radio') {
            await element.check();
          } else {
            await element.fill(field.value);
          }
          filledFields.push(field.name);
          steps.push({ action: `fill ${field.name}`, success: true });
        } catch (err) {
          failedFields.push(field.name);
          steps.push({
            action: `fill ${field.name}`,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      } else {
        failedFields.push(field.name);
        steps.push({
          action: `fill ${field.name}`,
          success: false,
          error: 'Field not found',
        });
      }
    }

    // Step 2: Submit the form
    const submitPatterns = options.submitButton
      ? [options.submitButton]
      : ['submit', 'save', 'send', 'continue', 'confirm'];

    const submitButton = await findButton(page, submitPatterns);

    if (!submitButton) {
      return {
        success: false,
        filledFields,
        failedFields,
        steps,
        error: 'Could not find submit button',
        duration: Date.now() - startTime,
      };
    }

    await submitButton.click();
    steps.push({ action: 'click submit', success: true });

    // Step 3: Wait for response
    await waitForNavigation(page, timeout);
    steps.push({ action: 'wait for response', success: true });

    // Step 4: Check for success indicator
    let success = true;
    if (options.successSelector) {
      const successElement = await page.$(options.successSelector);
      success = !!successElement;
      steps.push({
        action: 'verify success',
        success,
      });
    }

    // Also check for error indicators
    const errorElement = await page.$(
      '[class*="error"]:not([class*="error-boundary"]), ' +
      '[role="alert"][class*="error"], ' +
      '.form-error, .validation-error'
    );

    if (errorElement) {
      const errorText = await errorElement.textContent();
      success = false;
      steps.push({
        action: 'check for errors',
        success: false,
        error: errorText?.trim() || 'Form has errors',
      });
    }

    return {
      success: success && failedFields.length === 0,
      filledFields,
      failedFields,
      steps,
      duration: Date.now() - startTime,
    };

  } catch (error) {
    return {
      success: false,
      filledFields,
      failedFields,
      steps,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}
