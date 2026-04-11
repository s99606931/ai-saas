// SVC-AI-ADV-R26 단위 테스트: 파인튜닝 데이터 파이프라인
// Design Ref: SVC-AI-ADV-R26 DESIGN §1~§5
// Plan SC: FR-ADV26.1~26.6
// CSAP: D-09 PII 완전 제거, D-06 데이터 처리 감사
// N2SF: N-05 C/S등급 절대 배제

import { describe, it, expect, vi } from 'vitest';

// PII 마스킹 모의
vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text.replace(/\d{6}-\d{7}/g, '***-***')),
}));

import {
  cleanConversation,
  toSFTFormat,
  toDPOFormat,
  toPPOFormat,
  calculateDatasetStats,
  runFineTuningPipeline,
} from '../../src/lib/fine-tuning-pipeline.js';
import type {
  RawConversation,
  CleanedEntry,
} from '../../src/lib/fine-tuning-pipeline.js';

// ── 테스트 헬퍼 ────────────────────────────────────────────────────────────

function createRawConversation(overrides: Partial<RawConversation> = {}): RawConversation {
  return {
    id: 'conv-1',
    tenantId: 'tenant-1',
    messages: [
      { role: 'user', content: '전자정부법 제10조의 내용은 무엇입니까?' },
      { role: 'assistant', content: '전자정부법 제10조는 행정기관의 장이 전자정부서비스를 제공할 때 국민의 편의를 도모하여야 한다는 규정입니다. 구체적으로 전자적 형태로 제공하여야 할 행정서비스의 범위와 방법을 명시하고 있습니다.' },
    ],
    feedback: 'positive',
    rating: 4,
    category: '법령',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ── cleanConversation 정제 — Design §2 ─────────────────────────────────────

describe('cleanConversation 데이터 정제 (FR-ADV26.2)', () => {
  it('유효한 대화를 정제한다', () => {
    const raw = createRawConversation();
    const cleaned = cleanConversation(raw);

    expect(cleaned.id).toBe('conv-1');
    expect(cleaned.isValid).toBe(true);
    expect(cleaned.quality).toBeGreaterThan(0.5);
    expect(cleaned.category).toBe('법령');
    expect(cleaned.tokenCount).toBeGreaterThan(0);
  });

  it('PII를 마스킹한다 (N2SF N-05)', () => {
    const raw = createRawConversation({
      messages: [
        { role: 'user', content: '주민번호 900101-1234567 조회' },
        { role: 'assistant', content: '해당 주민번호 900101-1234567의 정보는 공공기관에서 관리하고 있습니다. 자세한 안내를 드리겠습니다.' },
      ],
    });
    const cleaned = cleanConversation(raw);
    const allText = cleaned.messages.map((m) => m.content).join('');
    expect(allText).not.toContain('900101-1234567');
  });

  it('짧은 응답은 품질을 낮춘다', () => {
    const raw = createRawConversation({
      messages: [
        { role: 'user', content: '안녕하세요' },
        { role: 'assistant', content: '안녕' },
      ],
      feedback: undefined,
      rating: undefined,
    });
    const cleaned = cleanConversation(raw);
    // 짧은 응답(-0.2)이 적용되어 기본(0.5)보다 낮아야 함
    const fullRaw = createRawConversation({ feedback: undefined, rating: undefined });
    const fullCleaned = cleanConversation(fullRaw);
    expect(cleaned.quality).toBeLessThan(fullCleaned.quality);
  });

  it('positive 피드백은 품질을 높인다', () => {
    const positive = cleanConversation(createRawConversation({ feedback: 'positive' }));
    const negative = cleanConversation(createRawConversation({ feedback: 'negative' }));
    expect(positive.quality).toBeGreaterThan(negative.quality);
  });

  it('높은 rating은 품질을 높인다', () => {
    const high = cleanConversation(createRawConversation({ rating: 5 }));
    const low = cleanConversation(createRawConversation({ rating: 1 }));
    expect(high.quality).toBeGreaterThan(low.quality);
  });

  it('카테고리가 없으면 general로 설정한다', () => {
    const raw = createRawConversation({ category: undefined });
    const cleaned = cleanConversation(raw);
    expect(cleaned.category).toBe('general');
  });

  it('품질이 0~1 범위이다', () => {
    const cleaned = cleanConversation(createRawConversation());
    expect(cleaned.quality).toBeGreaterThanOrEqual(0);
    expect(cleaned.quality).toBeLessThanOrEqual(1);
  });
});

// ── toSFTFormat — Design §3 ────────────────────────────────────────────────

describe('toSFTFormat SFT 변환 (FR-ADV26.3)', () => {
  it('유효한 항목만 SFT 포맷으로 변환한다', () => {
    const entries: CleanedEntry[] = [
      { id: '1', messages: [{ role: 'user', content: '질문' }, { role: 'assistant', content: '응답' }], quality: 0.8, category: '법령', tokenCount: 100, isValid: true },
      { id: '2', messages: [{ role: 'user', content: '질문2' }, { role: 'assistant', content: '응답2' }], quality: 0.2, category: '일반', tokenCount: 50, isValid: false, rejectionReason: '품질 부족' },
    ];

    const sft = toSFTFormat(entries);
    expect(sft).toHaveLength(1);
    expect(sft[0]!.messages).toHaveLength(2);
    expect(sft[0]!.messages[0]!.role).toBe('user');
  });

  it('빈 배열을 처리한다', () => {
    expect(toSFTFormat([])).toHaveLength(0);
  });
});

// ── toDPOFormat — Design §3 ────────────────────────────────────────────────

describe('toDPOFormat DPO 변환 (FR-ADV26.3)', () => {
  it('chosen/rejected 쌍을 생성한다', () => {
    const chosen: CleanedEntry[] = [{
      id: '1', messages: [{ role: 'user', content: '질문' }, { role: 'assistant', content: '좋은 응답' }],
      quality: 0.9, category: '', tokenCount: 100, isValid: true,
    }];
    const rejected: CleanedEntry[] = [{
      id: '2', messages: [{ role: 'user', content: '질문' }, { role: 'assistant', content: '나쁜 응답' }],
      quality: 0.2, category: '', tokenCount: 50, isValid: false,
    }];

    const dpo = toDPOFormat(chosen, rejected);
    expect(dpo).toHaveLength(1);
    expect(dpo[0]!.prompt).toBe('질문');
    expect(dpo[0]!.chosen).toBe('좋은 응답');
    expect(dpo[0]!.rejected).toBe('나쁜 응답');
  });

  it('길이가 다른 배열은 짧은 쪽에 맞춘다', () => {
    const chosen: CleanedEntry[] = [
      { id: '1', messages: [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a' }], quality: 0.9, category: '', tokenCount: 10, isValid: true },
      { id: '2', messages: [{ role: 'user', content: 'q2' }, { role: 'assistant', content: 'a2' }], quality: 0.9, category: '', tokenCount: 10, isValid: true },
    ];
    const rejected: CleanedEntry[] = [
      { id: '3', messages: [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'r' }], quality: 0.1, category: '', tokenCount: 10, isValid: false },
    ];

    const dpo = toDPOFormat(chosen, rejected);
    expect(dpo).toHaveLength(1);
  });

  it('빈 배열을 처리한다', () => {
    expect(toDPOFormat([], [])).toHaveLength(0);
  });
});

// ── toPPOFormat — Design §3 ────────────────────────────────────────────────

describe('toPPOFormat PPO 변환 (FR-ADV26.3)', () => {
  it('유효한 항목을 PPO 포맷으로 변환한다', () => {
    const entries: CleanedEntry[] = [{
      id: '1', messages: [{ role: 'user', content: '질문' }, { role: 'assistant', content: '응답' }],
      quality: 0.8, category: '법령', tokenCount: 100, isValid: true,
    }];

    const ppo = toPPOFormat(entries);
    expect(ppo).toHaveLength(1);
    expect(ppo[0]!.query).toBe('질문');
    expect(ppo[0]!.response).toBe('응답');
    expect(ppo[0]!.reward).toBe(0.8);
  });

  it('무효한 항목을 필터링한다', () => {
    const entries: CleanedEntry[] = [{
      id: '1', messages: [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a' }],
      quality: 0.2, category: '', tokenCount: 10, isValid: false,
    }];

    expect(toPPOFormat(entries)).toHaveLength(0);
  });
});

// ── calculateDatasetStats — Design §6 ─────────────────────────────────────

describe('calculateDatasetStats 통계 (FR-ADV26.6)', () => {
  it('데이터셋 통계를 계산한다', () => {
    const entries: CleanedEntry[] = [
      { id: '1', messages: [], quality: 0.8, category: '법령', tokenCount: 100, isValid: true },
      { id: '2', messages: [], quality: 0.3, category: '일반', tokenCount: 50, isValid: false },
      { id: '3', messages: [], quality: 0.9, category: '법령', tokenCount: 200, isValid: true },
    ];

    const stats = calculateDatasetStats(entries);
    expect(stats.totalEntries).toBe(3);
    expect(stats.validEntries).toBe(2);
    expect(stats.invalidEntries).toBe(1);
    expect(stats.avgTokenCount).toBeGreaterThan(0);
    expect(stats.minTokenCount).toBe(50);
    expect(stats.maxTokenCount).toBe(200);
    expect(stats.categoryDistribution['법령']).toBe(2);
    expect(stats.categoryDistribution['일반']).toBe(1);
  });

  it('품질 분포를 계산한다', () => {
    const entries: CleanedEntry[] = [
      { id: '1', messages: [], quality: 0.2, category: '', tokenCount: 10, isValid: false },
      { id: '2', messages: [], quality: 0.5, category: '', tokenCount: 10, isValid: true },
      { id: '3', messages: [], quality: 0.8, category: '', tokenCount: 10, isValid: true },
    ];

    const stats = calculateDatasetStats(entries);
    expect(stats.qualityDistribution['low']).toBe(1);
    expect(stats.qualityDistribution['medium']).toBe(1);
    expect(stats.qualityDistribution['high']).toBe(1);
  });

  it('빈 배열을 처리한다', () => {
    const stats = calculateDatasetStats([]);
    expect(stats.totalEntries).toBe(0);
    expect(stats.avgTokenCount).toBe(0);
    expect(stats.minTokenCount).toBe(0);
    expect(stats.maxTokenCount).toBe(0);
  });
});

// ── runFineTuningPipeline 통합 ─────────────────────────────────────────────

describe('runFineTuningPipeline 통합 파이프라인', () => {
  it('SFT 파이프라인을 실행한다', () => {
    const rawConversations = [
      createRawConversation({ id: 'conv-1' }),
      createRawConversation({ id: 'conv-2' }),
    ];

    const result = runFineTuningPipeline(rawConversations, 'sft');
    expect(result.cleaned).toHaveLength(2);
    expect(result.stats.totalEntries).toBe(2);
    expect(Array.isArray(result.formatted)).toBe(true);
  });

  it('PPO 파이프라인을 실행한다', () => {
    const result = runFineTuningPipeline([createRawConversation()], 'ppo');
    expect(result.stats.totalEntries).toBe(1);
  });

  it('DPO 파이프라인을 실행한다', () => {
    const convs = [
      createRawConversation({ id: '1', rating: 5 }),
      createRawConversation({ id: '2', rating: 1, messages: [
        { role: 'user', content: '질문' },
        { role: 'assistant', content: '짧음' },
      ]}),
    ];
    const result = runFineTuningPipeline(convs, 'dpo');
    expect(result.stats.totalEntries).toBe(2);
  });

  it('빈 대화 목록을 처리한다', () => {
    const result = runFineTuningPipeline([], 'sft');
    expect(result.cleaned).toHaveLength(0);
    expect(result.stats.totalEntries).toBe(0);
  });
});
