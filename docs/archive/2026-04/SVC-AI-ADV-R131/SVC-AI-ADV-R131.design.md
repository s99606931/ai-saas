# SVC-AI-ADV-R131 — Conversation Topic Tracker (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0 | 설계자: PM Lead

## 아키텍처 선택: Pragmatic Balance

세션별 키워드 프로필 유지 + 메시지 추가 시 유사도 계산 + 누적 drift. 한국어 2-gram + 영어 단어 TF.

## 핵심 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface TrackerOptions {
  topKKeywords?: number       // 기본 10
  similarityThreshold?: number // 기본 0.3 — 이하 시 drift 누적
  driftAlertThreshold?: number // 기본 2.0 누적
  maxMessagesPerSession?: number // 기본 200
}

export interface TopicProfile {
  keywords: Set<string>
}

export interface MessageAnalysis {
  sessionId: string
  index: number
  similarity: number
  drifted: boolean
  contribution: number        // (1 - similarity) when drifted
  maskedText: string
}

export interface SessionState {
  sessionId: string
  initialProfile: TopicProfile
  cumulativeProfile: TopicProfile
  driftScore: number
  messages: MessageAnalysis[]
  alerted: boolean
}

export interface TopicDriftEvent {
  sessionId: string
  driftScore: number
  timestamp: number
}

export interface TopicAuditEntry {
  action: 'sessionStarted' | 'messageAdded' | 'driftDetected' | 'alertEmitted'
  sessionId: string
  timestamp: number
  details: Record<string, unknown>
}
```

## API

```typescript
class ConversationTopicTracker {
  constructor(grade: DataGrade, options?: TrackerOptions)
  startSession(sessionId: string, initialMessage: string): void
  addMessage(sessionId: string, message: string): MessageAnalysis
  extractKeywords(text: string): Set<string>
  computeSimilarity(a: Set<string>, b: Set<string>): number
  getDriftScore(sessionId: string): number
  onTopicDrift(listener: (e: TopicDriftEvent) => void): void
  getAuditLog(): TopicAuditEntry[]
}
```

## 알고리즘

### PII 마스킹 (addMessage 입력 선처리)
- `\b[\w.]+@[\w.]+\.\w+\b` → `***@***`
- `\b\d{6}-\d{7}\b` → `******-*******`
- `\b010-\d{4}-\d{4}\b` → `010-****-****`

### 토큰화
- 한국어: 한글 연속 블록 2-gram 추출 (예: `행정안전부` → `행정`, `정안`, `안전`, `전부`)
- 영어: `/[a-z0-9]+/gi` → lowercase
- 1글자 이하 제거

### TF 상위 키워드
- 빈도 카운트 → 상위 topKKeywords 유지 (동률은 사전순)
- `Set<string>` 반환

### Jaccard 유사도
- `|A ∩ B| / |A ∪ B|`, 공집합 → 0

### Drift 누적
- `similarity < similarityThreshold` → drifted = true
- `contribution = 1 - similarity`
- `driftScore += contribution`
- `driftScore >= driftAlertThreshold && !alerted` → emit + alerted = true

### cumulativeProfile 갱신
- 새 메시지 키워드를 cumulative에 union
- (초기 비교는 initialProfile 기준으로 유지 — 원 주제 이탈 감지)

## 보안 가드

- 생성자 `grade !== O` throw
- 미등록 sessionId → throw
- 세션당 maxMessagesPerSession 초과 → throw

## 테스트 계획 (12개+)

1. FR-R131.1 startSession + 초기 키워드 추출
2. FR-R131.2 동일 주제 메시지 유사도 높음
3. 다른 주제 메시지 drift 누적
4. FR-R131.3 extractKeywords 한국어 2-gram
5. extractKeywords 영어 단어
6. FR-R131.4 computeSimilarity 경계 (동일/완전 상이)
7. FR-R131.5 getDriftScore 누적
8. FR-R131.6 onTopicDrift emit
9. 알람 중복 방지 (alerted 플래그)
10. PII 마스킹 (이메일/주민번호/전화)
11. C 등급 차단
12. 미등록 세션 throw
13. maxMessages 초과 throw
14. getAuditLog append-only

## Design Anchor

- **구현 Ref**: `platform/services/ai-service/src/lib/conversation-topic-tracker.ts`
- **테스트 Ref**: `platform/services/ai-service/src/lib/__tests__/conversation-topic-tracker.test.ts`
- **기존 모듈 구분**: `chatbot-off-topic-guard.ts`(단일 메시지 즉시 차단)와 별개 — 본 모듈은 세션 단위 누적 드리프트 추적.
