# SVC-AI-ADV-R236 Plan: AI기반 사용자 권한 자동 추천

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | CSAP D-08 최소 권한 원칙 자동 적용으로 과도 권한 방지 |
| WHO | 시스템 관리자, 보안 담당자 |
| RISK | 과도 권한 부여 시 내부 정보 유출 |
| SUCCESS | 실제 접근 패턴 기반 최소 권한 권고 + 위험 등급 산출 |
| SCOPE | ai-service 내 PermissionRecommendationAi 클래스 |

## 요구사항
- FR-R236.1: 접근 패턴 기반 VIEWER/USER/OPERATOR/ADMIN 권고
- FR-R236.2: 현재 권한과 권고 권한 비교 → 추가/제거 목록
- FR-R236.3: 권한 차이 2단계 이상 → HIGH 위험
- FR-R236.4: CSAP D-06 감사 로그
