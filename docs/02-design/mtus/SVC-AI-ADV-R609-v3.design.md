# SVC-AI-ADV-R609 (v3) Design — AI기반 API 보안 스캐너 v3

## 인터페이스
```typescript
type ScanSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NONE';
type ScanFinding = 'AUTH_MISSING' | 'HTTPS_MISSING' | 'INPUT_VALIDATION_MISSING' | 'RATE_LIMIT_MISSING';

interface EndpointInput {
  id: string;
  path: string;
  method: string;
  hasAuth: boolean;
  hasHttps: boolean;
  hasRateLimit: boolean;
  hasInputValidation: boolean;
}

interface EndpointResult {
  id: string;
  findings: ScanFinding[];
  maxSeverity: ScanSeverity;
}

interface ScanResult {
  totalEndpoints: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  items: EndpointResult[];
}

class ApiSecurityScannerV3 {
  scan(endpoints: EndpointInput[]): ScanResult;
  getAuditLog(): AuditEntry[];
}
```

## 알고리즘
- 각 엔드포인트별 결함 검사 4종.
- maxSeverity: 결함이 있을 때 최상 severity 선택.
- 카운트는 maxSeverity 기준 집계.
