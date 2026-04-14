# SVC-AI-ADV-R606 (v3) Design — AI기반 민원인 감정 분석 v3

## 인터페이스
```typescript
interface SentimentInput {
  id: string;
  citizenEmail: string;
  text: string;
  grade: 'C' | 'S' | 'O';
}

type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

interface SentimentResult {
  id: string;
  sentiment: Sentiment;
  score: number;
  maskedCitizen: string;
}

class CitizenSentimentAnalyzerV3 {
  analyze(input: SentimentInput): SentimentResult;
  getAuditLog(): AuditEntry[];
}
```

## 알고리즘
- C/S → BLOCKED
- 부정 키워드 6개, 긍정 키워드 5개 카운트
- score = positive - negative
- ≤-2 NEGATIVE, ≥2 POSITIVE, else NEUTRAL
- citizenEmail SHA-256 16자
