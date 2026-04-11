# SVC-AI-ADV-R34: AI 코드 리뷰 Assistant

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead (Opus)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 보안 코딩 기준(CSAP D-12) 자동 검토로 코드 품질 향상 |
| 기술 | 정적 분석 + LLM 하이브리드 리뷰 (규칙 기반 + 의미 기반) |
| 보안 | CSAP D-12 보안 코딩 자동 검증, OWASP Top 10 패턴 탐지 |
| 운영 | CI/CD 파이프라인 통합, 풀 리퀘스트 자동 리뷰 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-ADV34.1 | 보안 코딩 검사 — CSAP D-12 + OWASP Top 10 패턴 자동 탐지 | P0 |
| FR-ADV34.2 | LLM 코드 리뷰 — 로직 오류, 개선점, 모범 사례 제안 | P0 |
| FR-ADV34.3 | 코드 복잡도 분석 — 순환 복잡도, 함수 길이, 중첩 깊이 | P1 |
| FR-ADV34.4 | 리뷰 보고서 — 발견 사항 요약 + 코드 위치 + 수정 제안 | P0 |
| FR-ADV34.5 | 차이점 분석 — Git diff 기반 변경 부분만 선택 리뷰 | P1 |
| FR-ADV34.6 | 자동 수정 제안 — 간단한 보안 이슈 자동 패치 코드 생성 | P2 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| code-review-ai.ts | platform/services/ai-service/src/lib/code-review-ai.ts |
| security-code-analyzer.ts | platform/services/ai-service/src/lib/security-code-analyzer.ts |
