# SVC-AI-ADV-R28: AI Compliance Checker (AI 규제 준수 검증기)

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | AI 시스템의 CSAP/행안부 AI 윤리/EU AI Act 규제 자동 준수 검증 |
| 기술 | 규제 체크리스트 엔진 + 자동 증거 수집 + 준수 보고서 생성 |
| 보안 | CSAP D-12 AI 시스템 보안 개발, D-06 규제 준수 감사 로그 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-ADV28.1 | 규제 체크리스트 — CSAP AI 관련 항목 + 행안부 AI 윤리 기준 매핑 | P0 |
| FR-ADV28.2 | 자동 검증 — 코드/설정/로그에서 준수 증거 자동 수집 | P0 |
| FR-ADV28.3 | 준수 보고서 — 항목별 준수/미준수/해당없음 + 증거 링크 | P0 |
| FR-ADV28.4 | 위험 등급 — AI 시스템 위험도 자동 분류 (고/중/저) | P1 |
| FR-ADV28.5 | 개선 권고 — 미준수 항목별 구체적 해결 방안 제시 | P1 |
| FR-ADV28.6 | 지속 모니터링 — 변경 시 자동 재검증 + 트렌드 보고 | P2 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| ai-compliance-checker.ts | platform/services/ai-service/src/lib/ai-compliance-checker.ts |
