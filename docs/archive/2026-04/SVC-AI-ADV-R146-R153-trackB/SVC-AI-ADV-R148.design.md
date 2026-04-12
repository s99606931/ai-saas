# SVC-AI-ADV-R148 — 공공 서비스 챗봇 v2 (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R148.plan.md

## 1. 아키텍처

```
startSession → addTurn (멀티턴)
      ↓
PublicServiceChatbotV2
  ├─ 세션별 대화 히스토리 (최대 100턴)
  ├─ getContext() — 슬라이딩 윈도우 최근 N턴
  ├─ summarizeSession() — 핵심 키워드 기반 요약
  ├─ endSession() — 최종 기록 + 세션 삭제
  └─ getAuditLog() — append-only
```

## 2. 타입 정의

```typescript
export type DataGrade = 'C' | 'S' | 'O'
export type Role = 'user' | 'assistant' | 'system'
export interface Turn { role: Role; content: string; timestamp: string }
export interface Session {
  sessionId: string; persona: string; grade: DataGrade
  turns: Turn[]; startedAt: string; endedAt?: string }
export interface SessionSummary {
  sessionId: string; turnCount: number; keywords: string[]; summary: string }
```

## 3. 알고리즘

### §3.1 N2SF: C/S 등급 → startSession 시점에 throw
### §3.2 맥락 윈도우: turns.slice(-maxTurns)
### §3.3 요약: 모든 user 턴에서 2글자+ 토큰 추출 → 빈도 상위 5개 키워드

## 4. Design Anchor
- N2SF N-05: C/S 등급 차단 / CSAP D-06: 세션 감사 로그
