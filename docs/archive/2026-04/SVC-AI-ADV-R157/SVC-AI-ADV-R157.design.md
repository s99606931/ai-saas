# SVC-AI-ADV-R157 — 컨테이너 보안 스캐너 AI (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }
export type CveSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface CVEEntry {
  id: string           // CVE-YYYY-NNNNN
  cvss: number         // 0~10
  severity: CveSeverity
  affectedPackages: string[]
  description: string
  fixedVersion?: string
}

export interface ContainerImage {
  name: string
  tag: string
  packages: Array<{ name: string; version: string }>
}

export interface ScanFinding {
  cveId: string
  severity: CveSeverity
  cvss: number
  affectedPackage: string
  fixedVersion?: string
  priority: number     // 1-10 (높을수록 긴급)
}

export interface ScanReport {
  image: string
  scanAt: number
  findings: ScanFinding[]
  criticalCount: number
  highCount: number
  patchRecommendations: Array<{ package: string; upgradeToVersion: string }>
}

class ContainerSecurityScannerAI {
  constructor(grade: DataGrade)
  registerCVE(entry: CVEEntry): void
  scan(image: ContainerImage): ScanReport
  getAuditLog(): readonly AuditEntry[]
}
```

## 알고리즘

- 패키지 이름 매칭: CVE affectedPackages ∩ 이미지 packages
- priority: critical=10, high=8, medium=5, low=2 + cvss*0.1
- 패치 권고: fixedVersion 있는 CVE의 패키지만 포함
- 중복 패키지 권고 제거 (최고 priority CVE 기준)
