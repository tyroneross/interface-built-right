'use client';

import { useState } from 'react';
import {
  createSession,
  deleteSession,
  checkSession,
  acceptSession,
  batchCheck,
} from '../api';
import type {
  CreateSessionRequest,
  Session,
  ComparisonReport,
  BatchCheckResponse,
} from '../types';

export interface UseSessionActionsResult {
  creating: boolean;
  deleting: boolean;
  checking: boolean;
  accepting: boolean;
  batchChecking: boolean;
  error: string | null;
  create: (request: CreateSessionRequest) => Promise<Session | null>;
  remove: (id: string) => Promise<boolean>;
  check: (id: string) => Promise<ComparisonReport | null>;
  accept: (id: string) => Promise<Session | null>;
  checkMultiple: (sessionIds: string[]) => Promise<BatchCheckResponse | null>;
}

export function useSessionActions(): UseSessionActionsResult {
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [batchChecking, setBatchChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (
    request: CreateSessionRequest
  ): Promise<Session | null> => {
    try {
      setCreating(true);
      setError(null);
      const session = await createSession(request);
      return session;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      setError(message);
      console.error('Error creating session:', err);
      return null;
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string): Promise<boolean> => {
    try {
      setDeleting(true);
      setError(null);
      await deleteSession(id);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete session';
      setError(message);
      console.error('Error deleting session:', err);
      return false;
    } finally {
      setDeleting(false);
    }
  };

  const check = async (id: string): Promise<ComparisonReport | null> => {
    try {
      setChecking(true);
      setError(null);
      const report = await checkSession(id);
      return report;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check session';
      setError(message);
      console.error('Error checking session:', err);
      return null;
    } finally {
      setChecking(false);
    }
  };

  const accept = async (id: string): Promise<Session | null> => {
    try {
      setAccepting(true);
      setError(null);
      const session = await acceptSession(id);
      return session;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept session';
      setError(message);
      console.error('Error accepting session:', err);
      return null;
    } finally {
      setAccepting(false);
    }
  };

  const checkMultiple = async (
    sessionIds: string[]
  ): Promise<BatchCheckResponse | null> => {
    try {
      setBatchChecking(true);
      setError(null);
      const response = await batchCheck(sessionIds);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to batch check sessions';
      setError(message);
      console.error('Error batch checking sessions:', err);
      return null;
    } finally {
      setBatchChecking(false);
    }
  };

  return {
    creating,
    deleting,
    checking,
    accepting,
    batchChecking,
    error,
    create,
    remove,
    check,
    accept,
    checkMultiple,
  };
}
