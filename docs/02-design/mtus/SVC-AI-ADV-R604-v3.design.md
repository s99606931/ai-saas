# SVC-AI-ADV-R604 (v3) Design — AI기반 컴플라이언스 갭 분석 v3

## 인터페이스
```typescript
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface ControlItem {
  id: string;
  required: boolean;
  implemented: boolean;
  severity: Severity;
}

interface GapResult {
  totalControls: number;
  gaps: number;
  gapScore: number;
  prioritized: string[];
}

class ComplianceGapAnalyzerV3 {
  analyze(controls: ControlItem[]): GapResult;
  getAuditLog(): AuditEntry[];
}
```

## 알고리즘
- weight: CRITICAL=10, HIGH=5, MEDIUM=2, LOW=1.
- gap 조건: required && !implemented.
- prioritized: gap items severity desc 정렬, 동일 시 id asc.
