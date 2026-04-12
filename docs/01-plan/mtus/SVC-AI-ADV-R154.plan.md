# MTU Plan — SVC-AI-ADV-R154 Adversarial Input Detector

> **원 요청 번호**: R154
> **모듈**: `platform/services/ai-service/src/lib/adversarial-input-detector.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 적대적 입력(공격 패턴) 자동 감지로 AI 서비스 무력화·우회 차단 |
| 기술 | 다중 시그니처: 반복 문자 · 비정상 유니코드 · 제로폭 · 과도 길이 · 패턴 |
| 보안 | 공격 탐지 즉시 차단 + 감사 로그 |
| 규제 | CSAP D-12, OWASP LLM Top10 LLM01/LLM07 |

## Context Anchor

- WHY: 프롬프트 인젝션과 별개로 비정상 토큰·제로폭 문자·반복 공격 존재
- WHO: AI Gateway 입력 전처리 단계
- RISK: 공격 성공 시 모델 오용·DoS·우회
- SUCCESS: 유형별 탐지 카테고리 + 신뢰도 + shouldBlock 판정
- SCOPE: detect(input) → { verdict, categories[], score }

## FR

| ID | 설명 |
|----|------|
| FR-R154.1 | 제로폭 문자 (U+200B, U+200C, U+200D, U+FEFF) 감지 → `zero_width` |
| FR-R154.2 | 반복 문자 폭탄 (같은 문자 50회 이상 연속) → `repetition` |
| FR-R154.3 | 과도 길이 (기본 10000자 초과) → `oversize` |
| FR-R154.4 | 비정상 유니코드 비율 (제어/서러게이트 >5%) → `abnormal_unicode` |
| FR-R154.5 | Base64/HEX 대형 블록 (2000자 이상 영숫자) → `encoded_payload` |
| FR-R154.6 | 점수 산정: category 수 × 0.25, clamp 1.0 |
| FR-R154.7 | verdict = score >= 0.5 ? 'block' : score >= 0.25 ? 'warn' : 'pass' |
| FR-R154.8 | 감사 로그, 빈 입력 거부, C/S 차단 |

## 테스트 케이스

- 정상 텍스트 → pass
- 제로폭 포함 → zero_width 감지
- 50회 반복 → repetition
- 12000자 → oversize
- 제어 문자 다량 → abnormal_unicode
- Base64 블록 → encoded_payload
- 복합 공격 (2+ 카테고리) → block
- verdict 경계값
- C/S 차단
- getAuditLog
