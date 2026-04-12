# SVC-AI-ADV-R55 — AI Cost Allocation

> 2026-04-12 | v1.0.0 | 작성자: PM Lead

## Executive Summary
| 관점 | 목표 |
|---|---|
| 비즈니스 | 테넌트별 AI API 비용 정확 과금, 월 정산 자동화 |
| 기술 | 호출별 토큰/모델/테넌트 태깅 + 단가 테이블 기반 집계 |
| 보안 | 비용 데이터는 C등급 취급, 집계만 노출 |
| 규정 | CSAP D-06 감사, 행안부 정보화 사업 정산 |

## Context Anchor
- **WHY**: 테넌트별 AI 사용량과 비용을 분리해 공공기관 과금/정산 지원
- **WHO**: 재무·운영팀, 테넌트 관리자
- **RISK**: 잘못된 단가 → 월말 정산 오류 → 테이블 버전 관리 필수
- **SUCCESS**: 호출별 비용 기록 100%, 월별 집계 오차 < 0.1%
- **SCOPE**: 호출 기록, 단가 테이블, 테넌트·모델·일자별 집계

## FR
| FR | 산출물 |
|---|---|
| FR-R55.1 호출 기록(record) | `ai-cost-allocation.ts::record` |
| FR-R55.2 단가 테이블 관리 | `::setPricing/getPricing` |
| FR-R55.3 호출별 비용 계산 | `::computeCost` |
| FR-R55.4 테넌트별 월 집계 | `::aggregateByTenant` |
| FR-R55.5 모델별 집계 | `::aggregateByModel` |
| FR-R55.6 감사 로그 | `::getAuditLog` |

## NFR
- 단일 record < 0.5ms, 집계 1만 건 < 100ms
- TS strict 통과, 테스트 커버리지 80%+

## 추적성
| FR | 산출물 | 테스트 |
|---|---|---|
| FR-R55.1~6 | ai-cost-allocation.ts | `__tests__/ai-cost-allocation.test.ts` |

## 변경 이력
| 1.0.0 | 2026-04-12 | 초안 |
