# SVC-AI-ADV-R656 Design — AI기반 공공서비스 챗봇 고도화 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R656.1~6 구현 |
| 보안 | N2SF N-05 C/S 차단, PII 마스킹, CSAP D-06 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/public-service-chatbot-enhancer-v3.ts |

## 설계 결정
- `PublicServiceChatbotEnhancerV3` 클래스
- 도메인 매칭 점수 = (일치 키워드 수) / max(1, 발화 토큰 수)
- 최고 점수 도메인 선택, 점수 < 0.3 시 'general' 폴백
- 마스킹: utterance 안의 이메일/전화/주민번호 패턴 → SHA-256 16자
- 감사로그: route, register, fallback 액션

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
