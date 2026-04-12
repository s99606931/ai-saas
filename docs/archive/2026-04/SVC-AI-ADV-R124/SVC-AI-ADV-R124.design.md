# SVC-AI-ADV-R124 — LLM Input Injection Sentinel (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## Design Anchor

- **아키텍처**: Pattern Catalog + Scoring Engine + Decision Gate
- **선정 이유**: Pragmatic Balance — 결정적 정규식 기반(공공망 분리·재현성), 외부 LLM 미의존
- **대안**:
  1. LLM-only — 정확도↑, 비용·지연↑ (`prompt-injection-detector.ts`가 담당)
  2. Pattern-only(선정) — 결정적, 고속, 캐시 친화
  3. Hybrid — 향후 R??에서 결합 가능

## 카탈로그 구조

```typescript
type InjectionCategory = 'direct' | 'indirect' | 'jailbreak'

interface InjectionPattern {
  id: string
  category: InjectionCategory
  pattern: RegExp
  weight: number      // 0~1
  description: string
}
```

기본 패턴 (한·영 양언어):

| ID | 카테고리 | 패턴 | 가중치 |
|---|---|---|---|
| direct.ignore.ko | direct | `이전\s*(지시|명령).*무시` | 0.8 |
| direct.ignore.en | direct | `ignore\s+(previous|prior).*instructions` | 0.8 |
| direct.role.ko | direct | `너는\s+이제` | 0.5 |
| direct.role.en | direct | `you\s+are\s+now\s+(a|an)` | 0.5 |
| jailbreak.dan | jailbreak | `\b(DAN|developer\s+mode)\b` | 0.9 |
| jailbreak.system.ko | jailbreak | `시스템\s*프롬프트.*(공개|출력)` | 0.9 |
| jailbreak.system.en | jailbreak | `print\s+system\s+prompt` | 0.9 |
| indirect.url | indirect | `<!--\s*injection` | 0.7 |
| indirect.html | indirect | `</?(script|iframe)>` | 0.6 |
| indirect.markdown.image | indirect | `!\[.*\]\(javascript:` | 0.7 |

## 점수 계산

```
rawScore = Σ(pattern.weight)
whitelistDeduction = Σ(matched whitelist tokens) * 0.2
score = clamp(rawScore - whitelistDeduction, 0, 1)
```

여러 매칭 시 동일 가중치 합산하되 1.0으로 cap.

## Severity / Decision

| score | severity | decision |
|---|---|---|
| < 0.2 | safe | allow |
| < 0.5 | suspicious | sanitize |
| < 0.8 | high | sanitize |
| ≥ 0.8 | critical | block |

`sanitize` = 매칭 부분을 `[REDACTED:injection]`로 치환한 텍스트 함께 리턴.

## 인터페이스

```typescript
interface SentinelVerdict {
  score: number
  severity: 'safe' | 'suspicious' | 'high' | 'critical'
  decision: 'allow' | 'sanitize' | 'block'
  matches: Array<{
    patternId: string
    category: InjectionCategory
    snippet: string  // 마스킹된 발췌
  }>
  sanitized: string
}

class LLMInputInjectionSentinel {
  constructor()
  scan(text: string, grade: DataGrade): SentinelVerdict
  addPattern(p: InjectionPattern): void
  addWhitelistToken(token: string): void
  getAuditLog(): readonly SentinelAuditEntry[]
}
```

## PII 마스킹 (snippet)

- 이메일: `***@***`
- 전화번호: `***-****-****`
- 주민번호: `******-*******`

## Session Guide

1. 기본 카탈로그 로드된 sentinel 인스턴스 생성
2. 사용자 입력마다 scan(text, DataGrade.O) 호출
3. block → 즉시 거절 응답
4. sanitize → sanitized 텍스트로 LLM 호출
5. allow → 원문 그대로 통과
