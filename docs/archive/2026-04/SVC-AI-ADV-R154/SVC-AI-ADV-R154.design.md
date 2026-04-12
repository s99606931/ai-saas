# SVC-AI-ADV-R154 — AI 법령 해석 엔진 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 아키텍처

```
registerArticle(article)
  → keyword index 구축
query(text, grade)
  → PII mask → tokenize → TF overlap 검색
  → 상위 N개 조문 → 해석 생성 → 신뢰도 계산
  → audit log
```

## 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface LegalArticle {
  id: string
  lawName: string
  articleNo: string
  content: string
  keywords?: string[]
}

export interface InterpretationResult {
  query: string
  articles: Array<{ article: LegalArticle; score: number }>
  interpretation: string
  confidence: number
  timestamp: number
}

class LegalInterpretationEngine {
  constructor(grade: DataGrade)
  registerArticle(article: LegalArticle): void
  query(text: string): InterpretationResult
  getAuditLog(): readonly AuditEntry[]
}
```

## 알고리즘

- 토큰화: 한국어 2-gram + 영어 단어
- 조문 검색: 질의 토큰 ∩ 조문 키워드 / 질의 토큰 ∪ 조문 키워드 (Jaccard)
- 상위 3개 조문 선택
- 해석 생성: "제{articleNo}조에 따르면 {content 첫 100자}..."
- 신뢰도: 상위 조문 점수 평균, 조문 0개 → 0

## 보안

- C/S 등급 생성자 차단
- PII 마스킹 (이메일/주민번호/전화)
- audit: register/query 액션
