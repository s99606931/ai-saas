// SVC-AI-ADV-R11 단위 테스트: 다중 세션 대화 메모리
// Design Ref: SVC-AI-ADV-R11 DESIGN §1~§4
// Plan SC: FR-ADV11.1~FR-ADV11.6
// CSAP: D-08, D-06

import { describe, it, expect, vi, beforeEach } from 'vitest';

// PII 마스킹 모의
vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text.replace(/\d{6}-\d{7}/g, '***-***')),
}));

import {
  ConversationMemory,
  createConversationMemory,
} from '../../src/lib/conversation-memory.js';
import type { ConversationTurn } from '../../src/lib/conversation-memory.js';

// ── 테스트 헬퍼 ─────────────────────────────────────────────────────────────

function createTurn(role: 'user' | 'assistant', content: string): ConversationTurn {
  return { role, content, timestamp: Date.now() };
}

// ── 테스트 ──────────────────────────────────────────────────────────────────

describe('ConversationMemory 단기 메모리 (FR-ADV11.1)', () => {
  let memory: ConversationMemory;

  beforeEach(() => {
    memory = new ConversationMemory({ maxShortTermTurns: 5 });
  });

  it('대화 턴을 추가한다', async () => {
    await memory.addTurn('user-1', createTurn('user', '안녕하세요'));
    const turns = memory.getShortTermTurns('user-1');
    expect(turns).toHaveLength(1);
    expect(turns[0]?.content).toBe('안녕하세요');
  });

  it('여러 턴을 누적한다', async () => {
    await memory.addTurn('user-1', createTurn('user', '질문 1'));
    await memory.addTurn('user-1', createTurn('assistant', '답변 1'));
    await memory.addTurn('user-1', createTurn('user', '질문 2'));
    const turns = memory.getShortTermTurns('user-1');
    expect(turns).toHaveLength(3);
  });

  it('최대 턴 수 초과 시 오래된 턴을 제거한다 (슬라이딩 윈도우)', async () => {
    for (let i = 0; i < 7; i++) {
      await memory.addTurn('user-1', createTurn('user', `턴 ${i}`));
    }
    const turns = memory.getShortTermTurns('user-1');
    expect(turns).toHaveLength(5);
    expect(turns[0]?.content).toBe('턴 2'); // 0, 1이 제거됨
  });

  it('사용자별 독립적으로 관리한다', async () => {
    await memory.addTurn('user-1', createTurn('user', '사용자1 질문'));
    await memory.addTurn('user-2', createTurn('user', '사용자2 질문'));
    expect(memory.getShortTermTurns('user-1')).toHaveLength(1);
    expect(memory.getShortTermTurns('user-2')).toHaveLength(1);
  });

  it('존재하지 않는 사용자는 빈 배열을 반환한다', () => {
    const turns = memory.getShortTermTurns('nonexistent');
    expect(turns).toHaveLength(0);
  });
});

describe('ConversationMemory 장기 메모리 (FR-ADV11.2)', () => {
  let memory: ConversationMemory;

  beforeEach(() => {
    memory = new ConversationMemory({ maxShortTermTurns: 20, maxLongTermSessions: 5 });
  });

  it('세션을 커밋하면 장기 메모리에 요약을 저장한다', async () => {
    await memory.addTurn('user-1', createTurn('user', '주민등록 등본 발급 방법'));
    await memory.addTurn('user-1', createTurn('assistant', '시청에 방문하세요'));

    const summary = await memory.commitSession('user-1', 'session-1');
    expect(summary).toBeDefined();
    expect(summary?.sessionId).toBe('session-1');
    expect(summary?.turnCount).toBe(2);
  });

  it('커밋 후 단기 메모리가 초기화된다', async () => {
    await memory.addTurn('user-1', createTurn('user', '질문'));
    await memory.commitSession('user-1', 'session-1');
    const turns = memory.getShortTermTurns('user-1');
    expect(turns).toHaveLength(0);
  });

  it('빈 세션 커밋은 null을 반환한다', async () => {
    const summary = await memory.commitSession('user-1', 'session-1');
    expect(summary).toBeNull();
  });

  it('최대 세션 수 초과 시 오래된 세션을 제거한다', async () => {
    for (let i = 0; i < 7; i++) {
      await memory.addTurn('user-1', createTurn('user', `세션 ${i} 질문`));
      await memory.commitSession('user-1', `session-${i}`);
    }
    const stats = memory.getStats();
    expect(stats.longTermSessions).toBeLessThanOrEqual(5);
  });
});

describe('ConversationMemory 작업 메모리 (FR-ADV11.3)', () => {
  let memory: ConversationMemory;

  beforeEach(() => {
    memory = new ConversationMemory({ maxEntities: 3 });
  });

  it('엔티티를 설정한다', () => {
    memory.setEntity('user-1', '이름', '홍길동', 'person');
    const entities = memory.getEntities('user-1');
    expect(entities['이름']).toBeDefined();
  });

  it('엔티티를 업데이트한다', () => {
    memory.setEntity('user-1', '주제', '주민등록', 'topic');
    memory.setEntity('user-1', '주제', '여권발급', 'topic');
    const entities = memory.getEntities('user-1');
    expect(entities['주제']).toContain('여권발급');
  });

  it('최대 엔티티 수 초과 시 가장 오래된 엔티티를 제거한다', () => {
    memory.setEntity('user-1', 'entity1', 'val1', 'other');
    memory.setEntity('user-1', 'entity2', 'val2', 'other');
    memory.setEntity('user-1', 'entity3', 'val3', 'other');
    memory.setEntity('user-1', 'entity4', 'val4', 'other'); // entity1 제거됨
    const entities = memory.getEntities('user-1');
    const keys = Object.keys(entities);
    expect(keys).toHaveLength(3);
  });

  it('사용자별 독립적으로 관리한다', () => {
    memory.setEntity('user-1', '이름', '홍길동', 'person');
    memory.setEntity('user-2', '이름', '김철수', 'person');
    expect(memory.getEntities('user-1')['이름']).toContain('홍길동');
    expect(memory.getEntities('user-2')['이름']).toContain('김철수');
  });
});

describe('ConversationMemory 컨텍스트 주입 (FR-ADV11.6)', () => {
  let memory: ConversationMemory;

  beforeEach(() => {
    memory = new ConversationMemory({ maxContextTokens: 5000 });
  });

  it('컨텍스트를 구성한다', async () => {
    await memory.addTurn('user-1', createTurn('user', '주민등록 등본 발급 방법'));
    await memory.addTurn('user-1', createTurn('assistant', '시청에 방문하세요'));
    memory.setEntity('user-1', '주제', '주민등록', 'topic');

    const context = await memory.buildContext('user-1', '추가 질문');
    expect(context.recentTurns.length).toBeGreaterThan(0);
    expect(context.entities['주제']).toBeDefined();
    expect(context.estimatedTokens).toBeGreaterThan(0);
  });

  it('빈 메모리에서도 컨텍스트를 반환한다', async () => {
    const context = await memory.buildContext('user-1', '질문');
    expect(context.recentTurns).toHaveLength(0);
    expect(context.relatedSummaries).toHaveLength(0);
    expect(context.memoryPrompt).toBe('');
  });
});

describe('ConversationMemory 메모리 삭제 (FR-ADV11.5)', () => {
  it('사용자 전체 메모리를 삭제한다', async () => {
    const memory = new ConversationMemory();
    await memory.addTurn('user-1', createTurn('user', '질문'));
    memory.setEntity('user-1', '이름', '테스트', 'person');
    await memory.commitSession('user-1', 'session-1');
    await memory.addTurn('user-1', createTurn('user', '새 질문'));

    memory.deleteUserMemory('user-1');
    expect(memory.getShortTermTurns('user-1')).toHaveLength(0);
    expect(Object.keys(memory.getEntities('user-1'))).toHaveLength(0);
  });
});

describe('ConversationMemory 만료 정리', () => {
  it('만료된 장기 메모리를 정리한다', async () => {
    const memory = new ConversationMemory({ longTermTTLMs: 1 }); // 1ms TTL
    await memory.addTurn('user-1', createTurn('user', '질문'));
    await memory.commitSession('user-1', 'session-1');

    await new Promise((r) => setTimeout(r, 10));
    const cleaned = memory.cleanupExpired();
    expect(cleaned).toBeGreaterThanOrEqual(1);
  });
});

describe('ConversationMemory 통계', () => {
  it('메모리 통계를 반환한다', async () => {
    const memory = new ConversationMemory();
    await memory.addTurn('user-1', createTurn('user', '질문'));
    await memory.addTurn('user-2', createTurn('user', '질문'));
    memory.setEntity('user-1', '주제', '테스트', 'topic');

    const stats = memory.getStats();
    expect(stats.totalUsers).toBe(2);
    expect(stats.shortTermTurns).toBe(2);
    expect(stats.totalEntities).toBe(1);
  });
});

describe('createConversationMemory 팩토리', () => {
  it('ConversationMemory 인스턴스를 생성한다', () => {
    const memory = createConversationMemory();
    expect(memory).toBeInstanceOf(ConversationMemory);
  });

  it('의존성 주입을 지원한다', () => {
    const embedFn = vi.fn().mockResolvedValue([0.1, 0.2, 0.3]);
    const memory = createConversationMemory({}, { embedFn });
    expect(memory).toBeInstanceOf(ConversationMemory);
  });
});
