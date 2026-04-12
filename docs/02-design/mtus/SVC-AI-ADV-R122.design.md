# SVC-AI-ADV-R122 — Compliance Report Generator (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## Design Anchor

- **아키텍처**: Registry + Aggregator + Markdown Renderer
- **선정 이유**: Pragmatic Balance — 표준 양식 + pluggable 프레임워크 확장

## 인터페이스

```typescript
type Framework = 'CSAP' | 'N2SF' | 'MOIS'  // 행안부
type ControlStatus = 'compliant' | 'partial' | 'non-compliant' | 'not-applicable'

interface ControlItem {
  id: string
  framework: Framework
  description: string
  required: boolean
}

interface Evidence {
  controlId: string
  path: string        // docs/..., src/...
  description: string
  addedAt: string
  grade: DataGrade
}

interface ControlRecord {
  control: ControlItem
  status: ControlStatus
  evidences: Evidence[]
  note?: string
}

interface FrameworkCoverage {
  framework: Framework
  totalRequired: number
  compliant: number
  partial: number
  nonCompliant: number
  notApplicable: number
  coverageRate: number   // compliant / totalRequired
}

interface ComplianceSummary {
  generatedAt: string
  frameworks: FrameworkCoverage[]
  missing: string[]      // non-compliant + partial
  totalControls: number
}

class ComplianceReportGenerator {
  constructor()
  registerControl(c: ControlItem): void
  setStatus(controlId: string, status: ControlStatus, note?: string): void
  addEvidence(e: Evidence): void
  getSummary(): ComplianceSummary
  renderMarkdown(options?: { title?: string }): string
  getAuditLog(): readonly CRGAuditEntry[]
}
```

## 커버리지 계산

- `coverageRate` = compliant / totalRequired (not-applicable 제외)
- 미흡 항목: status === 'non-compliant' || 'partial'

## Markdown 템플릿

```
# {title}
생성일: {ISO}

## 프레임워크별 커버리지
| 프레임워크 | 총 항목 | 이행 | 부분 | 미이행 | 커버리지 |
| ... |

## 미흡 항목
- [CONTROL-ID] 설명 — 상태: partial — 증적: N개

## 증적 전수
- [CONTROL-ID] 경로 (YYYY-MM-DD)
```

## Session Guide

1. registerControl로 CSAP/N2SF/행안부 항목 등록
2. 구현 완료마다 setStatus/addEvidence 호출
3. 분기 말 getSummary + renderMarkdown으로 리포트 생성
