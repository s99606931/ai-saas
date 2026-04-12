// 오프라인 AI 처리 큐 -- FR-N390.1~FR-N390.5
// Design Ref: MTU-N390 | CSAP: D-06

export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead';

export interface QueueItem {
  readonly itemId: string;
  readonly tenantId: string;
  readonly payload: Record<string, unknown>;
  readonly priority: number;
  readonly createdAt: number;
  status: QueueItemStatus;
  attempts: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  error?: string;
}

export interface QueueConfig {
  readonly maxAttempts: number;
  readonly initialBackoffMs: number;
  readonly maxBackoffMs: number;
  readonly maxCapacity: number;
}

export interface QueueAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const queue: QueueItem[] = [];
const deadLetter: QueueItem[] = [];
const auditLog: QueueAuditEntry[] = [];
let networkOnline = true;

function recordAudit(entry: Omit<QueueAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getQueueAuditLog(tenantId: string): readonly QueueAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

export function setNetworkStatus(online: boolean): void {
  networkOnline = online;
}

export function isOnline(): boolean {
  return networkOnline;
}

export function enqueue(
  tenantId: string,
  payload: Record<string, unknown>,
  priority = 5,
  config: QueueConfig = { maxAttempts: 5, initialBackoffMs: 1000, maxBackoffMs: 60_000, maxCapacity: 1000 },
): QueueItem {
  const tenantItems = queue.filter((i) => i.tenantId === tenantId);
  if (tenantItems.length >= config.maxCapacity) {
    throw new Error(`큐 포화: ${tenantId}`);
  }
  const item: QueueItem = {
    itemId: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    payload,
    priority,
    createdAt: Date.now(),
    status: 'pending',
    attempts: 0,
  };
  queue.push(item);
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'ITEM_ENQUEUED',
    target: item.itemId,
    details: { priority },
  });
  return item;
}

export function computeBackoff(attempt: number, config: QueueConfig): number {
  const backoff = config.initialBackoffMs * Math.pow(2, attempt);
  return Math.min(backoff, config.maxBackoffMs);
}

export function dequeue(tenantId: string, now = Date.now()): QueueItem | undefined {
  if (!networkOnline) return undefined;
  const ready = queue
    .filter(
      (i) =>
        i.tenantId === tenantId &&
        i.status === 'pending' &&
        (!i.nextRetryAt || i.nextRetryAt <= now),
    )
    .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
  const item = ready[0];
  if (item) {
    item.status = 'processing';
    item.attempts += 1;
    item.lastAttemptAt = now;
  }
  return item;
}

export function markSuccess(tenantId: string, itemId: string): void {
  const item = queue.find((i) => i.itemId === itemId && i.tenantId === tenantId);
  if (!item) return;
  item.status = 'completed';
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'ITEM_COMPLETED',
    target: itemId,
    details: { attempts: item.attempts },
  });
}

export function markFailure(
  tenantId: string,
  itemId: string,
  error: string,
  config: QueueConfig = { maxAttempts: 5, initialBackoffMs: 1000, maxBackoffMs: 60_000, maxCapacity: 1000 },
): void {
  const item = queue.find((i) => i.itemId === itemId && i.tenantId === tenantId);
  if (!item) return;
  item.error = error;
  if (item.attempts >= config.maxAttempts) {
    item.status = 'dead';
    deadLetter.push(item);
    recordAudit({
      actor: 'system',
      tenantId,
      action: 'ITEM_DEAD_LETTER',
      target: itemId,
      details: { attempts: item.attempts, error },
    });
  } else {
    item.status = 'pending';
    item.nextRetryAt = Date.now() + computeBackoff(item.attempts, config);
  }
}

export function getDeadLetter(tenantId: string): readonly QueueItem[] {
  return deadLetter.filter((i) => i.tenantId === tenantId);
}

export function getQueueSize(tenantId: string): number {
  return queue.filter((i) => i.tenantId === tenantId && i.status === 'pending').length;
}

export class OfflineAiQueueService {
  constructor(
    private readonly tenantId: string,
    private readonly config: QueueConfig = {
      maxAttempts: 5,
      initialBackoffMs: 1000,
      maxBackoffMs: 60_000,
      maxCapacity: 1000,
    },
  ) {}
  enqueue(payload: Record<string, unknown>, priority = 5): QueueItem {
    return enqueue(this.tenantId, payload, priority, this.config);
  }
  dequeue(now?: number): QueueItem | undefined {
    return dequeue(this.tenantId, now);
  }
  success(itemId: string): void {
    markSuccess(this.tenantId, itemId);
  }
  failure(itemId: string, error: string): void {
    markFailure(this.tenantId, itemId, error, this.config);
  }
  deadLetter(): readonly QueueItem[] {
    return getDeadLetter(this.tenantId);
  }
  size(): number {
    return getQueueSize(this.tenantId);
  }
  getAuditLog(): readonly QueueAuditEntry[] {
    return getQueueAuditLog(this.tenantId);
  }
}
