# MTU Plan — SVC-AI-ADV-R143 Reasoning Trace Recorder

> **원 요청 번호**: R143
> **모듈**: `platform/services/ai-service/src/lib/reasoning-trace-recorder.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | AI 의사결정 단계별 추론 과정을 기록/재현하여 설명 가능성 확보 |
| 기술 | 단계 스팬 체인 구조, 신뢰도 집계, 종결 시 추적 서명(hash) |
| 보안 | 트레이스에 C/S등급 원문 금지, 요약 해시만 저장 |
| 규제 | 행안부 AI 감사 가이드, EU AI Act 감사 추적, CSAP D-06 |

## Context Anchor

- WHY: 기존 `ai-decision-explainer`(단일 결정 설명)와 달리 추론 체인 자체를 실시간 기록
- WHO: 감사관, Compliance, 운영팀
- RISK: 블랙박스 AI 판단 근거 부재 → 민원 대응 불가
- SUCCESS: 모든 추론 체인 재현 가능, 단계 누락 0%
- SCOPE: 트레이스 시작→단계 추가→종결→무결성 해시→조회

## FR

| ID | 설명 |
|----|------|
| FR-R143.1 | 트레이스 시작 및 ID 발급 |
| FR-R143.2 | 단계(step) 추가: name, input/outputSummary, confidence, durationMs |
| FR-R143.3 | 트레이스 종결 시 체인 해시 산출 |
| FR-R143.4 | 단계 신뢰도 평균 계산 |
| FR-R143.5 | 감사 로그 + `getAuditLog()` |
| FR-R143.6 | C/S등급 데이터 거부 guard |

## NFR

- NFR-1: 단일 트레이스 단계 10,000개 수용
- NFR-2: 단계 추가 O(1)

## 테스트 시나리오

- 정상: 3단계 트레이스 → 종결 → 해시 결정론적
- 예외: 닫힌 트레이스에 step 추가 시 오류
- 보안: C등급 입력 시 차단
