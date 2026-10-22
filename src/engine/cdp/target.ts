/**
 * CDP Target domain — tab/target lifecycle management.
 * Forked from Spectra.
 */

import type { CdpConnection } from './connection.js'

export class TargetDomain {
  constructor(private conn: CdpConnection) {}

  async createPage(url: string, browserContextId?: string): Promise<string> {
    const result = await this.conn.send<{ targetId: string }>(
      'Target.createTarget', browserContextId ? { url, browserContextId } : { url },
    )
    return result.targetId
  }

  /**
   * A private browser context: its own cookies, storage and cache. With
   * disposeOnDetach, Chrome drops it if this connection dies without cleanup.
   */
  async createContext(): Promise<string> {
    const result = await this.conn.send<{ browserContextId: string }>(
      'Target.createBrowserContext', { disposeOnDetach: true },
    )
    return result.browserContextId
  }

  async disposeContext(browserContextId: string): Promise<void> {
    await this.conn.send('Target.disposeBrowserContext', { browserContextId })
  }

  async attach(targetId: string): Promise<string> {
    const result = await this.conn.send<{ sessionId: string }>(
      'Target.attachToTarget', { targetId, flatten: true },
    )
    return result.sessionId
  }

  async close(targetId: string): Promise<void> {
    await this.conn.send('Target.closeTarget', { targetId })
  }

  async list(): Promise<Array<{ targetId: string; type: string; url: string }>> {
    const result = await this.conn.send<{
      targetInfos: Array<{ targetId: string; type: string; url: string }>
    }>('Target.getTargets')
    return result.targetInfos
  }

  /**
   * Full `Target.getTargets` payload including `title` and `attached`.
   * `list()` narrows those away; attaching to an already-running app (see
   * `src/live/`) needs the title to pick the right window. Additive — existing
   * callers of `list()` are untouched.
   */
  async listDetailed(): Promise<TargetInfo[]> {
    const result = await this.conn.send<{ targetInfos: TargetInfo[] }>('Target.getTargets')
    return result.targetInfos
  }

  /**
   * Release a session created by `attach()` without closing the target.
   * Required when auditing a live app: the page must survive detach.
   */
  async detach(sessionId: string): Promise<void> {
    await this.conn.send('Target.detachFromTarget', { sessionId })
  }
}

export interface TargetInfo {
  targetId: string
  type: string
  title: string
  url: string
  attached: boolean
  browserContextId?: string
}
