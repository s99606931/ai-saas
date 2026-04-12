# SVC-AI-ADV-R130 — Cost Anomaly Detector (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0 | 설계자: PM Lead

## 아키텍처 선택: Pragmatic Balance

3지표 앙상블(Z-score + IQR + rate) + cool-down 기반 중복 알람 억제.

## 핵심 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface CostPoint {
  tenantId: string
  timestamp: number
  cost: number
}

export interface DetectorOptions {
  windowSize?: number         // 기본 30
  zThreshold?: number         // 기본 3.0
  iqrMultiplier?: number      // 기본 1.5
  rateThreshold?: number      // 기본 2.0 (200% 급증)
  coolDownMs?: number         // 기본 5분
}

export type AnomalySeverity = 'normal' | 'warning' | 'critical'

export interface AnomalyReport {
  tenantId: string
  timestamp: number
  cost: number
  zScore: number
  iqrBoundary: number
  rateOfChange: number
  severity: AnomalySeverity
  reasons: string[]
}

export interface AnomalyAuditEntry {
  action: 'recorded' | 'detected' | 'alertEmitted' | 'coolDownSuppressed'
  tenantId: string
  timestamp: number
  details: Record<string, unknown>
}
```

## API

```typescript
class CostAnomalyDetector {
  constructor(grade: DataGrade, options?: DetectorOptions)
  record(point: CostPoint): void
  detect(tenantId: string): AnomalyReport
  onAnomaly(listener: (r: AnomalyReport) => void): void
  getAuditLog(): AnomalyAuditEntry[]
}
```

## 알고리즘

### 롤링 윈도우
- tenantId별 CostPoint[] 유지, windowSize 초과 시 FIFO 제거

### Z-score
```
mean = Σ xi / n
std = sqrt(Σ (xi - mean)² / n)
z = (latest - mean) / (std + ε)
```

### IQR
- 정렬된 윈도우에서 Q1(25%), Q3(75%) 계산
- IQR = Q3 - Q1
- boundary = Q3 + iqrMultiplier * IQR (상향만 감지, cost 급증 포커스)

### Rate of Change
- `rate = latest / (prev + ε)`

### Severity 판정
- reasons 배열에 위반 지표 추가:
  - `z > zThreshold` → "z-score"
  - `latest > boundary` → "iqr-outlier"
  - `rate > rateThreshold` → "rate-spike"
- 위반 0개 → normal
- 위반 1개 → warning
- 위반 2개+ → critical + alert emit (cool-down 적용)

### Cool-down
- tenantId별 마지막 critical alert 시각 기록
- 현재 시각 - last < coolDownMs → 억제 (coolDownSuppressed 감사)

## 보안 가드

- 생성자 `grade !== O` throw
- windowSize < 3 → 충분 데이터 없음으로 severity = normal (detect는 실행)
- cost < 0 → throw

## 테스트 계획 (12개+)

1. FR-R130.1 record 및 window 초과 FIFO
2. FR-R130.2 Z-score 계산 검증
3. FR-R130.3 IQR boundary 계산
4. FR-R130.4 rate 계산
5. FR-R130.5 normal (평탄 데이터)
6. warning (단일 지표 위반)
7. critical (2개+ 지표 위반)
8. FR-R130.6 onAnomaly listener 호출
9. cool-down 억제
10. 음수 cost throw
11. C 등급 차단
12. windowSize 미달 → normal
13. getAuditLog append-only

## Design Anchor

- **구현 Ref**: `platform/services/ai-service/src/lib/cost-anomaly-detector.ts`
- **테스트 Ref**: `platform/services/ai-service/src/lib/__tests__/cost-anomaly-detector.test.ts`
- **기존 모듈 구분**: `ai-token-budget-manager.ts`(R123, 사전 한도 거부), 본 모듈은 사후 통계 탐지. `anomaly-detector.ts`(일반 수치)와 별개로 비용 특화.
