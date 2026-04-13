# SVC-AI-ADV-R265 — 공공 서비스 추천 엔진 v2 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
PublicServiceRecommenderV2
├── registerService(id, name, category, tags[])
├── recordUsage(userId, serviceId, grade)  // PII 마스킹: userId → hash
├── recommend(userId, topN): Recommendation[]
│   ├── 이용 이력 없음 → 인기도 기반 폴백
│   └── 이력 있음 → 유사 사용자 Jaccard 유사도 기반
├── getPopularServices(topN): ServiceInfo[]
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **유사 사용자**: Jaccard(userA services ∩ userB services) / (userA ∪ userB)
- **협업 필터링**: 유사 사용자들이 이용한 서비스 중 미이용 → 추천
- **폴백**: 이용 횟수 내림차순 인기 서비스

## CSAP D-09 준수

- userId PII 마스킹 (SHA-256 해시)
- N2SF C/S 등급 차단, 감사 로그
