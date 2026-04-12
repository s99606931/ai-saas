# MTU Plan — SVC-AI-ADV-R139 Adaptive UI Generator

> **원 요청 번호**: R139
> **모듈**: `platform/services/ai-service/src/lib/adaptive-ui-generator.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 사용자 행동 패턴 기반 UI 레이아웃 자동 생성 및 최적화 |
| 기술 | 클릭/체류/스크롤 이벤트를 분석해 컴포넌트 우선순위 및 표시 여부 결정 |
| 보안 | 사용자 식별자 해시화, O등급 행동 메트릭만 사용 |
| 규제 | 행안부 웹 접근성(WCAG 2.1 AA), 정보시스템 설계 지침 |

## Context Anchor

- WHY: 기존 `adaptive-layout-ai.ts`는 레이아웃 크기만 조정. 컴포넌트 우선순위/숨김/추가 로직 공백
- WHO: 포털 프론트엔드, 테넌트 관리자
- RISK: 과도한 UI 변화 시 사용자 혼란
- SUCCESS: 클릭 도달률 20% 향상, 페이지 이탈률 15% 감소
- SCOPE: 이벤트 수집→분석→UI 스펙 JSON 생성

## FR

| ID | 설명 |
|----|------|
| FR-R139.1 | 사용자 행동 이벤트 수집(click, dwell, scroll) |
| FR-R139.2 | 컴포넌트별 관심도 점수 계산 |
| FR-R139.3 | UI 스펙 생성 (표시/숨김/순서) |
| FR-R139.4 | WCAG 접근성 제약 준수 (필수 컴포넌트 숨김 금지) |
| FR-R139.5 | 감사 로그 `getAuditLog()` |
| FR-R139.6 | C/S등급 차단 |
