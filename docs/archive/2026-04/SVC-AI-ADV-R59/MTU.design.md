# SVC-AI-ADV-R59 — Semantic Firewall Design

## 아키텍처 옵션

| 옵션 | 장점 | 단점 |
|------|------|------|
| A. 정적 룰 only | 빠름, 설명 가능 | 우회 쉬움 |
| B. LLM 분류기 | 높은 정확도 | 비용/지연 |
| **C. 하이브리드 (선택)** | 룰 우선 + 유사도 + 휴리스틱 3단 | 복잡도 중 |

## 모듈 구조

```
SemanticFirewall
 ├─ inspect(prompt, ctx) → InspectResult
 ├─ detectInjectionPatterns(text) → number
 ├─ detectJailbreak(text) → number
 ├─ classifyContent(text) → {toxic, pii, secret}
 ├─ enforceDataGrade(grade)
 ├─ reloadPolicy(policy)
 └─ getAuditLog(limit?)
```

## 데이터 구조

```typescript
interface InspectResult {
  decision: 'allow' | 'block' | 'review';
  score: number;          // 0~1 위험 점수
  reasons: string[];
  timestamp: string;
}
interface FirewallPolicy {
  blockPatterns: string[];
  jailbreakKeywords: string[];
  piiPatterns: RegExp[];
  thresholds: { block: number; review: number };
}
```

## Session Guide

1. `new SemanticFirewall(policy)` → 정책 로드
2. 요청 입력 전 `inspect()` 호출 → decision 확인
3. `block` 시 즉시 거부, `review` 시 Guardrail 단계로
4. 정책 변경은 `reloadPolicy()` 로 핫리로드

## Design Anchor

- Plan FR-R59.1~6 전 항목 반영
- CSAP D-12/D-06, N2SF N-05 매핑
