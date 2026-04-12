# SVC-AI-ADV-R242 — 공공 서비스 접근성 검사 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
AccessibilityCheckerAI
├── registerRule(id, wcagRef, description, severity)
├── checkPage(pageId, elements[], grade): CheckResult
│   └── 요소별 규칙 평가 → 위반 목록 반환
├── getReport(pageId): AccessibilityReport
│   ├── complianceRate: number
│   ├── violations: Violation[]
│   └── recommendations: string[]
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **규칙 평가**: element.attributes 기반 규칙 조건 매칭
- **준수율**: (전체 검사 - 위반) / 전체 검사 * 100
- **우선순위**: severity critical > error > warning > notice 순

## CSAP D-12 준수

- 입력 검증: pageId/elementId 필수
- N2SF C/S 등급 차단
