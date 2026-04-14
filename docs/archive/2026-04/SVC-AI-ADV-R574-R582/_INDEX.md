# SVC-AI-ADV R574~R582 아카이브

> 트랙 C 20차 | 완료일: 2026-04-14

## 완료 MTU 목록

| 라운드 | 모듈 | 테스트 | 결과 |
|--------|------|--------|------|
| R574 | service-performance-predictor-v2.ts | 7/7 | PASS |
| R575 | security-event-auto-responder-v2.ts | 8/8 | PASS |
| R576 | risk-management-automator-v2.ts | 7/7 | PASS |
| R577 | failure-propagation-analyzer-ai.ts | 7/7 | PASS |
| R578 | public-satisfaction-measurer-v3.ts | 7/7 | PASS |
| R579 | container-orchestration-optimizer-ai.ts | 8/8 | PASS |
| R580 | budget-burn-rate-analyzer-v2.ts | 7/7 | PASS |
| R581 | security-posture-assessor-v2.ts | 6/6 | PASS |
| R582 | complaint-auto-router-v2.ts | 7/7 | PASS |

## 집계

- 총 테스트: 64개 (64/64 PASS, 100%)
- TypeScript strict: 0 에러
- CSAP D-06 감사 로그: 전 모듈 getAuditLog() 탑재
- N2SF N-05 C/S 등급 차단: 전 모듈 적용
- PII 마스킹: R578 (userId), R582 (citizenId) — SHA-256 16자 hex

## 핵심 설계 포인트

- **R574**: 예측 점수 = 최근 3개 평균; 저성과 < 60
- **R575**: severity 기반 자동 대응 조치 반환; 고위험 미대응 이벤트 추적
- **R576**: 위험 점수 = likelihood * impact; 고위험 >= 15
- **R577**: BFS 전파 분석; 영향 노드 수 = 방문한 노드 수
- **R578**: 평균 만족도 < 3.0 → 저만족; userId SHA-256 마스킹
- **R579**: avgUsage < 50% → over-provisioned; > 90% → under-provisioned; else → optimal
- **R580**: 소진율 = totalSpent/totalBudget*100; 과소진 > 90%
- **R581**: 보안 점수 = passedChecks/totalChecks*100; 취약 < 70
- **R582**: category → deptId 라우팅; citizenId SHA-256 마스킹
