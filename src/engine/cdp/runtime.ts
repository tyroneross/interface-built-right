/**
 * CDP Runtime domain — JavaScript evaluation in page context.
 * Forked from Spectra — extended with callFunctionOn for function+args evaluation.
 */

import type { CdpConnection } from './connection.js'

export class RuntimeDomain {
  constructor(
    private conn: CdpConnection,
    private sessionId?: string,
  ) {}

  /**
   * Evaluate a JavaScript expression string in the page context.
   */
  async evaluate(expression: string): Promise<unknown> {
    const result = await this.conn.send<{
      result: { type: string; value: unknown; objectId?: string }
      exceptionDetails?: { text: string; exception?: { description: string } }
    }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    }, this.sessionId)

    if (result.exceptionDetails) {
      const msg = result.exceptionDetails.exception?.description
        ?? result.exceptionDetails.text
      throw new Error(`Evaluation failed: ${msg}`)
    }

    return result.result.value
  }

  /**
   * Call a function with structured arguments in the page context.
   * This is the CDP equivalent of Playwright's page.evaluate(fn, ...args).
   *
   * The function declaration is serialized as a string, and arguments
   * are passed as CDP CallArgument objects (primitives by value).
   *
   * Usage:
   *   await runtime.callFunctionOn(
   *     '(selector, prop) => getComputedStyle(document.querySelector(selector))[prop]',
   *     ['.header', 'color']
   *   )
   */
  async callFunctionOn(
    functionDeclaration: string,
    args?: unknown[],
  ): Promise<unknown> {
    // We need an execution context, so evaluate on the document
    const docResult = await this.conn.send<{
      result: { objectId: string }
    }>('Runtime.evaluate', {
      expression: 'document',
      returnByValue: false,
    }, this.sessionId)

    const callArgs = args?.map((arg) => {
      if (arg === undefined) return { unserializableValue: 'undefined' }
      return { value: arg }
    })

    const result = await this.conn.send<{
      result: { type: string; value: unknown; objectId?: string }
      exceptionDetails?: { text: string; exception?: { description: string } }
    }>('Runtime.callFunctionOn', {
      functionDeclaration,
      objectId: docResult.result.objectId,
      arguments: callArgs,
      returnByValue: true,
      awaitPromise: true,
    }, this.sessionId)

    if (result.exceptionDetails) {
      const msg = result.exceptionDetails.exception?.description
        ?? result.exceptionDetails.text
      throw new Error(`callFunctionOn failed: ${msg}`)
    }

    return result.result.value
  }

  /**
   * Enable the Runtime domain to receive events (like consoleAPICalled).
   */
  async enable(): Promise<void> {
    await this.conn.send('Runtime.enable', {}, this.sessionId)
  }
}
