# MTU-N451-carbon-tracking-ai — Design

## Executive Summary
| 관점 | 결정 | 근거 |
|------|------|------|
| 아키텍처 | Single lib + class | 격리·테스트 용이 |
| 계수 | Map 기반 버전 관리 | DB 연동 전 신뢰 가능 |
| 집계 | period 단위 집계 | 월/분기/연간 |
| 추적성 | FR-CARBON.1~5 매핑 | Q-Gate 통과 |

## Context Anchor
- WHY: 2050 탄소중립 대응 자동 배출량 산정
- WHO: 환경관리 담당자, ESG 보고서 작성자
- RISK: 배출계수 오류 → 과소/과대 산정
- SUCCESS: Scope 1/2/3 분리 집계, 월별 리포트
- SCOPE: platform/services/ai-service/src/lib/carbon-tracking-ai.ts

## 아키텍처 (Pragmatic Balance)
in-memory Map + 단일 class. 배출계수 DB는 외부 주입, 테스트는 fixture.

## 보안 / 규제
- CSAP: D-06 (append-only 로그 외부 모듈 연동), D-12 (입력 검증)
- N2SF: 활동 데이터는 O등급으로 가정, C/S 전환 시 마스킹 필수

## 변경 이력
| 1.0 | 2026-04-11 | 최초 작성 |
