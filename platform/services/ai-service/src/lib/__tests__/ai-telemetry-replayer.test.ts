import { describe, it, expect } from 'vitest';
import {
  AITelemetryReplayer,
  type RecordInput,
} from '../ai-telemetry-replayer.js';

function mk(
  id: string,
  prompt: string,
  response: string,
  grade: 'O' | 'C' | 'S' = 'O',
): RecordInput {
  return {
    id,
    tenantId: 't1',
    model: 'gpt-o',
    prompt,
    response,
    tags: ['test'],
    grade,
    latencyMs: 100,
  };
}

describe('record + mask (FR-R80.1, N-05)', () => {
  it('O 등급 기록', () => {
    const r = new AITelemetryReplayer();
    const rec = r.record(mk('r1', '질문 내용', '답변 내용'));
    expect(rec.id).toBe('r1');
    expect(r.size()).toBe(1);
  });

  it('C 등급 차단', () => {
    const r = new AITelemetryReplayer();
    expect(() => r.record(mk('r1', 'x', 'y', 'C'))).toThrow(
      'RECORD_GRADE_BLOCKED',
    );
    expect(r.getAuditLog().some((e) => e.action === 'BLOCKED')).toBe(true);
  });

  it('S 등급 차단', () => {
    const r = new AITelemetryReplayer();
    expect(() => r.record(mk('r1', 'x', 'y', 'S'))).toThrow(
      'RECORD_GRADE_BLOCKED',
    );
  });

  it('이메일 마스킹', () => {
    const r = new AITelemetryReplayer();
    const rec = r.record(mk('r1', 'hello user@example.com', 'ok'));
    expect(rec.prompt).toContain('***@***');
    expect(rec.prompt).not.toContain('user@example.com');
  });

  it('전화번호 마스킹', () => {
    const r = new AITelemetryReplayer();
    const rec = r.record(mk('r1', '전화: 010-1234-5678', '확인'));
    expect(rec.prompt).toContain('***-****-****');
  });

  it('주민등록번호 마스킹', () => {
    const r = new AITelemetryReplayer();
    const rec = r.record(mk('r1', '주민번호 900101-1234567', 'ok'));
    expect(rec.prompt).toContain('******-*******');
    expect(rec.prompt).not.toContain('900101-1234567');
  });
});

describe('query (FR-R80.2)', () => {
  it('태그 필터', () => {
    const r = new AITelemetryReplayer();
    const rec1 = mk('r1', 'a', 'b');
    rec1.tags = ['prod'];
    r.record(rec1);
    const rec2 = mk('r2', 'c', 'd');
    rec2.tags = ['dev'];
    r.record(rec2);
    const res = r.query({ tag: 'prod' });
    expect(res.length).toBe(1);
    expect(res[0]?.id).toBe('r1');
  });

  it('시간 범위 필터', () => {
    const r = new AITelemetryReplayer();
    let now = 1000;
    r.setClock(() => now);
    r.record({ ...mk('r1', 'a', 'b'), at: 1000 });
    now = 2000;
    r.record({ ...mk('r2', 'c', 'd'), at: 2000 });
    const res = r.query({ from: 1500, to: 2500 });
    expect(res.length).toBe(1);
    expect(res[0]?.id).toBe('r2');
  });
});

describe('replay (FR-R80.3, R80.4)', () => {
  it('동일 응답 → match', async () => {
    const r = new AITelemetryReplayer();
    r.record(mk('r1', '질문', '답변 ABC'));
    const res = await r.replay('r1', async (rec) => ({
      response: rec.response,
      latencyMs: rec.latencyMs,
    }));
    expect(res.match).toBe(true);
    expect(res.regression).toBe(false);
  });

  it('다른 응답 → regression', async () => {
    const r = new AITelemetryReplayer();
    r.record(mk('r1', '질문', '답변 ABC'));
    const res = await r.replay('r1', async () => ({
      response: '완전 다른 답변',
      latencyMs: 100,
    }));
    expect(res.match).toBe(false);
    expect(res.regression).toBe(true);
    expect(r.getAuditLog().some((e) => e.action === 'REGRESSION')).toBe(true);
  });

  it('레이턴시 급증 → regression', async () => {
    const r = new AITelemetryReplayer({
      latencyRegressionMs: 100,
      ttlMs: 0,
    });
    r.record(mk('r1', '질문', '답변'));
    const res = await r.replay('r1', async (rec) => ({
      response: rec.response,
      latencyMs: rec.latencyMs + 500,
    }));
    expect(res.match).toBe(true);
    expect(res.regression).toBe(true);
  });

  it('존재하지 않는 id → 에러', async () => {
    const r = new AITelemetryReplayer();
    await expect(
      r.replay('none', async () => ({ response: 'x', latencyMs: 10 })),
    ).rejects.toThrow('REPLAY_RECORD_NOT_FOUND');
  });
});

describe('evict TTL', () => {
  it('TTL 경과 레코드 제거', () => {
    const r = new AITelemetryReplayer({ ttlMs: 100, latencyRegressionMs: 200 });
    let now = 1000;
    r.setClock(() => now);
    r.record({ ...mk('r1', 'a', 'b'), at: 1000 });
    now = 2000; // 1000ms 경과
    const removed = r.evict();
    expect(removed).toBe(1);
    expect(r.size()).toBe(0);
  });
});

describe('감사 (FR-R80.5, D-06)', () => {
  it('RECORD/REPLAY 이벤트', async () => {
    const r = new AITelemetryReplayer();
    r.record(mk('r1', 'a', 'b'));
    await r.replay('r1', async (rec) => ({
      response: rec.response,
      latencyMs: rec.latencyMs,
    }));
    const log = r.getAuditLog();
    expect(log.some((e) => e.action === 'RECORD')).toBe(true);
    expect(log.some((e) => e.action === 'REPLAY')).toBe(true);
  });
});
