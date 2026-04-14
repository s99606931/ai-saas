# SVC-AI-ADV-R567 Design — AI기반 공공기관 정보 자산 관리

## 인터페이스

```typescript
interface AssetInput {
  assetId: string;
  assetName: string;
  dataGrade: 'C' | 'S' | 'O';
  exposureLevel: number;    // 0~10
  lastAuditDays: number;
}

type RiskGrade = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type AuditAction = 'IMMEDIATE_AUDIT' | 'SCHEDULE_AUDIT' | 'MONITOR' | 'ROUTINE';

interface AssetRiskResult {
  assetId: string;
  riskScore: number;
  riskGrade: RiskGrade;
  recommendedAction: AuditAction;
}
```

## 핵심 알고리즘

- 위험 점수 = (C→40/S→30/O→10) + exposureLevel×3 + min(lastAuditDays/365,1)×30
- 등급: ≥70→CRITICAL / ≥50→HIGH / ≥30→MEDIUM / else LOW
- 권고: CRITICAL→IMMEDIATE_AUDIT / HIGH→SCHEDULE_AUDIT / MEDIUM→MONITOR / LOW→ROUTINE
- 감사 로그: assess 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
- N-05: 데이터 등급 분류
