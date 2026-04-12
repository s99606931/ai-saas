// MTU-N381 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  createOp,
  canApply,
  applyOp,
  mergeOps,
  suggestEdits,
  getCrdtAuditLog,
  CrdtDocAssistantService,
  type DocState,
} from '../../src/lib/crdt-doc-assistant';

const initialState: DocState = { content: '', appliedOps: [], version: 0 };

describe('MTU-N381 CrdtDocAssistant', () => {
  it('연산 생성', () => {
    const op = createOp('insert', 0, 'alice', 'a');
    expect(op.type).toBe('insert');
    expect(op.character).toBe('a');
  });

  it('의존성 없을 때 canApply', () => {
    const op = createOp('insert', 0, 'alice', 'a');
    expect(canApply(op, initialState)).toBe(true);
  });

  it('의존성 미충족', () => {
    const op = createOp('insert', 0, 'alice', 'a', ['unknown']);
    expect(canApply(op, initialState)).toBe(false);
  });

  it('insert 적용', () => {
    const op = createOp('insert', 0, 'alice', 'H');
    const s = applyOp('t1', initialState, op);
    expect(s.content).toBe('H');
    expect(s.version).toBe(1);
  });

  it('delete 적용', () => {
    const s1 = applyOp('t1', initialState, createOp('insert', 0, 'a', 'X'));
    const s2 = applyOp('t1', s1, createOp('delete', 0, 'a'));
    expect(s2.content).toBe('');
  });

  it('중복 연산 무시', () => {
    const op = createOp('insert', 0, 'a', 'Y');
    const s1 = applyOp('t1', initialState, op);
    const s2 = applyOp('t1', s1, op);
    expect(s2.version).toBe(s1.version);
  });

  it('mergeOps 인과순서 적용', () => {
    const op1 = createOp('insert', 0, 'a', 'A');
    const op2 = createOp('insert', 1, 'a', 'B', [op1.opId]);
    const s = mergeOps('t1', initialState, [op2, op1]);
    expect(s.content).toBe('AB');
  });

  it('의존성 미충족 예외', () => {
    const op = createOp('insert', 0, 'a', 'x', ['missing']);
    expect(() => applyOp('t1', initialState, op)).toThrow();
  });

  it('이중 공백 제안', () => {
    const s = suggestEdits('hello  world');
    expect(s.some((x) => x.reason.includes('이중'))).toBe(true);
  });

  it('서비스 클래스', () => {
    const svc = new CrdtDocAssistantService('t2');
    const op = svc.createInsert(0, 'z', 'alice');
    const s = svc.apply(initialState, op);
    expect(s.content).toBe('z');
  });

  it('감사 로그 테넌트 격리', () => {
    applyOp('tA', initialState, createOp('insert', 0, 'a', 'A'));
    applyOp('tB', initialState, createOp('insert', 0, 'b', 'B'));
    expect(getCrdtAuditLog('tA').every((e) => e.tenantId === 'tA')).toBe(true);
  });
});
