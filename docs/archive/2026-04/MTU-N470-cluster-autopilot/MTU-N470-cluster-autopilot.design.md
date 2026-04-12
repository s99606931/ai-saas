# MTU-N470-cluster-autopilot — Design

## Executive Summary
| 관점 | 결정 | 근거 |
|------|------|------|
| 아키텍처 | Single lib + class | 격리·테스트 용이 |
| 저장 | in-memory Map | 단순·고성능 |
| 추적성 | FR-CAP.1~5 매핑 | Q-Gate 통과 |

## Context Anchor
- WHY: 클러스터 오토파일럿 기능 확보
- WHO: 담당자, 감사관
- RISK: 격리·감사 누락
- SUCCESS: 전 테스트 PASS
- SCOPE: platform/services/ai-service/src/lib/cluster-autopilot.ts

## 아키텍처 (Pragmatic Balance)
순수 in-memory 단일 lib — 단순/테스트 가능

## 보안 / 규제
- CSAP: D-12
- N2SF: O등급 AI API 전송, C/S 마스킹 필수

## 변경 이력
| 1.0 | 2026-04-11 | 최초 작성 |
