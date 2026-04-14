# SVC-AI-ADV-R540 Design — AI기반 공공기관 업무 자동화 v2

## 인터페이스

```typescript
interface WorkflowInput {
  taskId: string;
  name: string;
  repetitionRate: number;   // 0~1
  manualSteps: number;      // 단계 수
  avgDurationMin: number;   // 분 단위
  errorProne: boolean;
}

interface AutomationResult {
  taskId: string;
  name: string;
  automationScore: number;
  recommendation: 'AUTOMATE' | 'SEMI_AUTOMATE' | 'MANUAL';
  estimatedTimeSavingsMin: number;
}
```

## 핵심 알고리즘

- 자동화 점수 = repetitionRate×40 + min(manualSteps/10,1)×30 + min(avgDurationMin/60,1)×20 + (errorProne?10:0)
- 추천: ≥70→AUTOMATE / ≥40→SEMI_AUTOMATE / else MANUAL
- 예상 시간 절감 = avgDurationMin × repetitionRate × 0.8
- 감사 로그: evaluate 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
