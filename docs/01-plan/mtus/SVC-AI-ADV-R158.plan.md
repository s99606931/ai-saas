# MTU Plan — SVC-AI-ADV-R158 Content Policy Enforcer

> **원 요청 번호**: R158
> **모듈**: `platform/services/ai-service/src/lib/content-policy-enforcer.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 언어 표준 + 금지 주제 차단으로 AI 응답 품질 보증 |
| 기술 | 규칙 기반 + 패턴 매칭으로 입력/출력 검열, 위반 항목 리포트 |
| 보안 | C/S 등급 차단, 감사 로그 기록, 민감 주제 자동 필터 |
| 규제 | 행안부 AI 활용 가이드, 국가정보원 AI 보안지침 |

## Context Anchor

- WHY: 공공 AI는 정치·종교·차별·폭력 등 민감 주제 응답 시 행정처분 대상
- WHO: AI 서비스 운영자, 감리단, 민원 담당자
- RISK: 부적절 응답 노출 시 기관 신뢰도 훼손
- SUCCESS: 금지 주제 8개 카테고리 100% 차단, 공공 언어 표준 위반 탐지
- SCOPE: enforce(text) → { allowed, violations[] }

## FR

| ID | 설명 |
|----|------|
| FR-R158.1 | PolicyRule: { id, category, pattern, severity } 구조 |
| FR-R158.2 | 기본 정책 8 카테고리: politics, religion, discrimination, violence, adult, gambling, personal_info, profanity |
| FR-R158.3 | enforce(text, grade): 위반 룰 목록 반환 |
| FR-R158.4 | severity: 'low'|'medium'|'high'|'critical'. high 이상 1개라도 있으면 allowed=false |
| FR-R158.5 | addRule / removeRule: 런타임 규칙 관리 |
| FR-R158.6 | 공공 언어 표준 위반 탐지: 외래어/비속어/줄임말 플래그 |
| FR-R158.7 | C/S 등급 차단 → grade_blocked |
| FR-R158.8 | getAuditLog(), getStats() |

## 테스트 케이스

- 정상 텍스트 → allowed=true, violations=[]
- 정치 주제 포함 → high severity 위반 반환
- 비속어 포함 → medium 위반
- severity critical 시 allowed=false
- addRule 후 enforce 반영
- removeRule 후 enforce 미반영
- C/S 차단
- 통계 집계 (총 enforce 횟수, 차단 횟수)
