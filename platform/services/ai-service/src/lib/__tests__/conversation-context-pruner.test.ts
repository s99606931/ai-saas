import { describe, it, expect } from 'vitest';
import {
  ConversationContextPruner,
  type Turn,
} from '../conversation-context-pruner.js';

function mkTurns(n: number, prefix = 'msg'): Turn[] {
  return Array.from({ length: n }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `${prefix}-${i}-${'x'.repeat(50)}`,
    at: 1000 + i,
  }));
}

describe('grade guard (FR-R83.1, N-05)', () => {
  it('O 등급 처리', async () => {
    const p = new ConversationContextPruner();
    const r = await p.prune([
      { role: 'user', content: 'hi', grade: 'O' },
    ]);
    expect(r.kept).toHaveLength(1);
  });

  it('C 등급 차단', async () => {
    const p = new ConversationContextPruner();
    await expect(
      p.prune([{ role: 'user', content: 'hi', grade: 'C' }]),
    ).rejects.toThrow('PRUNE_GRADE_BLOCKED');
  });

  it('S 등급 차단', async () => {
    const p = new ConversationContextPruner();
    await expect(
      p.prune([{ role: 'user', content: 'hi', grade: 'S' }]),
    ).rejects.toThrow('PRUNE_GRADE_BLOCKED');
  });
});

describe('PII 마스킹 (FR-R83.1)', () => {
  it('이메일 마스킹', async () => {
    const p = new ConversationContextPruner();
    const r = await p.prune([
      { role: 'user', content: '연락처 user@example.com' },
    ]);
    expect(r.kept[0]?.content).toContain('***@***');
    expect(r.kept[0]?.content).not.toContain('user@example.com');
  });

  it('전화번호 마스킹', async () => {
    const p = new ConversationContextPruner();
    const r = await p.prune([{ role: 'user', content: '010-1234-5678' }]);
    expect(r.kept[0]?.content).toContain('***-****-****');
  });
});

describe('시스템 턴 보존 (FR-R83.2)', () => {
  it('system 턴 항상 keep', async () => {
    const p = new ConversationContextPruner({ maxTokens: 50 });
    const turns: Turn[] = [
      { role: 'system', content: '역할 정의' },
      ...mkTurns(20),
    ];
    const r = await p.prune(turns);
    expect(r.kept[0]?.role).toBe('system');
  });
});

describe('최근 N턴 보존 (FR-R83.2)', () => {
  it('keepLastN=3 최근 3턴 우선 보존', async () => {
    const p = new ConversationContextPruner({ maxTokens: 100, keepLastN: 3 });
    const turns = mkTurns(10);
    const r = await p.prune(turns);
    const lastThree = turns.slice(-3).map((t) => t.content);
    const keptContents = r.kept.map((t) => t.content);
    for (const last of lastThree) {
      expect(keptContents).toContain(last);
    }
  });
});

describe('토큰 한도 적용 (FR-R83.3)', () => {
  it('maxTokens 초과하지 않음', async () => {
    const p = new ConversationContextPruner({ maxTokens: 100, keepLastN: 2, keepSystem: false });
    const turns = mkTurns(30);
    const r = await p.prune(turns);
    // 최근 2개는 강제 보존되므로, 총 토큰이 강제 보존분 + 100 근처
    const forcedTokens = turns
      .slice(-2)
      .reduce((s, t) => s + Math.ceil(t.content.length / 4), 0);
    expect(r.totalTokens).toBeLessThanOrEqual(100 + forcedTokens);
  });

  it('원본보다 적은 턴 수', async () => {
    const p = new ConversationContextPruner({ maxTokens: 30, keepLastN: 1 });
    const turns = mkTurns(20);
    const r = await p.prune(turns);
    expect(r.kept.length).toBeLessThan(20);
    expect(r.removed).toBeGreaterThan(0);
  });
});

describe('키워드 가중 (FR-R83.2)', () => {
  it('키워드 포함 턴 보존 우선', async () => {
    const p = new ConversationContextPruner({
      maxTokens: 50,
      keepLastN: 1,
      keepSystem: false,
      keywords: ['중요'],
      keywordBoost: 100,
    });
    const turns: Turn[] = [
      { role: 'user', content: '일반 메시지 1' },
      { role: 'user', content: '일반 메시지 2' },
      { role: 'user', content: '중요한 결정 포함 메시지' },
      { role: 'user', content: '끝 메시지' },
    ];
    const r = await p.prune(turns);
    const contents = r.kept.map((t) => t.content);
    expect(contents.some((c) => c.includes('중요한 결정'))).toBe(true);
  });
});

describe('요약 executor (FR-R83.4)', () => {
  it('summarizer 주입 시 요약 턴 삽입', async () => {
    const p = new ConversationContextPruner({ maxTokens: 50, keepLastN: 1, keepSystem: false });
    const turns = mkTurns(20);
    const r = await p.prune(turns, async (removed) => `${removed.length}개 메시지 요약`);
    const hasSummary = r.kept.some((t) => t.content.startsWith('[요약]'));
    expect(hasSummary).toBe(true);
    expect(r.summarized).toBeGreaterThan(0);
  });

  it('summarizer 실패해도 prune 성공', async () => {
    const p = new ConversationContextPruner({ maxTokens: 50, keepLastN: 1 });
    const turns = mkTurns(10);
    const r = await p.prune(turns, async () => {
      throw new Error('boom');
    });
    expect(r.summarized).toBe(0);
  });
});

describe('토큰 절감 (SC)', () => {
  it('40% 이상 절감', async () => {
    const p = new ConversationContextPruner({ maxTokens: 200, keepLastN: 2, keepSystem: false });
    const turns = mkTurns(40);
    const r = await p.prune(turns);
    const savings = (r.originalTokens - r.totalTokens) / r.originalTokens;
    expect(savings).toBeGreaterThan(0.4);
  });
});

describe('감사 로그 (FR-R83.5)', () => {
  it('PRUNE_START/PRUNE_DONE 기록', async () => {
    const p = new ConversationContextPruner();
    await p.prune(mkTurns(5));
    const actions = p.getAuditLog().map((e) => e.action);
    expect(actions).toContain('PRUNE_START');
    expect(actions).toContain('PRUNE_DONE');
  });

  it('REMOVED 기록', async () => {
    const p = new ConversationContextPruner({ maxTokens: 30, keepLastN: 1 });
    await p.prune(mkTurns(20));
    expect(
      p.getAuditLog().some((e) => e.action === 'REMOVED'),
    ).toBe(true);
  });

  it('MASKED 기록', async () => {
    const p = new ConversationContextPruner();
    await p.prune([{ role: 'user', content: 'a@b.com' }]);
    expect(p.getAuditLog().some((e) => e.action === 'MASKED')).toBe(true);
  });
});
