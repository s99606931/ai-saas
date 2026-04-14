# SVC-AI-ADV-R704 Plan — AI기반 민원인 서비스 개인화 v4

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 민원인별 선호·이력 기반 맞춤 공공서비스 추천 |
| WHO | 민원실, 디지털포용팀 |
| RISK | N2SF C/S 개인 민감정보 금지, citizenId sha256 마스킹 필수 |
| SUCCESS | FR-R704.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/citizen-service-personalizer-v4.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R704.1 | 서비스 카탈로그 등록 (serviceId, tags[]) |
| FR-R704.2 | 민원인 프로파일 기록 (citizenId, interestTags[], grade?) - C/S 차단 |
| FR-R704.3 | 추천 (교집합 크기 기반 점수 정렬) |
| FR-R704.4 | 피드백 반영 (LIKE/DISLIKE) - LIKE는 가중, DISLIKE는 제외 |
| FR-R704.5 | getAuditLog() append-only (citizenId 마스킹) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
