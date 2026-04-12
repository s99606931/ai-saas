# SVC-AI-ADV-R240 Plan: AI기반 멀티클라우드 네트워크 최적화

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 멀티클라우드 환경 네트워크 이상 자동 탐지 및 최적화 |
| WHO | 인프라 엔지니어, 클라우드 운영팀 |
| RISK | 패킷 손실/대역폭 포화 시 서비스 중단 |
| SUCCESS | 패킷손실/대역폭/지연 기반 자동 조치 권고 |
| SCOPE | ai-service 내 MulticloudNetworkOptimizer 클래스 |

## 요구사항
- FR-R240.1: 패킷 손실 2% 초과 → REROUTE
- FR-R240.2: 대역폭 사용률 85% 초과 → INCREASE_BANDWIDTH
- FR-R240.3: 지연 200ms 초과 (비온프레미스) → ENABLE_CDN
- FR-R240.4: CSAP D-06 감사 로그
