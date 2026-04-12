# SVC-AI-ADV-R254 — 맞춤형 시민 서비스 추천 엔진 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
CitizenServiceRecommender
├── registerService(service)
├── registerCitizen(profile, grade)  // O등급만 허용
├── checkEligibility(citizenId, serviceId): EligibilityResult
├── calculatePriority(citizenId, serviceId): number
├── recommend(citizenId, topN): Recommendation[]
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **자격 규칙**: 나이 범위·소득 상한·지역·가구원 수 AND 매칭
- **우선순위 점수**: 자격 적합도(60) + 긴급도(20) + 선호 매칭(20)
- **PII 마스킹**: 감사 로그에 이름·주소 마스킹 저장

## CSAP D-06 준수

- 추천 요청·자격 판정 감사 로그
- N2SF: C/S 차단, PII 마스킹 필수
