/**
 * PageLike — structural interface that both Playwright's Page and CompatPage satisfy.
 * Use this as the parameter type in functions that need to work with either.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ElementHandleLike {
  screenshot(options?: { path?: string; type?: string }): Promise<Buffer>
  textContent(): Promise<string | null>
  boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null>
  getAttribute?(name: string): Promise<string | null>
}

export interface LocatorLike {
  filter(options: { visible?: boolean }): LocatorLike
  first(): LocatorLike
  click(options?: { timeout?: number; force?: boolean }): Promise<void>
  fill(text: string, options?: { timeout?: number }): Promise<void>
  focus(options?: { timeout?: number }): Promise<void>
  press(key: string, options?: { timeout?: number }): Promise<void>
  pressSequentially(text: string, options?: { delay?: number; timeout?: number }): Promise<void>
  waitFor(options?: { state?: string; timeout?: number }): Promise<void>
}

export interface PageLike {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<any>
  evaluate(fn: any, ...args: any[]): Promise<any>
  $(selector: string): Promise<ElementHandleLike | null>
  $$(selector: string): Promise<ElementHandleLike[]>
  screenshot(options?: { path?: string; fullPage?: boolean; type?: string }): Promise<Buffer>
  addStyleTag(options: { content: string }): Promise<any>
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<ElementHandleLike | null>
  waitForTimeout(ms: number): Promise<void>
  content(): Promise<string>
  title(): Promise<string>
  textContent(selector: string): Promise<string | null>
  getAttribute?(selector: string, name: string): Promise<string | null>
  click?(selector: string, options?: { timeout?: number }): Promise<void>
  fill?(selector: string, value: string): Promise<void>
  type?(selector: string, text: string, options?: { delay?: number }): Promise<void>
  hover?(selector: string, options?: { timeout?: number }): Promise<void>
  check?(selector: string): Promise<void>
  uncheck?(selector: string): Promise<void>
  selectOption?(selector: string, value: string): Promise<any>
  locator?(selector: string): LocatorLike
  on?(event: string, handler: any): void
  url?(): string
  keyboard?: { press(key: string): Promise<void> }
  innerText?(selector: string): Promise<string>
  waitForNavigation?(): Promise<any>
  waitForLoadState?(state?: string, options?: { timeout?: number }): Promise<void>
}
