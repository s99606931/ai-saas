import { describe, it, expect } from 'vitest';
import { LLMTracer } from '../llm-distributed-trace.js';

describe('LLMTracer 기본 트레이스 (FR-R67.1)', () => {
  it('trace + span 생성', () => {
    const t = new LLMTracer({ grade: 'O' });
    const tid = t.startTrace();
    const sid = t.startSpan({ traceId: tid, name: 'llm.call', kind: 'llm' });
    t.endSpan(sid);
    const spans = t.getSpans(tid);
    expect(spans.length).toBe(1);
    expect(spans[0]?.status).toBe('ok');
  });
  it('parentId 중첩', () => {
    const t = new LLMTracer({ grade: 'O' });
    const tid = t.startTrace();
    const parent = t.startSpan({ traceId: tid, name: 'root', kind: 'custom' });
    const child = t.startSpan({
      traceId: tid,
      name: 'child',
      kind: 'retriever',
      parentId: parent,
    });
    t.endSpan(child);
    t.endSpan(parent);
    const spans = t.getSpans(tid);
    expect(spans.find((s) => s.id === child)?.parentId).toBe(parent);
  });
});

describe('본문 키 차단 (FR-R67.4, N-05)', () => {
  it('O 등급 + 샘플링 비활성: 본문 키 거부', () => {
    const t = new LLMTracer({ grade: 'O' });
    const tid = t.startTrace();
    expect(() =>
      t.startSpan({
        traceId: tid,
        name: 'x',
        kind: 'llm',
        attributes: { 'llm.prompt.body': '비밀' },
      }),
    ).toThrow('TRACE_GRADE_BLOCKED');
  });
  it('O 등급 + 샘플링 허용: 256자 trunc', () => {
    const t = new LLMTracer({ grade: 'O', allowBodySampling: true });
    const tid = t.startTrace();
    const big = 'a'.repeat(1000);
    const sid = t.startSpan({
      traceId: tid,
      name: 'x',
      kind: 'llm',
      attributes: { 'llm.prompt.body': big },
    });
    const span = t.getSpans(tid)[0];
    expect((span?.attributes['llm.prompt.body'] as string).length).toBe(256);
    t.endSpan(sid);
  });
  it('C 등급 본문 차단', () => {
    const t = new LLMTracer({ grade: 'C' });
    const tid = t.startTrace();
    expect(() =>
      t.startSpan({
        traceId: tid,
        name: 'x',
        kind: 'llm',
        attributes: { 'llm.completion.body': 'x' },
      }),
    ).toThrow('TRACE_GRADE_BLOCKED');
  });
});

describe('endSpan attributes 병합', () => {
  it('extraAttrs 병합', () => {
    const t = new LLMTracer({ grade: 'O' });
    const tid = t.startTrace();
    const sid = t.startSpan({
      traceId: tid,
      name: 'x',
      kind: 'llm',
      attributes: { 'llm.model': 'gpt-4' },
    });
    t.endSpan(sid, { extraAttrs: { 'llm.completion.tokens': 120 } });
    const span = t.getSpans(tid)[0];
    expect(span?.attributes['llm.completion.tokens']).toBe(120);
  });
  it('error 상태', () => {
    const t = new LLMTracer({ grade: 'O' });
    const tid = t.startTrace();
    const sid = t.startSpan({ traceId: tid, name: 'x', kind: 'tool' });
    t.endSpan(sid, { status: 'error', error: 'tool failure' });
    const span = t.getSpans(tid)[0];
    expect(span?.status).toBe('error');
    expect(span?.errorMessage).toBe('tool failure');
  });
  it('없는 span endSpan 에러', () => {
    const t = new LLMTracer({ grade: 'O' });
    expect(() => t.endSpan('nope')).toThrow('TRACE_SPAN_NOT_FOUND');
  });
});

describe('analyze 병목 분석 (FR-R67.2, FR-R67.3)', () => {
  it('최장 span이 bottleneck', async () => {
    const t = new LLMTracer({ grade: 'O' });
    const tid = t.startTrace();
    const a = t.startSpan({ traceId: tid, name: 'fast', kind: 'retriever' });
    await new Promise((r) => setTimeout(r, 5));
    t.endSpan(a);
    const b = t.startSpan({ traceId: tid, name: 'slow', kind: 'llm' });
    await new Promise((r) => setTimeout(r, 30));
    t.endSpan(b);
    const stats = t.analyze(tid);
    expect(stats.bottleneck.name).toBe('slow');
    expect(stats.spanCount).toBe(2);
    expect(stats.breakdown.llm).toBeGreaterThan(0);
    expect(stats.breakdown.retriever).toBeGreaterThanOrEqual(0);
  });
  it('빈 트레이스 analyze 에러', () => {
    const t = new LLMTracer({ grade: 'O' });
    const tid = t.startTrace();
    expect(() => t.analyze(tid)).toThrow('TRACE_EMPTY');
  });
});

describe('export OTel 호환 (FR-R67.1)', () => {
  it('resourceSpans 구조', () => {
    const t = new LLMTracer({ grade: 'O' });
    const tid = t.startTrace();
    const sid = t.startSpan({
      traceId: tid,
      name: 'x',
      kind: 'llm',
      attributes: { 'llm.model': 'gpt-4' },
    });
    t.endSpan(sid);
    const out = t.export(tid);
    expect(out.resourceSpans[0]?.scopeSpans[0]?.scope.name).toBe('llm-tracer');
    expect(out.resourceSpans[0]?.scopeSpans[0]?.spans.length).toBe(1);
    const span = out.resourceSpans[0]?.scopeSpans[0]?.spans[0];
    expect(span?.name).toBe('x');
    expect(span?.attributes.some((a) => a.key === 'llm.model')).toBe(true);
  });
});

describe('감사 로그 (FR-R67.5, CSAP D-06)', () => {
  it('TRACE_START/SPAN_START/SPAN_END 기록', () => {
    const t = new LLMTracer({ grade: 'O' });
    const tid = t.startTrace();
    const sid = t.startSpan({ traceId: tid, name: 'x', kind: 'llm' });
    t.endSpan(sid);
    const actions = t.getAuditLog().map((e) => e.action);
    expect(actions).toContain('TRACE_START');
    expect(actions).toContain('SPAN_START');
    expect(actions).toContain('SPAN_END');
  });
  it('GRADE_BLOCK 기록', () => {
    const t = new LLMTracer({ grade: 'O' });
    const tid = t.startTrace();
    try {
      t.startSpan({
        traceId: tid,
        name: 'x',
        kind: 'llm',
        attributes: { 'llm.prompt.body': 'y' },
      });
    } catch {
      /* noop */
    }
    expect(t.getAuditLog().some((e) => e.action === 'GRADE_BLOCK')).toBe(true);
  });
});

describe('getGrade', () => {
  it('grade 반환', () => {
    expect(new LLMTracer({ grade: 'O' }).getGrade()).toBe('O');
  });
});
