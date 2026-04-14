# DS-ORG-R1 — 구현 보고서 (AppShell · Header · Sidebar · Rail)

> 작성일: 2026-04-14

## Executive Summary

| 관점 | 달성 |
|------|-----|
| 비즈니스 | 모든 페이지 표준 레이아웃 확보 — 관리자/감사/사용자 공통 Shell |
| 사용자 | 익숙한 관공서 스타일 (상단 Header + 좌측 Sidebar), 모바일 햄버거 지원 |
| 기술 | CSS Grid 기반, atoms(Avatar/Badge) + molecules(Tooltip) 재사용 |
| 감리 | FR-DSO.11~14 + 24 테스트 100% 통과, role=banner/navigation/main 완비 |

## 핵심 결정

1. **CSS Grid 단일 소스**: grid-template-areas 문자열로 헤더/사이드바/메인 배치. 모바일 대응(`hidden md:block`)만 추가.
2. **Sidebar 트리 재귀 렌더**: `MenuItemRow` 내부 컴포넌트로 1레벨 children 지원. 자동 확장 로직(자식이 active면 expanded=true 초기화).
3. **Rail은 별도 컴포넌트**: Sidebar의 collapsed 모드가 아닌 독립 organism으로 분리 — 아이콘 필수/자식 없음 등 API 단순화.
4. **legacy 타입 호환**: 기존 `organisms/types.ts`의 `SidebarProps`/`HeaderProps`는 `LegacySidebarProps`/`LegacyHeaderProps`로 re-export 유지.

## 산출물

- Plan: `docs/01-plan/mtus/DS-ORG-R1.plan.md`
- Design: `docs/02-design/mtus/DS-ORG-R1.design.md`
- Analysis: `docs/03-analysis/DS-ORG-R1.analysis.md`
- 구현 (8 파일):
  - `organisms/AppShell/` (index + test)
  - `organisms/Header/` (index + test)
  - `organisms/Sidebar/` (index + test)
  - `organisms/Rail/` (index + test)
- export: `organisms/index.ts`, `src/index.ts`

## 테스트

```
✓ AppShell.test.tsx (5 tests)
✓ Header.test.tsx   (9 tests)
✓ Sidebar.test.tsx  (7 tests)
✓ Rail.test.tsx     (3 tests)
Total: 24/24 passed
```

matchRate: **100%**

## 다음 단계

- **DS-ORG-R2**: PageHeader + FilterBar + EmptyState
- **DS-THEME-R2**: education + logistics 테마 프리셋
- **DS-PORTAL-R1**: admin 페이지 디자인 시스템 마이그레이션
