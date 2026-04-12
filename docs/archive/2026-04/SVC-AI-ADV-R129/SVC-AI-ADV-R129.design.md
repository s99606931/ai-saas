# SVC-AI-ADV-R129 — Multi-Model Consensus Voter (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0 | 설계자: PM Lead

## 아키텍처 선택: Pragmatic Balance

3전략(majority/weighted/ranked) 단일 클래스 내 분기. 정규화 → 투표 → tiebreaker 파이프라인.

## 핵심 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export type VoteStrategy = 'majority' | 'weighted' | 'ranked'

export interface ModelResponse {
  modelId: string
  answer: string
  confidence?: number       // 0~1
}

export interface ConsensusResult {
  winner: string            // 정규화된 answer
  strategy: VoteStrategy
  support: number           // 득표수 또는 가중합
  totalVotes: number
  tiebreaker?: string       // 동률 시 사용 이유
  distribution: { answer: string; count: number; weight: number }[]
  timestamp: number
}

export interface VoteAuditEntry {
  action: 'modelRegistered' | 'voteConducted' | 'tiebreakerApplied'
  strategy?: VoteStrategy
  winner?: string
  timestamp: number
  details: Record<string, unknown>
}
```

## API

```typescript
class MultiModelConsensusVoter {
  constructor(grade: DataGrade)
  registerModel(modelId: string, weight?: number): void
  decide(strategy: VoteStrategy, responses: ModelResponse[], rankings?: string[][]): ConsensusResult
  getAuditLog(): VoteAuditEntry[]
}
```

## 알고리즘

### 정규화
- `answer.trim().toLowerCase().replace(/\s+/g, ' ')`
- 빈 문자열 → throw

### Majority
- 동일 정규화 answer 카운트 → 최다 득표자
- 동률: modelId 사전순 가장 앞 모델의 answer 선택 (결정성)

### Weighted
- 등록된 model weight 합산 → 최대 weight answer
- 미등록 모델 weight = 1 기본
- 동률: 첫 등장 답변 (안정 정렬)

### Ranked Choice Voting (IRV)
- `rankings[i]` = 모델 i의 선호 순위(정규화된 answer 배열)
- 1순위 집계 → 과반 달성 답변 당선
- 과반 미달: 최소 득표 answer 탈락 → 해당 rankings에서 제거 → 재집계 (반복)
- 동률 탈락: 후순위 총합 작은 것 탈락, 여전히 동률이면 사전순
- 모든 answer 소진 시 첫 기록 answer 선택

## 보안 가드

- 생성자에서 `grade !== O` throw
- 정규화 후 빈 문자열 응답 throw
- responses 빈 배열 throw

## 감사 로그

- modelRegistered / voteConducted / tiebreakerApplied
- append-only

## 테스트 계획 (12개+)

1. FR-R129.1 registerModel + 기본 weight 1
2. FR-R129.3 단순 다수결 승자
3. majority 동률 tiebreaker
4. FR-R129.4 weighted 승자
5. weighted 미등록 모델 weight 1
6. FR-R129.5 ranked 1순위 과반
7. ranked IRV 라운드 탈락
8. ranked 동률 탈락 처리
9. FR-R129.6 decide strategy 분기
10. 정규화(대소문자/공백) 동등성
11. 빈 responses throw
12. C 등급 차단
13. 빈 answer throw
14. getAuditLog append-only

## Design Anchor

- **구현 Ref**: `platform/services/ai-service/src/lib/multi-model-consensus-voter.ts`
- **테스트 Ref**: `platform/services/ai-service/src/lib/__tests__/multi-model-consensus-voter.test.ts`
- **기존 모듈 구분**: `ai-output-ensemble.ts`가 있을 경우 — 해당 모듈은 의미적 유사성 기반, 본 모듈은 투표 기반 결정적 합의
