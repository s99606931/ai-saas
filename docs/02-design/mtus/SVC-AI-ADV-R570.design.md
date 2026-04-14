# SVC-AI-ADV-R570 Design — AI기반 자동 보안 취약점 스캐닝 v3

## 인터페이스

```typescript
interface Vulnerability {
  cveId: string;
  cvssScore: number;
  isExploited: boolean;
  affectedComponent: string;
}

type VulnSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface ScanResult {
  scanId: string;
  targetSystem: string;
  criticalCount: number;
  highCount: number;
  immediatePatches: string[];   // cveId 목록
  vulnDetails: { cveId: string; severity: VulnSeverity; requiresImmediatePatch: boolean }[];
}
```

## 핵심 알고리즘

- 심각도: cvssScore>=9→CRITICAL / >=7→HIGH / >=4→MEDIUM / else LOW
- 즉시 패치: isExploited===true || cvssScore>=9
- criticalCount: CRITICAL 개수 / highCount: HIGH 개수
- immediatePatches: 즉시 패치 대상 cveId 목록
- 감사 로그: scan 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
- D-12: 시스템 개발 보안
