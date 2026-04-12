# SVC-AI-ADV-R235 Design: AI기반 자동 보안 감사 보고서 생성

## 구현 파일
`platform/services/ai-service/src/lib/auto-security-audit-reporter.ts`

## 핵심 설계
- `AuditScope`: auditId, targetSystem, standards
- `AuditFinding`: severity (CRITICAL/HIGH/MEDIUM/LOW), category
- `generateReport()`: 감점 계산 → complianceScore, bySeverity, criticalIssues
- 감사 로그: `audit.register`, `audit.report`

## CSAP 준수
- D-06: 감사 등록/보고 이벤트 append-only 로그
