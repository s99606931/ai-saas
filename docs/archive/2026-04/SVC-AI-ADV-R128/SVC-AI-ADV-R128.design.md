# SVC-AI-ADV-R128 — AI Embedding Drift Monitor (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0 | 설계자: PM Lead

## 아키텍처 선택: Pragmatic Balance

옵션 3종 비교 후 **차원별 bin 히스토그램 + PSI + 평균 KL** 방식 선택. 외부 통계 라이브러리 비의존, 결정적 계산.

## 핵심 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface DriftMonitorOptions {
  bins?: number           // 기본 10
  epsilon?: number        // 0 나눗셈 방지 1e-6
  psiMinor?: number       // 0.1
  psiMajor?: number       // 0.25
}

export interface DimensionStat {
  dim: number
  min: number
  max: number
  histogram: number[]     // bins 길이
}

export interface DriftReport {
  baselineSize: number
  currentSize: number
  avgKL: number
  avgPSI: number
  severity: 'stable' | 'minor' | 'major'
  perDim: { dim: number; kl: number; psi: number }[]
  timestamp: number
}

export interface DriftAuditEntry {
  action: 'baselineSet' | 'sampleAdded' | 'driftComputed' | 'alertEmitted' | 'reset'
  timestamp: number
  details: Record<string, unknown>
}
```

## API

```typescript
class AIEmbeddingDriftMonitor {
  constructor(grade: DataGrade, options?: DriftMonitorOptions)
  setBaseline(vectors: number[][]): void
  addSample(vectors: number[][]): void
  computeDrift(): DriftReport
  onDriftAlert(listener: (r: DriftReport) => void): void
  reset(): void
  getAuditLog(): DriftAuditEntry[]
}
```

## 알고리즘

### 히스토그램 구축
1. 베이스라인 등록 시 차원별 min/max 저장
2. 각 차원에 대해 bins 개수로 등간격 구간 분할
3. 각 벡터 값이 속하는 bin 카운트 증가
4. 정규화 확률 분포 P[i] = count[i] / totalCount

### PSI 계산 (차원별)
```
PSI = Σ (P_current[i] - P_base[i]) * ln((P_current[i] + ε) / (P_base[i] + ε))
```

### KL divergence (차원별)
```
KL(P || Q) = Σ P[i] * ln((P[i] + ε) / (Q[i] + ε))
```

### Severity 분류 (평균 PSI 기준)
- `avgPSI < 0.1` → stable
- `0.1 <= avgPSI < 0.25` → minor
- `avgPSI >= 0.25` → major + alert emit

## 보안 가드

- 생성자에서 `grade !== O` throw
- 모든 public 메서드에서 벡터 길이 일치 검증
- PII 포함 여부는 호출자 책임 (임베딩 자체는 수치)

## 감사 로그

- baselineSet / sampleAdded / driftComputed / alertEmitted / reset 5종
- timestamp + details 필드
- append-only `auditLog` 배열

## 테스트 계획 (10개+)

1. FR-R128.1 setBaseline 기본
2. FR-R128.2 addSample 누적
3. FR-R128.3 동일 분포 → stable
4. FR-R128.3 shift 분포 → minor/major
5. KL 계산 검증
6. PSI 계산 검증
7. severity 경계값
8. onDriftAlert listener 호출
9. reset
10. C 등급 차단
11. 벡터 길이 불일치 throw
12. getAuditLog append-only

## Design Anchor

- **구현 Ref**: `platform/services/ai-service/src/lib/ai-embedding-drift-monitor.ts`
- **테스트 Ref**: `platform/services/ai-service/src/lib/__tests__/ai-embedding-drift-monitor.test.ts`
- **기존 모듈 구분**: `ai-model-drift.ts`(모델 가중치/성능)와 별개 — 임베딩 분포 드리프트 전용
