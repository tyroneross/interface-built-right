/**
 * Token-efficient AX tree compression.
 * Keeps all interactive elements, summarizes non-interactive ones as role counts.
 * Reduces context token usage for pages with 100+ elements.
 */

export interface CompressedSnapshot {
  interactive: Array<{ id: string; role: string; label: string; actions: string[] }>
  collapsed: Record<string, number>  // role → count
  totalElements: number
  interactiveCount: number
  compressed: boolean
}

const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'textbox', 'checkbox', 'tab', 'menuitem', 'select', 'slider', 'switch',
])

/**
 * Compress an element list for LLM consumption.
 * Elements with actions are kept; others are summarized by role count.
 * @param elements Full element list from AX tree
 * @param threshold Compress when element count exceeds this (default: 80)
 */
export function compressSnapshot(
  elements: Array<{ id: string; role: string; label: string; actions?: string[]; enabled?: boolean }>,
  threshold = 80
): CompressedSnapshot {
  if (elements.length <= threshold) {
    return {
      interactive: elements.map(e => ({
        id: e.id,
        role: e.role,
        label: e.label,
        actions: e.actions ?? [],
      })),
      collapsed: {},
      totalElements: elements.length,
      interactiveCount: elements.length,
      compressed: false,
    }
  }

  const interactive: CompressedSnapshot['interactive'] = []
  const collapsed: Record<string, number> = {}

  for (const el of elements) {
    const isInteractive = (el.actions && el.actions.length > 0) ||
      INTERACTIVE_ROLES.has(el.role)

    if (isInteractive) {
      interactive.push({
        id: el.id,
        role: el.role,
        label: el.label,
        actions: el.actions ?? [],
      })
    } else {
      collapsed[el.role] = (collapsed[el.role] || 0) + 1
    }
  }

  return {
    interactive,
    collapsed,
    totalElements: elements.length,
    interactiveCount: interactive.length,
    compressed: true,
  }
}

/**
 * Format compressed snapshot as concise text for LLM context.
 */
export function formatCompressed(snapshot: CompressedSnapshot): string {
  if (!snapshot.compressed) {
    return snapshot.interactive
      .map(e => `[${e.id}] ${e.role} "${e.label}"${e.actions.length ? ` actions:[${e.actions.join(',')}]` : ''}`)
      .join('\n')
  }

  const lines: string[] = [
    `[${snapshot.interactiveCount} interactive elements of ${snapshot.totalElements} total]`,
    '',
  ]

  for (const el of snapshot.interactive) {
    lines.push(`[${el.id}] ${el.role} "${el.label}"${el.actions.length ? ` actions:[${el.actions.join(',')}]` : ''}`)
  }

  if (Object.keys(snapshot.collapsed).length > 0) {
    const summary = Object.entries(snapshot.collapsed)
      .sort((a, b) => b[1] - a[1])
      .map(([role, count]) => `${count} ${role}`)
      .join(', ')
    lines.push('', `[collapsed: ${summary}]`)
  }

  return lines.join('\n')
}
