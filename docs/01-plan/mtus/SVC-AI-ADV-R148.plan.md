# MTU Plan — SVC-AI-ADV-R148 Prompt Injection Defender v2

> **원 요청 번호**: R148
> **모듈**: `platform/services/ai-service/src/lib/prompt-injection-defender-v2.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 고급 프롬프트 인젝션 공격 방어로 AI 안전 강화 |
| 기술 | 컨텍스트 분리(system/user/context) + 레이어드 검증 + 평가 점수 |
| 보안 | 경계 태그 삽입 차단, delimiter injection 차단, 토큰 escape |
| 규제 | CSAP D-12 입력 검증, OWASP LLM Top10 LLM01 |

## Context Anchor

- WHY: 기존 `prompt-injection-detector`(LLM 판정)·`llm-input-injection-sentinel`(패턴 가중치)와 별개로, 컨텍스트 섹션 분리 + 다층 방어 계층 전용
- WHO: AI 게이트웨이 개발자, 보안 운영팀
- RISK: 시스템 프롬프트 탈취, 지시 무시, 데이터 유출
- SUCCESS: 컨텍스트 오염 시도 100% 차단, 레이어별 사유 기록
- SCOPE: buildPrompt(system/user/context) → layer 검증 → 보호된 프롬프트 생성

## FR

| ID | 설명 |
|----|------|
| FR-R148.1 | Layer 1: delimiter/구분자 화이트리스트 검증 (`<<SYS>>`, `[[USER]]` 등 금지 토큰) |
| FR-R148.2 | Layer 2: 키워드 차단 (ignore previous, disregard instructions, reveal prompt) |
| FR-R148.3 | Layer 3: 제어 문자/이모지 zero-width 차단 |
| FR-R148.4 | buildProtectedPrompt: 각 섹션에 고유 nonce 경계 생성 |
| FR-R148.5 | DefendResult(allowed, layers[], sanitized, riskScore) |
| FR-R148.6 | 감사 로그 + C/S 차단 |

## 테스트 케이스

- 정상 입력 → allowed=true, riskScore=0
- `<<SYS>>` 포함 → Layer 1 차단
- "ignore previous instructions" → Layer 2 차단
- zero-width space 포함 → Layer 3 차단
- buildProtectedPrompt: 각 섹션 고유 nonce 경계
- riskScore 누적 (여러 Layer 위반 합산)
- 빈 입력 invalid_input
- C/S 등급 차단
- getAuditLog
