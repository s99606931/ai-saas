# MTU-P20: 바이브코딩 하네스 최적화 — Design 문서

> **문서 ID**: DESIGN-MTU-P20 | **복잡도**: HIGH | **작성일**: 2026-04-05
> **Plan 참조**: PLAN-MTU-P20

## 1. Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP 자동 체크 훅, AI 코드 생성 가이드, 감리 산출물 자동 생성 |
| 기술 | .claude/rules/, .claude/agents/, Claude Code 하네스 강화 |
| 보안 | AgentShield 규칙 갱신, CSAP 자동 검증 |
| 운영 | AI 가이드 문서, 자동 검증 파이프라인 |

## 2. 산출물 구조

- 하네스 규칙 갱신 (`.claude/rules/`)
- 에이전트 정의 갱신 (`.claude/agents/`)
- AI 코드 생성 가이드 문서

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
