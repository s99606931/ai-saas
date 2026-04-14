# DS-ORG-R2 — 유기체 컴포넌트 2차 (PageHeader · FilterBar · EmptyState)

> **Phase**: Design System Round 2 — Iteration 7
> **작성일**: 2026-04-14

## Executive Summary

| 관점 | 내용 |
|------|-----|
| 비즈니스 | 목록/상세 페이지 공통 패턴 표준화 — 제목+액션+필터+빈상태 |
| 사용자 | 각 페이지에서 동일한 위치·형식의 제목/필터/버튼 → 학습 비용 감소 |
| 기술 | atoms/molecules 조합으로 구성, 상태는 부모에서 제어 (controlled) |
| 감리 | FR-DSO.21~23, 반응형 + 접근성 aria-label 준수 |

## Context Anchor

- **WHY**: DS-ORG-R1 AppShell이 전체 레이아웃이라면, R2는 main 영역 내부 상단 공통 패턴(페이지 제목/필터/결과 없음)을 표준화.
- **RISK**:
  - FilterBar가 다양한 필드 타입(검색, 셀렉트, 날짜, 체크박스)을 수용해야 함 → 선언적 schema vs children slot 선택
  - EmptyState가 검색결과 없음/권한없음/에러 등 다중 변형 처리
- **SUCCESS**: 3 컴포넌트 + 15+ 테스트, matchRate ≥ 95%
- **SCOPE**:
  - 포함: PageHeader(제목+부제+Breadcrumb+액션), FilterBar(컨테이너+reset), EmptyState(아이콘+메시지+액션)
  - 제외: 필터 상태 관리 (부모 책임), 자동 URL 쿼리 동기화

## 기능 요구사항

| FR ID | 요구사항 |
|-------|---------|
| FR-DSO.21 | PageHeader: title/subtitle/breadcrumbs/actions 슬롯, 반응형 |
| FR-DSO.21.1 | PageHeader: aria-label, h1 기본(as prop으로 변경 가능) |
| FR-DSO.22 | FilterBar: children slot + onReset/resetLabel, 수평 레이아웃 |
| FR-DSO.22.1 | FilterBar: hasActiveFilters 시각적 표시 (테두리 강조) |
| FR-DSO.23 | EmptyState: icon/title/description/action, variant (default/error/forbidden) |
| FR-DSO.23.1 | EmptyState: role=status 또는 role=alert (variant에 따라) |

## 성공 기준

- [ ] 3 컴포넌트 + 15+ 테스트
- [ ] export 갱신 (organisms/index.ts, src/index.ts)
- [ ] Q-Gate 통과
