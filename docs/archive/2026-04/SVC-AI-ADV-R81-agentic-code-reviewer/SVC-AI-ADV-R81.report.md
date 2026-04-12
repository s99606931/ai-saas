# SVC-AI-ADV-R81 — 보고서

## Executive Summary
| 관점 | 목표 | 달성 |
|---|---|---|
| 비즈니스 | 이슈 검출률 ≥ 85% | 시드 패치 기반 기본 패턴 100% 탐지 |
| 기술 | 4단계 파이프라인 | design/security/quality/compliance 순차 |
| 보안 | 시크릿/SQLi/XSS/평문저장 선차단 | 8종 기본 패턴 + addPattern 확장 |
| 규정 | CSAP D-12 + D-06 | compliance fail → 자동 block |

## Key Decisions
- **executor 주입형 설계**: 기본 regex 기반 executor 5종 제공, LLM 기반으로 대체 가능
- **compliance 단계 강제 차단**: `blockOnComplianceFail` 옵션(기본 true)으로 감리 대응
- **기존 모듈과 분리**: `code-review-ai.ts` (단일 보안 스캐너)와 달리, R81은 다단계 에이전틱 의사결정 파이프라인

## Success Criteria 최종 상태
- FR-R81.1 등급 guard + 선차단: ✅
- FR-R81.2 4단계 파이프라인: ✅
- FR-R81.3 단계별 판정+근거: ✅
- FR-R81.4 종합 판결+compliance 차단: ✅
- FR-R81.5 감사 로그: ✅

## 테스트 21/21 통과
