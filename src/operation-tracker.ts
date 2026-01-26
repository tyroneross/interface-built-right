import { nanoid } from 'nanoid';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

const OPERATION_PREFIX = 'op_';

/**
 * Pending operation types
 */
export type OperationType = 'screenshot' | 'type' | 'click' | 'navigate' | 'evaluate' | 'fill' | 'hover' | 'wait';

/**
 * A pending operation that's currently running
 */
export interface PendingOperation {
  id: string;
  type: OperationType;
  sessionId: string;
  startedAt: string;
  pid: number;
  command?: string;
}

/**
 * State file structure
 */
export interface OperationState {
  pending: PendingOperation[];
  lastUpdated: string;
}

/**
 * Get the path to the operations state file
 */
function getOperationsPath(outputDir: string): string {
  return join(outputDir, 'operations.json');
}

/**
 * Read the current operation state
 */
async function readState(outputDir: string): Promise<OperationState> {
  const path = getOperationsPath(outputDir);
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as OperationState;
  } catch {
    return { pending: [], lastUpdated: new Date().toISOString() };
  }
}

/**
 * Write the operation state
 */
async function writeState(outputDir: string, state: OperationState): Promise<void> {
  const path = getOperationsPath(outputDir);
  await mkdir(dirname(path), { recursive: true });
  state.lastUpdated = new Date().toISOString();
  await writeFile(path, JSON.stringify(state, null, 2));
}

/**
 * Register a new pending operation
 * Returns the operation ID
 */
export async function registerOperation(
  outputDir: string,
  options: {
    type: OperationType;
    sessionId: string;
    command?: string;
  }
): Promise<string> {
  const state = await readState(outputDir);

  // Clean up stale operations from dead processes
  state.pending = await cleanupStaleOperations(state.pending);

  const operation: PendingOperation = {
    id: `${OPERATION_PREFIX}${nanoid(8)}`,
    type: options.type,
    sessionId: options.sessionId,
    startedAt: new Date().toISOString(),
    pid: process.pid,
    command: options.command,
  };

  state.pending.push(operation);
  await writeState(outputDir, state);

  return operation.id;
}

/**
 * Mark an operation as complete (remove from pending)
 */
export async function completeOperation(
  outputDir: string,
  operationId: string
): Promise<void> {
  const state = await readState(outputDir);
  state.pending = state.pending.filter(op => op.id !== operationId);
  await writeState(outputDir, state);
}

/**
 * Get all pending operations
 */
export async function getPendingOperations(
  outputDir: string
): Promise<PendingOperation[]> {
  const state = await readState(outputDir);
  // Clean up stale operations before returning
  const activeOps = await cleanupStaleOperations(state.pending);

  // Update state if we cleaned up anything
  if (activeOps.length !== state.pending.length) {
    state.pending = activeOps;
    await writeState(outputDir, state);
  }

  return activeOps;
}

/**
 * Check if a process is still running
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove operations from dead processes
 */
async function cleanupStaleOperations(
  operations: PendingOperation[]
): Promise<PendingOperation[]> {
  return operations.filter(op => isProcessAlive(op.pid));
}

/**
 * Wait for all pending operations to complete
 * Returns true if all completed, false if timeout reached
 */
export async function waitForCompletion(
  outputDir: string,
  options: {
    timeout?: number;
    pollInterval?: number;
    onProgress?: (remaining: number) => void;
  } = {}
): Promise<boolean> {
  const timeout = options.timeout ?? 30000;
  const pollInterval = options.pollInterval ?? 500;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const pending = await getPendingOperations(outputDir);

    if (pending.length === 0) {
      return true;
    }

    if (options.onProgress) {
      options.onProgress(pending.length);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return false;
}

/**
 * Format pending operations for display
 */
export function formatPendingOperations(operations: PendingOperation[]): string {
  if (operations.length === 0) {
    return 'No pending operations';
  }

  const lines = operations.map(op => {
    const age = Math.round((Date.now() - new Date(op.startedAt).getTime()) / 1000);
    return `  ${op.id.slice(0, 11)} | ${op.type.padEnd(10)} | ${op.sessionId.slice(0, 12)} | ${age}s`;
  });

  return [
    '  ID          | Type       | Session      | Age',
    '  ----------- | ---------- | ------------ | ---',
    ...lines,
  ].join('\n');
}

/**
 * Higher-order function to wrap an async operation with tracking
 */
export function withOperationTracking<T>(
  outputDir: string,
  options: {
    type: OperationType;
    sessionId: string;
    command?: string;
  }
) {
  return async (fn: () => Promise<T>): Promise<T> => {
    const opId = await registerOperation(outputDir, options);
    try {
      return await fn();
    } finally {
      await completeOperation(outputDir, opId);
    }
  };
}
