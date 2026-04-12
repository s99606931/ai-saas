# SVC-AI-ADV-R82 — 보고서

## Executive Summary
| 관점 | 목표 | 달성 |
|---|---|---|
| 비즈니스 | 첫 응답 지연 최소화 | 빈도 상위 쿼리 사전 warmup |
| 기술 | 시간 감쇠 랭킹 | `0.5 ^ (dt / halfLife)` 반감 |
| 보안 | C/S 차단 + 마스킹 | 등급 guard + 3종 정규식 |
| 규정 | 비용 상한 | `budgetPerRun`, 초과 시 중단 |

## Key Decisions
- **executor 주입**: 실제 캐시 저장소와 LLM 호출은 사용자 executor에 위임 (테스트 가능성 확보)
- **LRU + maxCandidates**: 무한 증가 방지, 오래된 항목 자동 제거
- **기존 `semantic-cache.ts`와 분리**: 저장 모듈이 아닌 예열 전략 모듈

## 테스트 18/18 통과
