# SVC-AI-ADV-R605 (v3) Design — AI기반 장애 근본 원인 분석 v3

## 인터페이스
```typescript
interface IncidentSignal {
  incidentId: string;
  errorRate: number;
  latencyMs: number;
  cpuPct: number;
  memPct: number;
  deployedRecently: boolean;
}

type RootCause = 'CODE_ERROR' | 'RESOURCE_EXHAUSTION' | 'MEMORY_LEAK' | 'RECENT_DEPLOY' | 'UNKNOWN';
type Recommendation = 'ROLLBACK' | 'SCALE_OUT' | 'MONITOR';
type Severity = 'CRITICAL' | 'HIGH' | 'LOW';

interface RcaResult {
  incidentId: string;
  rootCause: RootCause;
  recommendation: Recommendation;
  severity: Severity;
}

class IncidentRootCauseAiV3 {
  analyze(signal: IncidentSignal): RcaResult;
  getAuditLog(): AuditEntry[];
}
```

## 알고리즘
1. errorRate>0.5 → CODE_ERROR
2. else if latencyMs>5000 → RESOURCE_EXHAUSTION
3. else if memPct>90 → MEMORY_LEAK
4. else if deployedRecently → RECENT_DEPLOY
5. else → UNKNOWN
- recommendation/severity 매핑은 FR 기준.
