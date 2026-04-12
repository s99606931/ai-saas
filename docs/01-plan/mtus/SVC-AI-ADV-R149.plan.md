# MTU Plan — SVC-AI-ADV-R149 Model Fallback Chain

> **원 요청 번호**: R149
> **모듈**: `platform/services/ai-service/src/lib/model-fallback-chain.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 모델 장애/비용 초과 시 자동 대체 모델로 폴백 → 서비스 연속성 |
| 기술 | 순서화된 체인 + health/quota 상태 + circuit breaker 패턴 |
| 보안 | 모델 목록 등록/차단, 감사 로그 |
| 규제 | CSAP 가용성, 운영 장애 대응 |

## Context Anchor

- WHY: 단일 LLM 의존은 장애 시 서비스 중단 → 정책 기반 자동 폴백 필요
- WHO: AI 게이트웨이 운영팀
- RISK: 상위 모델 장애 시 사용자 경험 저하
- SUCCESS: 1순위 실패 시 자동 다음 모델 시도, 체인 소진 시 명시적 실패
- SCOPE: register → execute(request, runner) → 순차 시도 → 결과 반환

## FR

| ID | 설명 |
|----|------|
| FR-R149.1 | 체인 등록: register(modelId, priority) |
| FR-R149.2 | execute: 우선순위대로 runner 호출, 실패 시 다음 모델 |
| FR-R149.3 | markUnhealthy(modelId, cooldownMs): 일정 시간 제외 |
| FR-R149.4 | 회복: cooldown 경과 시 자동 healthy |
| FR-R149.5 | 체인 소진 시 chain_exhausted 에러 |
| FR-R149.6 | 감사 로그 + C/S 차단 (request.grade) |

## 테스트 케이스

- 1순위 성공 → 바로 반환
- 1순위 실패 → 2순위 성공 반환
- 전체 실패 → chain_exhausted
- markUnhealthy 후 해당 모델 skip
- cooldown 경과 후 재사용
- 빈 체인 no_models
- 우선순위 정렬
- C/S 차단
- 감사 로그
