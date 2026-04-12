# SVC-AI-ADV-R97 — 챗봇 페르소나 관리자

> 작성일: 2026-04-12 | 버전: 1.0.0

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 부서/업무별 AI 응답 톤앤매너 + 공공기관 언어 표준 적용 |
| 품질 | 페르소나 일관성 검증, 금칙어 차단 |
| 보안 | 페르소나별 허용 범위 (HR/법무/일반) |
| 비용 | 시스템 프롬프트 주입만, 추가 LLM 호출 없음 |

## Context Anchor

- **WHY**: 공공기관 응답은 기관 브랜드 일관성 + 공손 표현 필수
- **WHO**: 챗봇 운영자, 각 부서
- **SUCCESS**: 페르소나 조회 → 시스템 프롬프트 + 금칙어 정책 반환

## 요구사항

- **FR-R97.1**: registerPersona(name, tone, glossary, bannedWords)
- **FR-R97.2**: buildSystemPrompt(persona, context) — 시스템 메시지 생성
- **FR-R97.3**: validateResponse(persona, text) — 금칙어/어조 검증
- **FR-R97.4**: 공공기관 표준 용어 사전 내장
- **FR-R97.5**: 페르소나 버저닝 (변경 이력)
- **NFR-R97.1**: 테스트 5개+
