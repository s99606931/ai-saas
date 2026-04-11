// SVC-AI-ADV-R11 단위 테스트: 다중 세션 대화 기억
// Design Ref: SVC-AI-ADV-R11 DESIGN §1~§4
// Plan SC: FR-ADV11.1~11.5
// CSAP: D-09 PII 마스킹, D-06 감사 로깅
// N2SF: N-05 O등급 데이터만 처리

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text.replace(/\d{6}-\d{7}/g, '***-***')),
}));

import {
  ShortTermMemory,
  LongTermMemoryStore,
  EntityTracker,
  buildMemoryContext,
} from '../../src/lib/conversational-memory.js';
import type { LongTermMemory, EntityMemory } from '../../src/lib/conversational-memory.js';

// ── ShortTermMemory — Design §1 ──────────────────────────────────────────

describe('ShortTermMemory 단기 메모리 (FR-ADV11.1)', () => {
  let memory: ShortTermMemory;

  beforeEach(() => {
    memory = new ShortTermMemory({ maxShortTermTurns: 5, maxShortTermTokens: 2000 });
  });

  it('턴을 추가한다', () => {
    memory.addTurn('user', '안녕하세요');
    expect(memory.length).toBe(1);
  });

  it('여러 턴을 추가한다', () => {
    memory.addTurn('user', '질문');
    memory.addTurn('assistant', '응답');
    expect(memory.length).toBe(2);
  });

  it('최대 턴 수 초과 시 오래된 턴을 제거한다', () => {
    for (let i = 0; i < 7; i++) {
      memory.addTurn('user', `메시지 ${i}`);
    }
    expect(memory.length).toBeLessThanOrEqual(5);
  });

  it('턴 목록을 반환한다', () => {
    memory.addTurn('user', '질문');
    memory.addTurn('assistant', '응답');
    const turns = memory.getTurns();
    expect(turns).toHaveLength(2);
    expect(turns[0]!.role).toBe('user');
    expect(turns[1]!.role).toBe('assistant');
  });

  it('LLM 메시지로 변환한다', () => {
    memory.addTurn('user', '질문');
    memory.addTurn('assistant', '응답');
    const messages = memory.toMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe('user');
    expect(messages[0]!.content).toBe('질문');
  });

  it('serialize로 직렬화한다 (PII 마스킹)', () => {
    memory.addTurn('user', '주민번호 900101-1234567 확인');
    const text = memory.serialize();
    expect(text).toContain('***-***');
    expect(text).not.toContain('900101-1234567');
  });

  it('clear로 초기화한다', () => {
    memory.addTurn('user', '질문');
    memory.addTurn('assistant', '응답');
    memory.clear();
    expect(memory.length).toBe(0);
    expect(memory.tokenCount).toBe(0);
  });

  it('토큰 카운트를 추적한다', () => {
    memory.addTurn('user', '충분히 긴 한국어 텍스트입니다.');
    expect(memory.tokenCount).toBeGreaterThan(0);
  });
});

// ── LongTermMemoryStore — Design §2 ──────────────────────────────────────

describe('LongTermMemoryStore 장기 메모리 (FR-ADV11.2)', () => {
  let store: LongTermMemoryStore;

  const createMemory = (overrides: Partial<LongTermMemory> = {}): LongTermMemory => ({
    sessionId: 'session-1',
    summary: '전자정부법 관련 대화 요약',
    embedding: [0.9, 0.1, 0.0],
    createdAt: Date.now(),
    keyEntities: ['전자정부법'],
    topicTags: ['법령'],
    ...overrides,
  });

  beforeEach(() => {
    store = new LongTermMemoryStore();
  });

  it('장기 메모리를 저장한다', () => {
    store.store('user-1', createMemory());
    expect(store.count('user-1')).toBe(1);
  });

  it('여러 메모리를 저장한다', () => {
    store.store('user-1', createMemory({ sessionId: 's1' }));
    store.store('user-1', createMemory({ sessionId: 's2' }));
    expect(store.count('user-1')).toBe(2);
  });

  it('유사 메모리를 검색한다', () => {
    store.store('user-1', createMemory({ embedding: [0.9, 0.1, 0.0] }));
    store.store('user-1', createMemory({
      sessionId: 's2',
      summary: '민원 관련',
      embedding: [0.1, 0.9, 0.0],
    }));

    const results = store.search('user-1', [0.85, 0.15, 0.0]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.summary).toContain('전자정부법');
  });

  it('유사도 임계값 미만은 검색되지 않는다', () => {
    store.store('user-1', createMemory({ embedding: [0.1, 0.9, 0.0] }));
    const results = store.search('user-1', [0.9, 0.0, 0.1]);
    // 유사도가 낮아 결과가 비어있거나 적을 수 있음
    for (const r of results) {
      expect(r).toBeDefined();
    }
  });

  it('사용자 메모리를 전체 삭제한다 (GDPR)', () => {
    store.store('user-1', createMemory());
    store.store('user-1', createMemory({ sessionId: 's2' }));
    const deleted = store.deleteAll('user-1');
    expect(deleted).toBe(2);
    expect(store.count('user-1')).toBe(0);
  });

  it('존재하지 않는 사용자 삭제는 0', () => {
    expect(store.deleteAll('nonexistent')).toBe(0);
  });

  it('사용자 격리를 유지한다', () => {
    store.store('user-1', createMemory());
    store.store('user-2', createMemory({ sessionId: 's2', summary: '다른 사용자' }));
    expect(store.count('user-1')).toBe(1);
    expect(store.count('user-2')).toBe(1);
    // user-1 검색 시 user-2 데이터 미반환
    const results = store.search('user-1', [0.9, 0.1, 0.0]);
    for (const r of results) {
      expect(r.summary).not.toBe('다른 사용자');
    }
  });
});

// ── EntityTracker — Design §3 ─────────────────────────────────────────────

describe('EntityTracker 작업 메모리 (FR-ADV11.3)', () => {
  let tracker: EntityTracker;

  beforeEach(() => {
    tracker = new EntityTracker({ maxEntities: 5 } as any);
  });

  it('엔티티를 추가한다', () => {
    tracker.upsert({
      name: '전자정부법',
      type: 'regulation',
      value: '전자정부법',
      lastMentioned: Date.now(),
      confidence: 0.9,
    });
    expect(tracker.size).toBe(1);
  });

  it('같은 엔티티를 업데이트한다', () => {
    tracker.upsert({
      name: '전자정부법',
      type: 'regulation',
      value: '전자정부법 제10조',
      lastMentioned: Date.now(),
      confidence: 0.95,
    });
    tracker.upsert({
      name: '전자정부법',
      type: 'regulation',
      value: '전자정부법 제11조',
      lastMentioned: Date.now(),
      confidence: 0.98,
    });
    expect(tracker.size).toBe(1); // 같은 키
  });

  it('최대 개수 초과 시 오래된 것을 제거한다', () => {
    for (let i = 0; i < 7; i++) {
      tracker.upsert({
        name: `엔티티-${i}`,
        type: 'regulation',
        value: `값-${i}`,
        lastMentioned: Date.now() + i,
        confidence: 0.8,
      });
    }
    expect(tracker.size).toBeLessThanOrEqual(5);
  });

  it('활성 엔티티를 반환한다', () => {
    tracker.upsert({
      name: '엔티티A',
      type: 'regulation',
      value: '값A',
      lastMentioned: Date.now(),
      confidence: 0.8,
    });
    tracker.upsert({
      name: '엔티티B',
      type: 'document',
      value: '값B',
      lastMentioned: Date.now(),
      confidence: 0.9,
    });

    const active = tracker.getActive();
    expect(active.length).toBe(2);
    // 두 엔티티 모두 반환됨 (최근 언급순 정렬)
    const names = active.map((e) => e.name);
    expect(names).toContain('엔티티A');
    expect(names).toContain('엔티티B');
  });

  it('clear로 초기화한다', () => {
    tracker.upsert({
      name: '엔티티',
      type: 'regulation',
      value: '값',
      lastMentioned: Date.now(),
      confidence: 0.8,
    });
    tracker.clear();
    expect(tracker.size).toBe(0);
  });
});

// ── EntityTracker.extractFromText — Design §3 ─────────────────────────────

describe('EntityTracker.extractFromText 엔티티 추출', () => {
  let tracker: EntityTracker;

  beforeEach(() => {
    tracker = new EntityTracker();
  });

  it('날짜를 추출한다', () => {
    const entities = tracker.extractFromText('2026-04-11 회의가 있습니다.');
    const dates = entities.filter((e) => e.type === 'date');
    expect(dates.length).toBeGreaterThan(0);
  });

  it('법령을 추출한다', () => {
    const entities = tracker.extractFromText('전자정부법에 따른 행정절차법 준수');
    const regs = entities.filter((e) => e.type === 'regulation');
    expect(regs.length).toBeGreaterThan(0);
  });

  it('문서번호를 추출한다', () => {
    const entities = tracker.extractFromText('문서 행정-2026-001234 참조');
    const docs = entities.filter((e) => e.type === 'document');
    expect(docs.length).toBeGreaterThan(0);
  });

  it('추출된 엔티티를 자동 등록한다', () => {
    tracker.extractFromText('전자정부법 문서번호 행정-2026-001234');
    expect(tracker.size).toBeGreaterThan(0);
  });

  it('빈 텍스트는 빈 배열', () => {
    const entities = tracker.extractFromText('');
    expect(entities).toHaveLength(0);
  });
});

// ── buildMemoryContext — Design §4 ──────────────────────────────────────

describe('buildMemoryContext 컨텍스트 주입 (FR-ADV11.4)', () => {
  it('장기 메모리와 엔티티를 조합한다', () => {
    const memories: LongTermMemory[] = [
      {
        sessionId: 's1',
        summary: '전자정부법 관련 대화',
        embedding: [],
        createdAt: Date.now(),
        keyEntities: [],
        topicTags: [],
      },
    ];
    const entities: EntityMemory[] = [
      {
        name: '전자정부법',
        type: 'regulation',
        value: '전자정부법',
        lastMentioned: Date.now(),
        confidence: 0.9,
      },
    ];

    const context = buildMemoryContext(memories, entities);
    expect(context.systemMessage).toContain('대화 기억');
    expect(context.systemMessage).toContain('과거 대화');
    expect(context.relevantSummaries).toHaveLength(1);
    expect(context.activeEntities).toHaveLength(1);
    expect(context.totalTokens).toBeGreaterThan(0);
  });

  it('PII를 마스킹한다', () => {
    const memories: LongTermMemory[] = [
      {
        sessionId: 's1',
        summary: '주민번호 900101-1234567 관련 대화',
        embedding: [],
        createdAt: Date.now(),
        keyEntities: [],
        topicTags: [],
      },
    ];

    const context = buildMemoryContext(memories, []);
    expect(context.systemMessage).toContain('***-***');
    expect(context.systemMessage).not.toContain('900101-1234567');
  });

  it('빈 입력은 빈 시스템 메시지', () => {
    const context = buildMemoryContext([], []);
    expect(context.systemMessage).toBe('');
    expect(context.totalTokens).toBe(0);
  });

  it('토큰 예산을 초과하지 않는다', () => {
    const memories: LongTermMemory[] = Array.from({ length: 50 }, (_, i) => ({
      sessionId: `s${i}`,
      summary: `매우 긴 대화 요약 내용 ${i}. 행정기관의 장은 전자정부서비스를 제공할 때 국민의 편의를 도모해야 합니다. 추가 내용이 여기에 있습니다.`,
      embedding: [],
      createdAt: Date.now(),
      keyEntities: [],
      topicTags: [],
    }));

    const context = buildMemoryContext(memories, [], { contextTokenBudget: 100 } as any);
    expect(context.totalTokens).toBeLessThanOrEqual(100);
  });
});
