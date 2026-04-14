// Design Ref: SVC-AI-ADV-R703.design.md — AI기반 관찰가능성 상관관계 분석 v3
// Plan SC: FR-R703.1~5

import { createHash } from 'crypto';

export type SignalType = 'metric' | 'log' | 'trace';

interface SignalSpec { signalId: string; type: SignalType }
interface CorrelationCandidate {
  maskedSignalId: string;
  score: number;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function maskId(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class AIObservabilityCorrelatorV3 {
  private signals = new Map<string, SignalSpec>();
  private events = new Map<string, number[]>();
  private auditLog: AuditEntry[] = [];

  registerSignal(spec: SignalSpec): void {
    this.signals.set(spec.signalId, spec);
    this.events.set(spec.signalId, []);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_SIGNAL',
      details: { maskedSignalId: maskId(spec.signalId), type: spec.type },
    });
  }

  recordEvent(signalId: string, timestampMs: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const list = this.events.get(signalId);
    if (!list) throw new Error(`UNKNOWN_SIGNAL: ${signalId}`);
    if (!Number.isFinite(timestampMs) || timestampMs < 0) throw new Error('INVALID_TIMESTAMP');
    list.push(timestampMs);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_EVENT',
      details: { maskedSignalId: maskId(signalId), timestampMs },
    });
  }

  private correlationScore(a: string, b: string, windowMs: number): number {
    const A = this.events.get(a) ?? [];
    const B = this.events.get(b) ?? [];
    if (A.length === 0 || B.length === 0) return 0;
    let intersection = 0;
    for (const ta of A) {
      if (B.some((tb) => Math.abs(tb - ta) <= windowMs)) intersection += 1;
    }
    const union = A.length + B.length - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  findRootCauseCandidates(targetSignalId: string, windowMs: number, threshold: number): CorrelationCandidate[] {
    if (!this.signals.has(targetSignalId)) throw new Error(`UNKNOWN_SIGNAL: ${targetSignalId}`);
    if (threshold < 0 || threshold > 1) throw new Error('INVALID_THRESHOLD');
    const candidates: CorrelationCandidate[] = [];
    for (const sid of this.signals.keys()) {
      if (sid === targetSignalId) continue;
      const score = this.correlationScore(targetSignalId, sid, windowMs);
      if (score >= threshold) {
        candidates.push({ maskedSignalId: maskId(sid), score: Math.round(score * 100) / 100 });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'CORRELATE',
      details: { target: maskId(targetSignalId), windowMs, threshold, count: candidates.length },
    });
    return candidates;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
