# SVC-AI-ADV-R236 Design: AI기반 사용자 권한 자동 추천

## 구현 파일
`platform/services/ai-service/src/lib/permission-recommendation-ai.ts`

## 핵심 설계
- ROLE_RANK: VIEWER=0, USER=1, OPERATOR=2, ADMIN=3
- `inferRequiredRoles()`: ADMIN>DELETE>WRITE>READ 우선순위
- `recommend()`: rankDiff ≥ 2 → HIGH, ≥ 1 → MEDIUM, 0 → LOW
- 감사 로그: `user.register`, `permission.recommend`

## CSAP 준수
- D-08: 최소 권한 원칙, 접근 통제 자동화
