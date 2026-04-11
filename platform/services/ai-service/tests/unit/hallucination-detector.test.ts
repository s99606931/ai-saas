// SVC-AI-ADV-R3 단위 테스트: 환각 감지기
// Design Ref: SVC-AI-ADV-R3 DESIGN §3
// Plan SC: FR-ADV3.3
// CSAP: D-12 시스템 개발 보안

import { describe, it, expect, vi } from 'vitest';

// LLM 프로바이더 모의 (getLLMConfig, createLLMProvider 사용)
vi.mock('../../src/lib/llm-provider.js', () => ({
  getLLMConfig: vi.fn(() => ({ provider: 'test', endpoint: 'http://test', name: 'test-model' })),
  createLLMProvider: vi.fn().mockResolvedValue({
    chat: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        claims: [
          { text: '제10조는 서비스 제공에 관한 것입니다', grounded: true, source: '제10조' },
          { text: '2024년에 개정되었습니다', grounded: false, reason: '출처에 개정 연도 미언급' },
        ],
      }),
      tokensUsed: 300,
      model: 'test',
    }),
  }),
}));

// PII 마스킹 모의
vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text),
}));

import { detectHallucination } from '../../src/lib/hallucination-detector.js';
import type { HallucinationCheckResult } from '../../src/lib/hallucination-detector.js';

// ── 출처 없는 경우 ─────────────────────────────────────────────────────────

describe('detectHallucination 출처 없음', () => {
  it('출처가 없으면 전체를 환각으로 판정한다', async () => {
    const result = await detectHallucination(
      'AI가 생성한 답변입니다.',
      [],
      '질문입니다.',
    );

    expect(result.hasHallucination).toBe(true);
    expect(result.hallucinationRate).toBe(1.0);
    expect(result.riskLevel).toBe('danger');
    expect(result.totalClaims).toBe(1);
    expect(result.groundedClaims).toBe(0);
    expect(result.ungroundedClaims).toHaveLength(1);
    expect(result.ungroundedClaims[0]).toContain('출처 문서가 제공되지 않아');
  });
});

// ── LLM 기반 환각 감지 ─────────────────────────────────────────────────────

describe('detectHallucination LLM 기반 감지', () => {
  it('LLM으로 주장별 근거를 검증한다', async () => {
    const result = await detectHallucination(
      '전자정부법 제10조는 서비스 제공에 관한 규정입니다. 2024년에 개정되었습니다.',
      ['전자정부법 제10조: 행정기관의 장은 전자정부서비스를 제공하여야 한다.'],
      '전자정부법 제10조의 내용은?',
    );

    expect(result.totalClaims).toBe(2);
    expect(result.groundedClaims).toBe(1);
    expect(result.ungroundedClaims).toHaveLength(1);
    expect(result.hallucinationRate).toBe(0.5);
    // 0.5 > 0.5 = false, 0.5 > 0.3 = true -> warning
    expect(result.riskLevel).toBe('warning');
  });

  it('환각률 > 0.3이면 hasHallucination=true', async () => {
    const result = await detectHallucination(
      '답변입니다.',
      ['출처입니다.'],
      '질문입니다.',
    );

    // 모의 응답: 2개 주장 중 1개 근거 없음 = 50% 환각률
    expect(result.hasHallucination).toBe(true);
  });

  it('riskLevel을 올바르게 분류한다', async () => {
    // 모의 응답: hallucinationRate = 0.5, 0.5 > 0.3 = warning (not danger, since 0.5 > 0.5 is false)
    const result = await detectHallucination(
      '답변',
      ['출처'],
      '질문',
    );

    expect(result.riskLevel).toBe('warning');
  });
});

// ── 결과 타입 확인 ──────────────────────────────────────────────────────────

describe('HallucinationCheckResult 구조', () => {
  it('모든 필수 필드를 포함한다', async () => {
    const result = await detectHallucination(
      '답변',
      ['출처 문서'],
      '질문',
    );

    expect(result).toHaveProperty('hasHallucination');
    expect(result).toHaveProperty('hallucinationRate');
    expect(result).toHaveProperty('totalClaims');
    expect(result).toHaveProperty('groundedClaims');
    expect(result).toHaveProperty('ungroundedClaims');
    expect(result).toHaveProperty('riskLevel');
    expect(typeof result.hallucinationRate).toBe('number');
    expect(Array.isArray(result.ungroundedClaims)).toBe(true);
  });

  it('hallucinationRate가 0~1 범위이다', async () => {
    const result = await detectHallucination('답변', ['출처'], '질문');
    expect(result.hallucinationRate).toBeGreaterThanOrEqual(0);
    expect(result.hallucinationRate).toBeLessThanOrEqual(1);
  });
});
