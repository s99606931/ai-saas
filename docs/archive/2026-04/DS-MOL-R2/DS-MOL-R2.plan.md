# DS-MOL-R2 — 분자 컴포넌트 2차 (DataTable · StatusCard · SearchBar)

> **Phase**: Design System Round 2 — Iteration 3
> **작성일**: 2026-04-14

## Executive Summary

| 관점 | 내용 |
|------|-----|
| 비즈니스 | 공공기관 관리 화면 3대 핵심 분자: 데이터 표, KPI 카드, 검색창 |
| 사용자 | 키보드 정렬·페이지 이동, 검색 자동완성·최근검색, 접근성 AA |
| 기술 | 제네릭 DataTable, CSS 토큰, 네이티브 HTML 기반 |
| 감리 | FR-DSM.11~13, 기존 stub types를 실제 구현으로 교체 |

## Context Anchor

- **WHY**: molecules/types.ts에 DataTable/StatusCard stub type만 존재. 실제 구현 부재로 portal 화면 개발 불가.
- **WHO**: admin 페이지 개발자, 감사 대시보드 사용자
- **RISK**: DataTable 복잡도 (정렬/페이지네이션/선택/가상화). R2에서는 가상화 제외 (R3에서 확장).
- **SUCCESS**: 3개 컴포넌트 × 평균 6 테스트 = 18개+, matchRate ≥ 95%
- **SCOPE**:
  - 포함: DataTable (정렬, 페이지네이션, 행 선택, loading, 빈 상태), StatusCard (수치+트렌드+아이콘), SearchBar (디바운스+클리어+최근검색)
  - 제외: 가상화(Virtualization), 드래그 정렬, CSV 내보내기

## 기능 요구사항

| FR ID | 요구사항 |
|-------|---------|
| FR-DSM.11 | DataTable: 제네릭 타입 `<T>`, columns API, 정렬 (header 클릭), 페이지네이션 UI |
| FR-DSM.11.1 | DataTable: 행 선택 (체크박스 모드, single/multi), `onSelectionChange` |
| FR-DSM.11.2 | DataTable: loading 상태 (스켈레톤 or spinner), 빈 상태 메시지 |
| FR-DSM.11.3 | DataTable: 접근성 `<table>` 시맨틱, `scope="col"`, `aria-sort` |
| FR-DSM.12 | StatusCard: 제목, 수치, 아이콘, 트렌드 (up/down/neutral + 숫자) |
| FR-DSM.12.1 | StatusCard: variant (default/success/warning/error), description slot |
| FR-DSM.13 | SearchBar: value/onChange 제어, placeholder, clear 버튼 |
| FR-DSM.13.1 | SearchBar: 디바운스 `debounceMs` prop (default 300), `onSearch` 별도 발화 |
| FR-DSM.13.2 | SearchBar: 최근 검색 리스트 (선택적, `recentSearches` prop), 드롭다운 표시 |
| FR-DSM.13.3 | SearchBar: 접근성 `role="searchbox"`, aria-label, ESC로 클리어 |

## 비기능 요구사항

- NFR-DSM.2: TypeScript strict + 제네릭 타입 안전
- NFR-DSM.3: 테스트 18개+ 통과
- NFR-DSM.4: CSS 토큰만 사용

## 성공 기준

- [ ] DataTable (6+ 테스트)
- [ ] StatusCard (5+ 테스트)
- [ ] SearchBar (6+ 테스트)
- [ ] molecules/index.ts export 갱신
- [ ] src/index.ts 루트 export 갱신 (기존 stub types 제거 또는 갱신)
- [ ] Q-Gate G1~G7 통과
