# DS-MOL-R2 — 구현 보고서

> **Scope**: DataTable, StatusCard, SearchBar
> **작성일**: 2026-04-14

## Executive Summary

| 관점 | 달성 |
|------|-----|
| 비즈니스 | 공공 관리화면 3대 핵심 분자 표준화 완료 |
| 사용자 | 키보드 정렬/페이지/검색 지원, WCAG 2.2 AA |
| 기술 | 제네릭 DataTable + atoms 재사용 + 네이티브 HTML |
| 감리 | FR-DSM.11~13 (13개 세부) + 28 테스트 100% 통과 |

## 핵심 결정

1. **DataTable 제네릭 `<T>`**: rowKey는 `keyof T | (row: T) => string` 이중 지원
2. **선택 단일/다중 모드**: Checkbox (multi) / Radio (single) 자동 전환
3. **SearchBar 제어/비제어 이중 지원**: `value` prop 유무로 자동 결정
4. **최근 검색 드롭다운**: `role="listbox"` + `role="option"` + aria-expanded

## 산출물

- Plan/Design/Analysis/Report
- 구현 (6 파일):
  - `molecules/DataTable/index.tsx` + `.test.tsx`
  - `molecules/StatusCard/index.tsx` + `.test.tsx`
  - `molecules/SearchBar/index.tsx` + `.test.tsx`
- export 갱신: `molecules/index.ts`, `src/index.ts`
- stub type 제거: `molecules/types.ts`의 DataTable/StatusCard 정의 → 실제 구현 교체

## 테스트

```
✓ DataTable.test.tsx    (12 tests)
✓ StatusCard.test.tsx   (7 tests)
✓ SearchBar.test.tsx    (9 tests)
Total: 28/28 passed
```

matchRate: **100%**

## 다음 단계

- DS-MOL-R3: Modal, Toast, Drawer (오버레이 클러스터)
