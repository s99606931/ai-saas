import { describe, it, expect, beforeEach } from 'vitest';
import {
  CrossDocumentReasoning,
  type Document,
} from '../cross-document-reasoning.js';

function buildDoc(id: string, entities: string[] = []): Document {
  return { id, title: `Doc ${id}`, entities, grade: 'O' };
}

describe('CrossDocumentReasoning.addDocument (FR-R56.1)', () => {
  it('O등급 문서 등록 가능', () => {
    const r = new CrossDocumentReasoning();
    r.addDocument(buildDoc('a'));
    expect(r.getDocumentCount()).toBe(1);
  });
  it('C등급 차단', () => {
    const r = new CrossDocumentReasoning();
    expect(() => r.addDocument({ ...buildDoc('x'), grade: 'C' })).toThrow(
      'REASON_GRADE_BLOCKED',
    );
  });
  it('S등급 차단', () => {
    const r = new CrossDocumentReasoning();
    expect(() => r.addDocument({ ...buildDoc('x'), grade: 'S' })).toThrow(
      'REASON_GRADE_BLOCKED',
    );
  });
});

describe('CrossDocumentReasoning.addReference (FR-R56.2)', () => {
  let r: CrossDocumentReasoning;
  beforeEach(() => {
    r = new CrossDocumentReasoning();
    r.addDocument(buildDoc('a'));
    r.addDocument(buildDoc('b'));
  });

  it('정상 엣지 등록', () => {
    r.addReference({ from: 'a', to: 'b', kind: 'cite' });
    // no throw
  });
  it('미등록 문서 엣지 거부', () => {
    expect(() => r.addReference({ from: 'a', to: 'zzz', kind: 'cite' })).toThrow(
      'REASON_UNKNOWN_DOC',
    );
  });
});

describe('CrossDocumentReasoning.findSeeds (FR-R56.3)', () => {
  it('엔티티 일치 문서 추출', () => {
    const r = new CrossDocumentReasoning();
    r.addDocument(buildDoc('a', ['개인정보보호법']));
    r.addDocument(buildDoc('b', ['공공기록물']));
    r.addDocument(buildDoc('c', ['개인정보보호법', '정보공개']));
    const seeds = r.findSeeds(['개인정보보호법']);
    expect(seeds.sort()).toEqual(['a', 'c']);
  });
  it('매칭 없음 빈 배열', () => {
    const r = new CrossDocumentReasoning();
    r.addDocument(buildDoc('a', ['X']));
    expect(r.findSeeds(['Y'])).toEqual([]);
  });
});

describe('CrossDocumentReasoning.reason (FR-R56.4, R56.5)', () => {
  function buildGraph(): CrossDocumentReasoning {
    const r = new CrossDocumentReasoning();
    r.addDocument(buildDoc('law', ['개인정보']));
    r.addDocument(buildDoc('decree', []));
    r.addDocument(buildDoc('notice', []));
    r.addReference({ from: 'law', to: 'decree', kind: 'derive' });
    r.addReference({ from: 'decree', to: 'notice', kind: 'derive' });
    return r;
  }

  it('2홉 체인 생성', () => {
    const r = buildGraph();
    const chains = r.reason({ entities: ['개인정보'] });
    const maxHops = Math.max(...chains.map((c) => c.hops));
    expect(maxHops).toBeGreaterThanOrEqual(2);
    const twoHop = chains.find((c) => c.hops === 2);
    expect(twoHop?.path).toEqual(['law', 'decree', 'notice']);
    expect(twoHop?.evidence.length).toBe(3);
  });

  it('maxDepth 제한', () => {
    const r = buildGraph();
    const chains = r.reason({ entities: ['개인정보'], maxDepth: 1 });
    const maxHops = Math.max(...chains.map((c) => c.hops));
    expect(maxHops).toBeLessThanOrEqual(1);
  });

  it('순환 참조 방지', () => {
    const r = new CrossDocumentReasoning();
    r.addDocument(buildDoc('a', ['x']));
    r.addDocument(buildDoc('b'));
    r.addReference({ from: 'a', to: 'b', kind: 'cite' });
    r.addReference({ from: 'b', to: 'a', kind: 'cite' });
    // 순환 있어도 무한 루프 없이 종료
    const chains = r.reason({ entities: ['x'] });
    expect(chains.length).toBeGreaterThan(0);
    expect(chains.length).toBeLessThan(100);
  });

  it('maxChains 제한', () => {
    const r = new CrossDocumentReasoning();
    for (let i = 0; i < 10; i += 1) {
      r.addDocument(buildDoc(`n${i}`, ['e']));
    }
    const chains = r.reason({ entities: ['e'], maxChains: 3 });
    expect(chains.length).toBeLessThanOrEqual(3);
  });

  it('시드 없으면 빈 결과', () => {
    const r = new CrossDocumentReasoning();
    r.addDocument(buildDoc('a', ['x']));
    expect(r.reason({ entities: ['y'] })).toEqual([]);
  });
});

describe('CrossDocumentReasoning.audit (FR-R56.6)', () => {
  it('액션 기록', () => {
    const r = new CrossDocumentReasoning();
    r.addDocument(buildDoc('a', ['e']));
    r.addDocument(buildDoc('b'));
    r.addReference({ from: 'a', to: 'b', kind: 'cite' });
    r.reason({ entities: ['e'] });
    const log = r.getAuditLog();
    expect(log.some((e) => e.action === 'ADD_DOC')).toBe(true);
    expect(log.some((e) => e.action === 'ADD_REF')).toBe(true);
    expect(log.some((e) => e.action === 'REASON')).toBe(true);
  });
});
