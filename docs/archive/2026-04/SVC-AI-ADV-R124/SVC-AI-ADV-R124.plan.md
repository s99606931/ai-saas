# SVC-AI-ADV-R124 — LLM Input Injection Sentinel

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 원 요청 번호: R124

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 입력 측 프롬프트 인젝션 탐지 — 직접/간접/탈옥 패턴 + 위험도 채점 |
| 품질 | 다국어(한·영) 패턴, 세그먼트별 분석, 화이트/블랙 토큰 |
| 보안 | C/S 등급 스캔 차단, 매칭 결과 PII 노출 금지 |
| 비용 | 정규식 기반 결정적 탐지(외부 LLM 비의존) |

## Context Anchor

- **WHY**: 기존 prompt-injection-detector.ts는 LLM 2차 검증 의존. 결정적·고속·오프라인 인젝션 게이트웨이 필요(공공망 분리 환경).
- **WHO**: AI 게이트웨이, RAG 입력 필터, 에이전트 도구 호출 가드
- **RISK**: 우회 패턴 → 다층 패턴(직접/간접/탈옥) + 컨텍스트 불일치 점수 결합
- **SUCCESS**: scan(text) → SentinelVerdict { score, severity, matches, decision }
- **SCOPE**: In — 패턴 기반 결정적 탐지. Out — LLM 검증/분류 학습

## 요구사항

- **FR-R124.1**: 인젝션 패턴 카탈로그 (direct/indirect/jailbreak 카테고리)
- **FR-R124.2**: 한국어 + 영어 패턴 동시 지원
- **FR-R124.3**: 위험도 채점 (0~1) — 패턴 가중치 합산 + 정규화
- **FR-R124.4**: severity 분류 (safe/suspicious/high/critical)
- **FR-R124.5**: decision (allow/sanitize/block) — 임계값 기반
- **FR-R124.6**: 커스텀 패턴 등록 (`addPattern`)
- **FR-R124.7**: 화이트리스트(검증된 시스템 프롬프트 토큰) — 매칭 시 점수 감점
- **FR-R124.8**: N2SF C/S 등급 차단 + 매칭 결과 PII 마스킹
- **FR-R124.9**: `getAuditLog()`
- **NFR-R124.1**: TypeScript strict 0, 테스트 80%+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R124.1~7 | llm-input-injection-sentinel.ts | .test.ts | D-12 |
| FR-R124.8 | grade guard | test | N2SF N-05 |
| FR-R124.9 | auditLog | test | D-06 |
