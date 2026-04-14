# SVC-AI-ADV-R607 Design — AI기반 공공기관 AI 거버넌스 강화 v2

## 인터페이스

```typescript
interface GovernanceInput {
  systemId: string;
  hasExplainability: boolean;
  hasBiasCheck: boolean;
  hasAuditLog: boolean;
  hasHumanOversight: boolean;
  dataGrade: 'C' | 'S' | 'O';
}

type GovernanceGrade = 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT';

interface GovernanceResult {
  systemId: string;
  governanceScore: number;
  grade: GovernanceGrade;
  hasViolation: boolean;
  violationReason: string | null;
}
```

## 핵심 알고리즘

- 점수 = (explain?25:0)+(bias?25:0)+(audit?25:0)+(oversight?25:0)
- 등급: >=75→COMPLIANT / >=50→PARTIAL / else NON_COMPLIANT
- VIOLATION: dataGrade=C||S 이면서 !hasExplainability||!hasHumanOversight
- 감사 로그: evaluate 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
- N-05: C/S 등급 AI 사용 제어
