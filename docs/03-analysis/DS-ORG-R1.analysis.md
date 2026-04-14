# DS-ORG-R1 — Analysis (AppShell · Header · Sidebar · Rail)

> 작성일: 2026-04-14

## matchRate 테이블

| FR ID | 요구사항 | Plan | Design | 구현 | 테스트 | 상태 |
|-------|----------|:----:|:------:|:----:|:------:|:----:|
| FR-DSO.11 | AppShell: Header+Sidebar+main 그리드 레이아웃 | ✓ | ✓ | ✓ | ✓ | 100% |
| FR-DSO.11.1 | AppShell: 모바일 <768px Sidebar 숨김 (hidden md:block) | ✓ | ✓ | ✓ | ✓ | 100% |
| FR-DSO.12 | Header: title/breadcrumbs/actions/user/notifications, role=banner | ✓ | ✓ | ✓ | ✓ | 100% |
| FR-DSO.12.1 | Header: Avatar + Dropdown(로그아웃) + notifications 배지 | ✓ | ✓ | ✓ | ✓ | 100% |
| FR-DSO.13 | Sidebar: menuItems 트리, currentPath 하이라이트 | ✓ | ✓ | ✓ | ✓ | 100% |
| FR-DSO.13.1 | Sidebar: role=navigation + aria-label + aria-current | ✓ | ✓ | ✓ | ✓ | 100% |
| FR-DSO.14 | Rail: 64px 아이콘 전용 + 호버 툴팁(title 속성) | ✓ | ✓ | ✓ | ✓ | 100% |

**matchRate 종합: 100%**

## Q-Gate

| 게이트 | 기준 | 결과 |
|:------:|------|:----:|
| G1 | FR ID 전수 (7/7) | ✓ |
| G2 | 설계 완전성 (3 옵션 비교, API 4종 정의, 접근성 가이드) | ✓ |
| G3 | 코드 품질 (forwardRef × 4, 재사용 Avatar/Badge, any 미사용) | ✓ |
| G4 | 테스트 (24/24 passed, 4 컴포넌트 전수) | ✓ |
| G5 | OWASP Top10 (XSS: onNavigate 콜백 위임, path 문자열 미삽입) | ✓ |
| G6 | KWCAG 접근성 (role=banner/navigation/main, aria-current/expanded/label) | ✓ |
| G7 | 감사 로그 기록 | ✓ |

## 테스트 결과

```
✓ AppShell.test.tsx  (5 tests)  — 레이아웃/role=main/collapsed/skip link
✓ Header.test.tsx    (9 tests)  — title/breadcrumbs/banner/알림배지/user 드롭다운/로그아웃/햄버거
✓ Sidebar.test.tsx   (7 tests)  — navigation/트리 확장/aria-current/onNavigate/logo+footer
✓ Rail.test.tsx      (3 tests)  — 아이콘 렌더/aria-current/onNavigate

Total: 24/24 passed
```

## 산출물

- `organisms/AppShell/index.tsx` + `.test.tsx`
- `organisms/Header/index.tsx` + `.test.tsx`
- `organisms/Sidebar/index.tsx` + `.test.tsx`
- `organisms/Rail/index.tsx` + `.test.tsx`
- `organisms/index.ts` (통합 export + legacy 타입 호환)
- `src/index.ts` 루트 re-export 갱신
