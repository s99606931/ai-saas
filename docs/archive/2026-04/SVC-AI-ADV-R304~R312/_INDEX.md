# SVC-AI-ADV R304~R312 아카이브 인덱스

**트랙**: C 9차 | **완료일**: 2026-04-13 | **테스트**: 70/70 통과

## 구현 완료 목록

| MTU | 구현 파일 | 테스트 파일 | 테스트 수 |
|-----|-----------|-------------|-----------|
| R304 | microservice-performance-profiler-ai.ts | microservice-performance-profiler-ai.test.ts | 8 |
| R305 | citizen-complaint-pattern-analyzer.ts | citizen-complaint-pattern-analyzer.test.ts | 8 |
| R306 | auth-token-lifecycle-manager-ai.ts | auth-token-lifecycle-manager-ai.test.ts | 8 |
| R307 | service-availability-predictor-ai.ts | service-availability-predictor-ai.test.ts | 8 |
| R308 | public-data-linkage-automator-v2.ts | public-data-linkage-automator-v2.test.ts | 7 |
| R309 | code-complexity-reducer-ai.ts | code-complexity-reducer-ai.test.ts | 8 |
| R310 | smart-api-version-manager.ts | smart-api-version-manager.test.ts | 8 |
| R311 | decision-support-ai.ts | decision-support-ai.test.ts | 7 |
| R312 | anomaly-model-optimizer-ai.ts | anomaly-model-optimizer-ai.test.ts | 8 |

## 문서 위치

- Plan: `docs/01-plan/mtus/SVC-AI-ADV-R304.plan.md` ~ `R312.plan.md`
- Design: `docs/02-design/mtus/SVC-AI-ADV-R304.design.md` ~ `R312.design.md`

## CSAP/N2SF 준수

- N2SF N-05: C/S등급 데이터 차단 전수 구현 (모든 MTU)
- D-06 감사 로그: getAuditLog() append-only 패턴
- D-09 PII 마스킹: SHA-256 16자 (R305)
- D-12 입력 검증: 모든 메서드 경계값 검증
