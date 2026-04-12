# MTU-N442-data-residency-policy — Design

## Executive Summary
| 관점 | 결정 | 근거 |
|------|------|------|
| 아키텍처 | Single lib + service class | 테스트 용이, 격리 |
| 보안 | CSAP D-09 준수 | append-only 감사 |
| 운영 | In-memory + 감사 로그 | 최소 의존성 |
| 추적성 | FR-N442.1~5 매핑 | Q-Gate 통과 |

## Context Anchor
- **WHY**: 데이터 거주성 정책 기능 확보
- **WHO**: 테넌트 관리자, 운영자, 감사관
- **RISK**: 격리 실패, 감사 누락
- **SUCCESS**: 전 테스트 PASS
- **SCOPE**: lib/data-residency-policy.ts + vitest

## 아키텍처 (Pragmatic Balance)
순수 in-memory 단일 lib — 단순/고성능/테스트 가능

## 보안 / 규제
- CSAP: D-09
- N2SF: O등급만 AI API 전송, C/S 마스킹 필수

## 변경 이력
| 1.0 | 2026-04-11 | 최초 작성 |
