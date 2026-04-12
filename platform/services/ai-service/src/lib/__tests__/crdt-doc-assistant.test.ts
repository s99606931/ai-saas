// MTU-N381 CRDT 문서 보조 테스트
import { describe, it, expect } from 'vitest';
import { CrdtDocAssistantService, type DocState } from '../crdt-doc-assistant.js';

describe('MTU-N381 CrdtDocAssistant', () => {
  const svc = new CrdtDocAssistantService('tenant-n381');

  it('FR-N381.1: Insert 연산 적용', () => {
    const initial: DocState = { content: '', appliedOps: [], version: 0 };
    const op = svc.createInsert(0, 'A', 'user-1');
    const next = svc.apply(initial, op);
    expect(next.content).toBe('A');
    expect(next.version).toBe(1);
  });

  it('FR-N381.2: 다중 연산 병합', () => {
    const initial: DocState = { content: '', appliedOps: [], version: 0 };
    const op1 = svc.createInsert(0, 'H', 'user-1');
    const op2 = svc.createInsert(1, 'i', 'user-2');
    const merged = svc.merge(initial, [op1, op2]);
    expect(merged.content.length).toBe(2);
  });

  it('FR-N381.3: 편집 제안', () => {
    const suggestions = svc.suggest('이것은 테스트입니다  두개공백');
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('FR-N381.4: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
