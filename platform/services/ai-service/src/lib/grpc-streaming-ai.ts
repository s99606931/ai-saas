// gRPC 스트리밍 AI 서비스 레이어 -- FR-N385.1~FR-N385.5
// Design Ref: MTU-N385 | CSAP: D-09

export type StreamStatus = 'active' | 'paused' | 'closed' | 'error';

export interface StreamSession {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly createdAt: number;
  status: StreamStatus;
  tokenCount: number;
  lastTokenAt: number;
  bufferSize: number;
  maxBuffer: number;
}

export interface TokenFrame {
  readonly sessionId: string;
  readonly token: string;
  readonly index: number;
  readonly timestamp: number;
}

export interface GrpcAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const sessions = new Map<string, StreamSession>();
const auditLog: GrpcAuditEntry[] = [];

function recordAudit(entry: Omit<GrpcAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getGrpcAuditLog(tenantId: string): readonly GrpcAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

export function createSession(tenantId: string, maxBuffer = 100): StreamSession {
  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const session: StreamSession = {
    sessionId,
    tenantId,
    createdAt: now,
    status: 'active',
    tokenCount: 0,
    lastTokenAt: now,
    bufferSize: 0,
    maxBuffer,
  };
  sessions.set(sessionId, session);
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'STREAM_CREATED',
    target: sessionId,
    details: {},
  });
  return session;
}

export function pushToken(sessionId: string, token: string): TokenFrame {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`세션 없음: ${sessionId}`);
  if (session.status !== 'active') throw new Error(`세션 비활성: ${session.status}`);
  if (session.bufferSize >= session.maxBuffer) {
    session.status = 'paused';
    throw new Error(`백프레셔: 버퍼 가득참 (${session.bufferSize}/${session.maxBuffer})`);
  }
  session.tokenCount += 1;
  session.bufferSize += 1;
  session.lastTokenAt = Date.now();
  return {
    sessionId,
    token,
    index: session.tokenCount,
    timestamp: session.lastTokenAt,
  };
}

export function consumeToken(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (session.bufferSize > 0) {
    session.bufferSize -= 1;
  }
  if (session.status === 'paused' && session.bufferSize < session.maxBuffer * 0.5) {
    session.status = 'active';
  }
}

export function closeSession(tenantId: string, sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.status = 'closed';
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'STREAM_CLOSED',
    target: sessionId,
    details: { tokenCount: session.tokenCount },
  });
}

export function reconnectSession(sessionId: string): StreamSession {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`세션 없음: ${sessionId}`);
  if (session.status === 'error' || session.status === 'paused') {
    session.status = 'active';
    session.bufferSize = 0;
  }
  return session;
}

export function getSession(sessionId: string): StreamSession | undefined {
  return sessions.get(sessionId);
}

export class GrpcStreamingAiService {
  constructor(private readonly tenantId: string) {}
  create(maxBuffer = 100): StreamSession {
    return createSession(this.tenantId, maxBuffer);
  }
  push(sessionId: string, token: string): TokenFrame {
    return pushToken(sessionId, token);
  }
  consume(sessionId: string): void {
    consumeToken(sessionId);
  }
  close(sessionId: string): void {
    closeSession(this.tenantId, sessionId);
  }
  reconnect(sessionId: string): StreamSession {
    return reconnectSession(sessionId);
  }
  getAuditLog(): readonly GrpcAuditEntry[] {
    return getGrpcAuditLog(this.tenantId);
  }
}
