# SVC-AI-ADV-R83 — 설계

## 모듈
- `conversation-context-pruner.ts`
  - `ConversationContextPruner` 클래스

## 핵심 타입
```typescript
type DataGrade = 'C' | 'S' | 'O';
type Role = 'system' | 'user' | 'assistant';

interface Turn {
  role: Role;
  content: string;
  at?: number;
  grade?: DataGrade;
}

interface ScoredTurn extends Turn {
  index: number;
  score: number;
  tokens: number;
}

type Summarizer = (turns: Turn[]) => Promise<string>;

interface PrunerOptions {
  maxTokens: number;            // default 2000
  keepSystem: boolean;          // default true
  keepLastN: number;            // default 4 (최근 N턴 보존)
  keywords: string[];           // 중요 키워드 부스트
  keywordBoost: number;         // default 2
  userBoost: number;            // default 1.5
  lengthPenalty: number;        // default 0.01 (긴 턴 감점)
}

interface PruneResult {
  kept: Turn[];
  removed: number;
  summarized: number;
  totalTokens: number;
  originalTokens: number;
}
```

## 토큰 추정
```
tokens = ceil(content.length / 4)  // 대략 4자당 1토큰 (한글 포함 근사)
```

## 점수 산정
```
score = baseScore
baseScore:
  - role=system → +10 (keepSystem 시 강제 보존)
  - role=user → +userBoost
  - role=assistant → +1
  - 최근성: lastN 내 → +5
  - 키워드 포함 → +keywordBoost per match
  - 길이 페널티: -tokens * lengthPenalty
```

## 동작
1. 원본 턴 → ScoredTurn[] 생성 (PII 마스킹)
2. keepSystem + keepLastN 보존 집합 표시
3. 나머지: 점수 내림차순 정렬
4. 토큰 한도까지 포함, 초과분 제거
5. 제거된 연속 턴이 많으면 summarizer 호출 → 요약 턴 삽입
6. 최종 kept는 원본 순서 유지

## 마스킹 (N-05)
email / phone / RRN → ***@*** / ***-****-**** / ******-*******

## 감사 이벤트
PRUNE_START / PRUNE_DONE / REMOVED / SUMMARIZED / MASKED / BLOCKED
