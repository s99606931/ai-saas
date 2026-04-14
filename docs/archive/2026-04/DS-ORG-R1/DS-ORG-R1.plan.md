# DS-ORG-R1 — 유기체 컴포넌트 1차 (AppShell · Header · Sidebar · Rail)

> **Phase**: Design System Round 2 — Iteration 6
> **작성일**: 2026-04-14

## Executive Summary

| 관점 | 내용 |
|------|-----|
| 비즈니스 | 공공기관 SaaS 모든 페이지의 표준 레이아웃 일원화 |
| 사용자 | Header(상단) + Sidebar(좌측) + 컨텐츠 영역 = 익숙한 관공서 스타일 |
| 기술 | 기존 types.ts 인터페이스 확장, atoms/molecules 조합으로 구성 |
| 감리 | FR-DSO.11~14, 반응형 + KWCAG 접근성 준수 |

## Context Anchor

- **WHY**: 관리자/감사/사용자 페이지 각각 레이아웃을 중복 구현하면 유지보수 비용 증가. 표준 AppShell로 테넌트 커스터마이제이션 일원화.
- **WHO**: 내부 개발자 (페이지 작성), 최종 사용자 (관공서 직원)
- **RISK**:
  - 모바일(< 768px) 사이드바 오버레이 전환 로직 복잡
  - 기존 `types.ts`의 SidebarProps/HeaderProps 하위호환 유지 필요
- **SUCCESS**: 4 컴포넌트 + 20+ 테스트, matchRate ≥ 95%
- **SCOPE**:
  - 포함: AppShell(레이아웃 래퍼), Header(상단바), Sidebar(좌측 네비), Rail(축소형 아이콘바)
  - 제외: 실제 라우팅 로직, Breadcrumb 동적 생성 (DS-ORG-R2 PageHeader에서)

## 기능 요구사항

| FR ID | 요구사항 |
|-------|---------|
| FR-DSO.11 | AppShell: Header + Sidebar + main 슬롯, 그리드 레이아웃 (헤더 60px 고정, 사이드바 240px/64px 토글) |
| FR-DSO.11.1 | AppShell: 모바일 <768px 시 Sidebar를 Drawer로 전환 (useMediaQuery 또는 CSS only) |
| FR-DSO.12 | Header: title/breadcrumbs/actions/user/notifications, role=banner |
| FR-DSO.12.1 | Header: user 영역에 Avatar + name + Dropdown(로그아웃), notifications 배지 |
| FR-DSO.13 | Sidebar: menuItems 트리(1레벨 children까지), currentPath 하이라이트, collapsed 토글 |
| FR-DSO.13.1 | Sidebar: role=navigation + aria-label, 키보드 탐색 (↑↓ Enter) |
| FR-DSO.14 | Rail: collapsed=true일 때 64px 아이콘 전용 사이드바, 호버 툴팁 |

## 성공 기준

- [ ] 4 컴포넌트 (AppShell, Header, Sidebar, Rail) + 공통 export
- [ ] 20+ 테스트 (AppShell 4, Header 6, Sidebar 7, Rail 3)
- [ ] types.ts 기존 인터페이스 호환
- [ ] Q-Gate G1~G7 통과
