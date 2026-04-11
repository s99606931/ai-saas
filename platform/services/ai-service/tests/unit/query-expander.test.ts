// 쿼리 확장기 단위 테스트 -- FR-ADV1.4
// Design Ref: SVC-AI-ADV-R1 DESIGN §3
// Plan SC: FR-ADV1.4
// CSAP: D-12 시스템 개발 보안

import { describe, it, expect } from 'vitest';
import { mergeQueryVariants } from '../../src/lib/query-expander.js';
import type { ExpandedQuery } from '../../src/lib/query-expander.js';

// ── mergeQueryVariants 순수 함수 테스트 ───────────────────────────────────────

describe('mergeQueryVariants (FR-ADV1.4)', () => {
  it('확장된 쿼리 변형 목록을 반환한다', () => {
    const expanded: ExpandedQuery = {
      original: '민원 처리 절차',
      variants: ['민원 처리 절차', '민원 접수 방법', '민원 신청 안내'],
      reasoning: '동의어 확장',
    };

    const variants = mergeQueryVariants(expanded);
    expect(variants).toEqual(['민원 처리 절차', '민원 접수 방법', '민원 신청 안내']);
  });

  it('빈 변형 목록을 처리한다', () => {
    const expanded: ExpandedQuery = {
      original: '질문',
      variants: [],
      reasoning: '확장 없음',
    };

    const variants = mergeQueryVariants(expanded);
    expect(variants).toEqual([]);
  });

  it('원본만 포함된 경우를 처리한다', () => {
    const expanded: ExpandedQuery = {
      original: '세금 환급',
      variants: ['세금 환급'],
      reasoning: 'LLM 확장 실패 폴백',
    };

    const variants = mergeQueryVariants(expanded);
    expect(variants).toHaveLength(1);
    expect(variants[0]).toBe('세금 환급');
  });
});

// ── expandQuery는 LLM 의존이므로 통합 테스트로 별도 검증 ──────────────────────
// NOTE: expandQuery()는 LLM provider에 의존하므로 단위 테스트에서 mock 없이 테스트 불가.
//       ruleBasedExpansion (내부 함수)의 동작은 expandQuery의 LLM 실패 폴백으로 간접 검증.
