# SVC-AI-ADV-R136 — 감사 증적 자동 수집 (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R136.plan.md

## 1. 아키텍처

```
registerEvidence → mapToCsap
      ↓
AuditEvidenceCollector
  ├─ analyzeGaps() — 미매핑 CSAP 항목 목록
  ├─ getComplianceReport() — 충족률 + 항목별 상태
  └─ getAuditLog() — append-only
```

## 2. 타입 정의

```typescript
export interface Evidence { evidenceId: string; title: string; type: string; collectedAt: string }
export interface CsapItem { itemId: string; domain: string; description: string }
export interface ComplianceReport {
  totalItems: number; satisfiedItems: number; satisfactionRate: number
  gaps: CsapItem[]; evidenceMap: Record<string, string[]> }
```

## 3. 알고리즘

### §3.1 갭 분석: 전체 CSAP 항목 중 매핑된 증적이 없는 항목 추출
### §3.2 충족률: `satisfiedItems / totalItems`
### §3.3 기본 CSAP 항목: D-06/D-08/D-09/D-12 도메인 대표 항목 내장

## 4. Design Anchor

- CSAP D-06: 증적 수집 감사 로그
- append-only 증적 저장
