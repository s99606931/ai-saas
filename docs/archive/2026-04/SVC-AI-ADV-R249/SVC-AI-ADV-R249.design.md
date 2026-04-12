# SVC-AI-ADV-R249 — 공공 데이터 개방 최적화 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
PublicDataOpennessOptimizer
├── registerDataset(id, name, fields[], lastUpdated, recordCount, grade)
├── evaluateQuality(datasetId): QualityScore
│   ├── completeness: 필드 완전성 (필수 필드 채움 비율)
│   ├── freshness: 최신성 (마지막 업데이트 경과일)
│   └── volume: 레코드 수 기반 점수
├── classifyOpenness(datasetId): OpennessGrade  // A/B/C/F
├── getMetadataRecommendations(datasetId): Recommendation[]
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **완전성**: 비어있지 않은 필드 / 전체 필드 * 100
- **최신성**: 경과일 ≤ 30 → 100, ≤ 90 → 70, ≤ 365 → 40, else → 10
- **개방 등급**: 종합 점수 ≥ 80 → A, ≥ 60 → B, ≥ 40 → C, else → F

## CSAP D-09 준수

- 데이터셋 품질 평가 감사 로그
- N2SF C/S 등급 차단
