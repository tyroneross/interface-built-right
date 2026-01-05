'use client';

import { useEffect, useState } from 'react';

interface WorkflowItem {
  id: string;
  name: string;
  url: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  startedAt: string;
  completedAt?: string;
  verdict?: 'MATCH' | 'EXPECTED_CHANGE' | 'UNEXPECTED_CHANGE' | 'LAYOUT_BROKEN';
  diffPercent?: number;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkflows();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchWorkflows, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchWorkflows() {
    try {
      const res = await fetch('/api/workflows');
      if (!res.ok) throw new Error('Failed to fetch workflows');
      const data = await res.json();
      setWorkflows(data.workflows || []);
      setError(null);
    } catch (err) {
      // If API doesn't exist yet, show empty state
      setWorkflows([]);
      setError(null);
    } finally {
      setLoading(false);
    }
  }

  const runningWorkflows = workflows.filter(w => w.status === 'running');
  const recentWorkflows = workflows.filter(w => w.status !== 'running');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-medium text-gray-900">Workflows</h2>
        <p className="mt-1 text-sm text-gray-500">
          Track running and completed visual checks
        </p>
      </div>

      {/* Running checks section */}
      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">
          Running Checks
        </h3>

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ) : runningWorkflows.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
            <p className="text-gray-500">No checks currently running</p>
            <p className="text-sm text-gray-400 mt-1">
              Run <code className="bg-gray-100 px-1 rounded">npx ibr check</code> to start a comparison
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {runningWorkflows.map(workflow => (
              <WorkflowRow key={workflow.id} workflow={workflow} />
            ))}
          </div>
        )}
      </section>

      {/* Recent checks section */}
      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">
          Recent Checks
        </h3>

        {recentWorkflows.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
            <p className="text-gray-500">No recent checks</p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {recentWorkflows.slice(0, 20).map(workflow => (
              <WorkflowRow key={workflow.id} workflow={workflow} />
            ))}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="border-t border-gray-200 pt-6">
        <h3 className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">
          Quick Actions
        </h3>
        <div className="flex gap-4">
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            View Sessions
          </button>
          <button
            onClick={() => navigator.clipboard.writeText('npx ibr check')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Copy Check Command
          </button>
        </div>
      </section>
    </div>
  );
}

function WorkflowRow({ workflow }: { workflow: WorkflowItem }) {
  const statusColors = {
    running: 'text-blue-600 bg-blue-50',
    completed: 'text-green-600 bg-green-50',
    failed: 'text-red-600 bg-red-50',
    pending: 'text-gray-600 bg-gray-50',
  };

  const verdictColors = {
    MATCH: 'text-green-600',
    EXPECTED_CHANGE: 'text-blue-600',
    UNEXPECTED_CHANGE: 'text-amber-600',
    LAYOUT_BROKEN: 'text-red-600',
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[workflow.status]}`}>
              {workflow.status === 'running' && (
                <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {workflow.status}
            </span>
            <span className="font-medium text-gray-900 truncate">
              {workflow.name || workflow.id}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 truncate">{workflow.url}</p>
        </div>

        <div className="ml-4 flex-shrink-0 text-right">
          {workflow.verdict && (
            <span className={`text-sm font-medium ${verdictColors[workflow.verdict]}`}>
              {workflow.verdict.replace('_', ' ')}
            </span>
          )}
          {workflow.diffPercent !== undefined && (
            <p className="text-xs text-gray-500">{workflow.diffPercent.toFixed(1)}% diff</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {formatTime(workflow.startedAt)}
          </p>
        </div>
      </div>

      {workflow.status === 'completed' && (
        <div className="mt-2">
          <a
            href={`/sessions/${workflow.id}`}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View comparison →
          </a>
        </div>
      )}
    </div>
  );
}
