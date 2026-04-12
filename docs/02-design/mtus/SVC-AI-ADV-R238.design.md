# SVC-AI-ADV-R238 Design: AI기반 공공 조달 자동화

## 구현 파일
`platform/services/ai-service/src/lib/public-procurement-automation-ai.ts`

## 핵심 설계
- 위험 점수: vendorCount<2 +30, SOLE_SOURCE +25, EMERGENCY +20, urgency +20, >5억 +15, vendorCount=1 +20
- riskLevel: ≥60 VERY_HIGH, ≥40 HIGH, ≥20 MEDIUM, else LOW
- requiresCommitteeApproval: 금액≥1억 OR HIGH/VERY_HIGH
- 감사 로그: `request.submit`, `request.review`
