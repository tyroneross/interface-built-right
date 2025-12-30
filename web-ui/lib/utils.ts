import type { Session, FilterType, Analysis } from './types';

/**
 * Default viewport configurations
 */
export const DEFAULT_VIEWPORTS = {
  desktop: { name: 'desktop' as const, width: 1920, height: 1080 },
  tablet: { name: 'tablet' as const, width: 768, height: 1024 },
  mobile: { name: 'mobile' as const, width: 375, height: 667 },
};

/**
 * Format a date string to a relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Format a date string to a readable format
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Filter sessions based on filter type
 */
export function filterSessions(
  sessions: Session[],
  filter: FilterType
): Session[] {
  switch (filter) {
    case 'all':
      return sessions;
    case 'changed':
      return sessions.filter(
        (s) =>
          s.status === 'compared' &&
          s.comparison &&
          !s.comparison.match
      );
    case 'broken':
      return sessions.filter(
        (s) =>
          s.status === 'compared' &&
          s.analysis?.verdict === 'LAYOUT_BROKEN'
      );
    default:
      return sessions;
  }
}

/**
 * Get a color class based on verdict
 */
export function getVerdictColor(verdict: Analysis['verdict']): string {
  switch (verdict) {
    case 'MATCH':
      return 'text-green-600';
    case 'EXPECTED_CHANGE':
      return 'text-blue-600';
    case 'UNEXPECTED_CHANGE':
      return 'text-amber-600';
    case 'LAYOUT_BROKEN':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Get a status badge color class
 */
export function getStatusColor(status: Session['status']): string {
  switch (status) {
    case 'baseline':
      return 'text-blue-600';
    case 'compared':
      return 'text-green-600';
    case 'pending':
      return 'text-amber-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Format diff percentage
 */
export function formatDiffPercent(diffPercent: number): string {
  return diffPercent < 0.01 ? '<0.01%' : `${diffPercent.toFixed(2)}%`;
}

/**
 * Generate a session name from URL if not provided
 */
export function generateSessionName(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    const pathname = urlObj.pathname.replace(/^\/|\/$/g, '');
    return pathname ? `${hostname}/${pathname}` : hostname;
  } catch {
    return url;
  }
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sort sessions by updated date (newest first)
 */
export function sortSessionsByDate(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

/**
 * Group sessions by status
 */
export function groupSessionsByStatus(sessions: Session[]): Record<Session['status'], Session[]> {
  return sessions.reduce((acc, session) => {
    if (!acc[session.status]) {
      acc[session.status] = [];
    }
    acc[session.status].push(session);
    return acc;
  }, {} as Record<Session['status'], Session[]>);
}
