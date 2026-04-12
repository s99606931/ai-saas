# SVC-AI-ADV-R89 — Oncall Escalation Router (Design)

> v1.0.0 | 2026-04-12

## 구조
```ts
export interface Responder {
  id: string;
  domains: string[];      // 'infra','db','ai','security'
  level: 1 | 2 | 3;       // 1=primary
  fatigue: number;        // 0~1 (1=완전 피로)
  available: boolean;
}

export interface Incident {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  domain: string;
  summary?: string;
}

export interface RouteResult {
  primary: Responder | null;
  chain: Responder[];  // 에스컬레이션 순서
  skipped: Array<{ id: string; reason: string }>;
}
```

## 알고리즘
1. 도메인 매칭 담당자 필터
2. 피로도 > 0.8 → 제외(skipped)
3. 심각도-레벨 매칭: critical → level 1, high → 1~2, medium → 2~3
4. 피로도 오름차순 정렬 → primary = 첫 번째, chain = 그 다음
5. 응답없음 시 `nextInChain()` 호출 가능

## Session Guide
- 구현: `oncall-escalation-router.ts`
- 테스트: `__tests__/oncall-escalation-router.test.ts`
- Plan SC: FR-R89.1~5
