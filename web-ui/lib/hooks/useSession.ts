'use client';

import { useState, useEffect } from 'react';
import { getSession } from '../api';
import type { Session } from '../types';

export interface UseSessionResult {
  session: Session | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSession(id: string | null): UseSessionResult {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = async () => {
    if (!id) {
      setSession(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getSession(id);
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch session');
      console.error('Error fetching session:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [id]);

  return {
    session,
    loading,
    error,
    refetch: fetchSession,
  };
}
