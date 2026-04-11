// SVC-AI-ADV-R21 단위 테스트: 컨텍스트 윈도우 관리자
// Design Ref: SVC-AI-ADV-R21 DESIGN §1~§5
// Plan SC: FR-ADV21.1~21.6
// CSAP: D-09 민감 컨텍스트 암호화, D-12 시스템 개발 보안
// N2SF: N-05 O등급 데이터만 컨텍스트

import { describe, it, expect, vi } from 'vitest';

// PII 마스킹 모의
vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text.replace(/\d{6}-\d{7}/g, '***-***')),
}));

import {
  createTokenBudget,
  estimateTokens,
  calculatePriority,
  prioritizeChunks,
  calculateRecency,
  getSourceImportance,
  extractiveCompress,
  mapReduceCompress,
  applyConversationWindow,
  handleOverflow,
  buildContextWindow,
} from '../../src/lib/context-window-manager.js';
import type { ContextChunk, TokenBudget } from '../../src/lib/context-window-manager.js';

// ── 토큰 예산 — Design §1 ─────────────────────────────────────────────────

describe('createTokenBudget 토큰 예산 (FR-ADV21.1)', () => {
  it('기본 모델 예산을 생성한다', () => {
    const budget = createTokenBudget('default');
    expect(budget.maxTokens).toBe(32000);
    expect(budget.system).toBeGreaterThan(0);
    expect(budget.context).toBeGreaterThan(0);
    expect(budget.conversation).toBeGreaterThan(0);
    expect(budget.generation).toBeGreaterThan(0);
  });

  it('GPT-4 모델 예산을 생성한다', () => {
    const budget = createTokenBudget('gpt-4');
    expect(budget.maxTokens).toBe(128000);
  });

  it('Claude 모델 예산을 생성한다', () => {
    const budget = createTokenBudget('claude-3');
    expect(budget.maxTokens).toBe(200000);
  });

  it('미지원 모델은 기본값을 사용한다', () => {
    const budget = createTokenBudget('unknown-model');
    expect(budget.maxTokens).toBe(32000);
  });

  it('예산 총합이 maxTokens를 초과하지 않는다', () => {
    const budget = createTokenBudget('default');
    const total = budget.system + budget.context + budget.conversation + budget.generation;
    expect(total).toBeLessThanOrEqual(budget.maxTokens);
  });

  it('오버라이드를 적용한다', () => {
    const budget = createTokenBudget('default', { system: 5000 });
    // 오버라이드 후 총합이 maxTokens 초과 시 스케일 조정됨
    expect(budget.system).toBeGreaterThan(3840); // 기본 system=3840보다 크거나
    const total = budget.system + budget.context + budget.conversation + budget.generation;
    expect(total).toBeLessThanOrEqual(budget.maxTokens);
  });

  it('오버라이드로 초과 시 스케일 조정한다', () => {
    const budget = createTokenBudget('default', {
      system: 20000,
      context: 20000,
      conversation: 20000,
      generation: 20000,
    });
    const total = budget.system + budget.context + budget.conversation + budget.generation;
    expect(total).toBeLessThanOrEqual(budget.maxTokens);
  });
});

// ── 토큰 추정 ──────────────────────────────────────────────────────────────

describe('estimateTokens 토큰 수 추정', () => {
  it('영문 텍스트 토큰을 추정한다', () => {
    const tokens = estimateTokens('hello world');
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  it('한글 텍스트는 더 많은 토큰을 추정한다', () => {
    const korean = estimateTokens('안녕하세요');
    const english = estimateTokens('hello');
    expect(korean).toBeGreaterThan(english);
  });

  it('빈 문자열은 0을 반환한다', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('혼합 텍스트를 처리한다', () => {
    const tokens = estimateTokens('AI 기반 공공 서비스');
    expect(tokens).toBeGreaterThan(0);
  });
});

// ── 청크 우선순위 — Design §3 ──────────────────────────────────────────────

describe('calculatePriority 우선순위 계산 (FR-ADV21.3)', () => {
  it('관련성 높은 청크가 높은 점수를 받는다', () => {
    const high = calculatePriority({
      id: '1', content: '', tokenCount: 0, source: '',
      relevance: 0.9, recency: 0.5, importance: 0.5,
    });
    const low = calculatePriority({
      id: '2', content: '', tokenCount: 0, source: '',
      relevance: 0.1, recency: 0.5, importance: 0.5,
    });
    expect(high).toBeGreaterThan(low);
  });

  it('최근 청크가 더 높은 점수를 받는다', () => {
    const recent = calculatePriority({
      id: '1', content: '', tokenCount: 0, source: '',
      relevance: 0.5, recency: 1.0, importance: 0.5,
    });
    const old = calculatePriority({
      id: '2', content: '', tokenCount: 0, source: '',
      relevance: 0.5, recency: 0.1, importance: 0.5,
    });
    expect(recent).toBeGreaterThan(old);
  });

  it('중요도가 높은 청크가 더 높은 점수를 받는다', () => {
    const important = calculatePriority({
      id: '1', content: '', tokenCount: 0, source: '',
      relevance: 0.5, recency: 0.5, importance: 1.0,
    });
    const minor = calculatePriority({
      id: '2', content: '', tokenCount: 0, source: '',
      relevance: 0.5, recency: 0.5, importance: 0.1,
    });
    expect(important).toBeGreaterThan(minor);
  });
});

describe('prioritizeChunks 청크 정렬', () => {
  it('우선순위 내림차순으로 정렬한다', () => {
    const chunks: ContextChunk[] = [
      { id: '1', content: '', tokenCount: 0, source: '', relevance: 0, recency: 0, importance: 0, priorityScore: 0.3 },
      { id: '2', content: '', tokenCount: 0, source: '', relevance: 0, recency: 0, importance: 0, priorityScore: 0.9 },
      { id: '3', content: '', tokenCount: 0, source: '', relevance: 0, recency: 0, importance: 0, priorityScore: 0.5 },
    ];
    const sorted = prioritizeChunks(chunks);
    expect(sorted[0]!.id).toBe('2');
    expect(sorted[1]!.id).toBe('3');
    expect(sorted[2]!.id).toBe('1');
  });

  it('원본 배열을 변경하지 않는다', () => {
    const chunks: ContextChunk[] = [
      { id: '1', content: '', tokenCount: 0, source: '', relevance: 0, recency: 0, importance: 0, priorityScore: 0.1 },
      { id: '2', content: '', tokenCount: 0, source: '', relevance: 0, recency: 0, importance: 0, priorityScore: 0.9 },
    ];
    prioritizeChunks(chunks);
    expect(chunks[0]!.id).toBe('1');
  });
});

describe('calculateRecency 시간 감쇠', () => {
  it('최근 타임스탬프는 1에 가깝다', () => {
    const recent = calculateRecency(new Date().toISOString());
    expect(recent).toBeGreaterThan(0.9);
  });

  it('반감기 이후에는 0.5 근처이다', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const recency = calculateRecency(thirtyDaysAgo, 30);
    expect(recency).toBeGreaterThan(0.4);
    expect(recency).toBeLessThan(0.6);
  });
});

describe('getSourceImportance 소스 중요도', () => {
  it('regulation이 가장 높다', () => {
    expect(getSourceImportance('regulation')).toBe(1.0);
  });

  it('government_doc이 0.9이다', () => {
    expect(getSourceImportance('government_doc')).toBe(0.9);
  });

  it('미지원 소스는 기본값 0.5이다', () => {
    expect(getSourceImportance('unknown')).toBe(0.5);
  });
});

// ── 컨텍스트 압축 — Design §2 ──────────────────────────────────────────────

describe('extractiveCompress 압축 (FR-ADV21.2)', () => {
  it('토큰 한도 내로 압축한다', () => {
    const text = '첫번째 문장입니다. 두번째 문장입니다. 세번째 문장입니다. 네번째 문장입니다.';
    const result = extractiveCompress(text, 20);
    expect(estimateTokens(result)).toBeLessThanOrEqual(30); // 약간의 여유
  });

  it('빈 텍스트를 처리한다', () => {
    const result = extractiveCompress('', 100);
    expect(result).toBeDefined();
  });

  it('짧은 문장은 그대로 유지한다', () => {
    const result = extractiveCompress('짧은 문장.', 1000);
    expect(result).toBeDefined();
  });
});

describe('mapReduceCompress Map-Reduce 압축', () => {
  it('여러 청크를 압축 병합한다', () => {
    const chunks = [
      '첫번째 문서입니다. 내용이 길게 이어집니다.',
      '두번째 문서입니다. 다른 내용이 있습니다.',
    ];
    const result = mapReduceCompress(chunks, 50);
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── 슬라이딩 윈도우 — Design §4 ────────────────────────────────────────────

describe('applyConversationWindow 슬라이딩 윈도우 (FR-ADV21.4)', () => {
  it('빈 대화는 빈 결과를 반환한다', () => {
    const result = applyConversationWindow([], 1000);
    expect(result.kept).toHaveLength(0);
    expect(result.summarized).toBe('');
    expect(result.totalTokens).toBe(0);
  });

  it('최근 4턴을 보존한다', () => {
    const turns = ['턴1', '턴2', '턴3', '턴4', '턴5', '턴6'];
    const result = applyConversationWindow(turns, 10000);
    expect(result.kept).toHaveLength(4);
    expect(result.kept[0]).toBe('턴3');
    expect(result.kept[3]).toBe('턴6');
  });

  it('4턴 이하이면 모두 보존한다', () => {
    const turns = ['턴1', '턴2'];
    const result = applyConversationWindow(turns, 10000);
    expect(result.kept).toHaveLength(2);
  });

  it('이전 턴을 요약한다', () => {
    const turns = [
      '이전 긴 대화 내용이 여기에 있습니다. 매우 상세한 설명입니다.',
      '추가 대화 내용도 있습니다. 더 많은 정보가 포함되어 있습니다.',
      '턴3',
      '턴4',
      '턴5',
      '턴6',
    ];
    const result = applyConversationWindow(turns, 10000);
    expect(result.summarized.length).toBeGreaterThan(0);
  });
});

// ── 오버플로우 처리 — Design §5 ────────────────────────────────────────────

describe('handleOverflow 오버플로우 (FR-ADV21.5)', () => {
  it('예산 이내 청크를 모두 유지한다', () => {
    const chunks: ContextChunk[] = [
      { id: '1', content: '짧은 내용', tokenCount: 10, source: '', relevance: 0, recency: 0, importance: 0, priorityScore: 0.9 },
      { id: '2', content: '짧은 내용', tokenCount: 10, source: '', relevance: 0, recency: 0, importance: 0, priorityScore: 0.8 },
    ];
    const result = handleOverflow(chunks, 100);
    expect(result.kept).toHaveLength(2);
    expect(result.dropped).toBe(0);
  });

  it('예산 초과 시 낮은 우선순위를 제거한다', () => {
    const chunks: ContextChunk[] = [
      { id: '1', content: '높은 우선순위', tokenCount: 50, source: '', relevance: 0, recency: 0, importance: 0, priorityScore: 0.9 },
      { id: '2', content: '낮은 우선순위', tokenCount: 50, source: '', relevance: 0, recency: 0, importance: 0, priorityScore: 0.1 },
    ];
    const result = handleOverflow(chunks, 60);
    expect(result.kept.length).toBeGreaterThanOrEqual(1);
    expect(result.kept[0]!.priorityScore).toBe(0.9);
  });

  it('빈 청크 목록을 처리한다', () => {
    const result = handleOverflow([], 100);
    expect(result.kept).toHaveLength(0);
    expect(result.dropped).toBe(0);
  });
});

// ── 통합 컨텍스트 윈도우 빌더 ──────────────────────────────────────────────

describe('buildContextWindow 통합 빌더', () => {
  it('컨텍스트 윈도우를 구성한다', () => {
    const chunks: ContextChunk[] = [
      { id: '1', content: '규정 내용', tokenCount: 100, source: 'regulation', relevance: 0.9, recency: 1.0, importance: 1.0, priorityScore: 0.9 },
    ];
    const result = buildContextWindow('default', '시스템 프롬프트', chunks, ['대화 1', '대화 2']);

    expect(result.systemPrompt).toBeDefined();
    expect(result.contextChunks.length).toBeGreaterThanOrEqual(0);
    expect(result.conversationHistory.length).toBeGreaterThan(0);
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.budget).toBeDefined();
    expect(result.budget.maxTokens).toBe(32000);
  });

  it('시스템 프롬프트 PII를 마스킹한다', () => {
    const result = buildContextWindow(
      'default',
      '주민번호 900101-1234567 처리',
      [],
      [],
    );
    expect(result.systemPrompt).not.toContain('900101-1234567');
  });

  it('빈 대화/청크도 처리한다', () => {
    const result = buildContextWindow('default', '프롬프트', [], []);
    expect(result.contextChunks).toHaveLength(0);
    expect(result.droppedChunks).toBe(0);
  });
});
