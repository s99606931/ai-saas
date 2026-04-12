# SVC-AI-ADV-R245 — 서비스 의존성 취약점 스캔 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
DependencyVulnerabilityScannerAI
├── registerPackage(name, version, serviceId)
├── registerCVE(cveId, packageName, affectedVersions[], severity, patchVersion?)
├── scan(serviceId, grade): ScanResult
│   └── 패키지별 CVE 매핑 → 취약 버전 비교
├── getRecommendations(serviceId): PatchRecommendation[]
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **버전 매칭**: affectedVersions 배열에 현재 버전 포함 여부
- **심각도 정렬**: critical > high > medium > low
- **패치 권고**: patchVersion 있으면 업그레이드 권고

## CSAP D-12 준수

- 스캔 결과 감사 로그
- N2SF C/S 등급 차단
