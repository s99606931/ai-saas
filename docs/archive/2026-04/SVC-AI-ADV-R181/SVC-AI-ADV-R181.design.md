# SVC-AI-ADV-R181 Design — AI 기반 규제 변경 영향 평가

> 작성일: 2026-04-12 | 버전: 1.0.0

## 클래스 설계

```
RegulatoryImpactAssessor
  ├── regulations: Map<string, Regulation>
  ├── components: Map<string, SystemComponent>
  ├── auditLog: RIAAuditEntry[]
  ├── registerRegulation(reg) → void
  ├── registerComponent(comp) → void
  ├── assess(regulationId) → ImpactAssessment
  └── getAuditLog() → readonly RIAAuditEntry[]
```

## 핵심 알고리즘

- 영향 매핑: 규제 키워드 ∩ 컴포넌트 키워드 → Jaccard 점수
- 영향 점수 ≥ 0.3 → impacted
- 갭 분석: compliance 키워드 미포함 컴포넌트 → gap 항목
- 우선순위: 영향 점수 내림차순

## 보안 설계

- DataGrade C/S 차단 (N2SF N-05)
- 감사 로그 append-only
