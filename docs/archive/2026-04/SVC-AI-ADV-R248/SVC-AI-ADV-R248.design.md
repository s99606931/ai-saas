# SVC-AI-ADV-R248 — 자동 법적 준수 검토 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
LegalComplianceReviewerAI
├── registerRegulation(id, name, articles[])
│   └── article: { id, requirement, mandatory }
├── registerPolicy(id, name, capabilities[])
├── analyzeGaps(policyId, regulationId, grade): GapAnalysis
│   └── mandatory requirements - capabilities → gaps
├── generateReport(policyId): ComplianceReport
│   ├── complianceRate: number
│   ├── gaps: GapItem[]
│   └── recommendations: string[]
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **갭 분석**: mandatory article requirements - policy capabilities → 미충족
- **준수율**: (필수 요건 - 갭) / 필수 요건 * 100
- **권고**: 갭 항목별 조치 권고 생성

## CSAP D-06 준수

- 법적 준수 검토 전수 감사 로그
- N2SF C/S 등급 차단
