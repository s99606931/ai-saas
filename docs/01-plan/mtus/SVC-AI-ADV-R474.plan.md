# SVC-AI-ADV-R474 Plan — AI기반 클라우드 마이그레이션 계획 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 온프레미스 시스템의 클라우드 마이그레이션 복잡도를 AI로 자동 평가하여 계획 수립 지원 |
| WHO | 클라우드 아키텍트, IT 기획팀 |
| RISK | 복잡도 과소평가로 인한 마이그레이션 실패 방지 필요 |
| SUCCESS | SC-R474-1: 시스템 등록 / SC-R474-2: 복잡도 점수 계산 / SC-R474-3: C/S 등급 차단 |
| SCOPE | cloud-migration-planner-v2.ts 구현 |

## 요구사항
- FR-R474.1: 시스템 등록 (systemId, name, techStack: legacy/modern/cloud-native)
- FR-R474.2: 의존성 추가 (systemId, dependencyCount)
- FR-R474.3: 복잡도 점수 = min(100, dependencyCount*10 + techStackScore) (legacy:30, modern:15, cloud-native:5)
- FR-R474.4: 마이그레이션 전략 (>=70: refactor, >=40: replatform, else rehost)
- FR-R474.5: N2SF N-05 C/S 등급 차단

## 추적성
FR-R474.* ↔ `cloud-migration-planner-v2.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
