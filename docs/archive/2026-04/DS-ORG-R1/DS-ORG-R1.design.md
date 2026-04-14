# DS-ORG-R1 — Design (AppShell · Header · Sidebar · Rail)

## 결정

- 옵션 1: CSS Grid 전체 레이아웃 **← 선택** (모바일 대응 유연)
- 옵션 2: Flexbox 중첩 — 복잡도 상승, 모바일 전환 어려움
- 옵션 3: 외부 라이브러리 (react-pro-sidebar) — 의존 금지

## AppShell 구조

```
┌─────────────────────────────────────┐
│ Header (grid-area: header)          │
├──────┬──────────────────────────────┤
│ Side │ main (grid-area: main)       │
│ bar  │                              │
│      │                              │
└──────┴──────────────────────────────┘

grid-template-areas:
  "header header"
  "sidebar main"
grid-template-columns: {sidebar-width} 1fr
grid-template-rows: 60px 1fr
```

모바일: `grid-template-columns: 1fr` + Sidebar를 Drawer로 오버레이.

## API

```typescript
// AppShell
interface AppShellProps {
  header: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
  sidebarCollapsed?: boolean;
  mobileBreakpoint?: number; // default 768
  className?: string;
}

// Header (기존 types.ts 확장)
interface HeaderProps {
  title: string;
  breadcrumbs?: Array<{ label: string; path?: string }>;
  actions?: ReactNode;
  user?: { name: string; email: string; avatarUrl?: string };
  notifications?: number;
  onLogout?: () => void;
  onMenuToggle?: () => void; // 모바일 햄버거
  className?: string;
}

// Sidebar
interface SidebarProps {
  menuItems: MenuItem[];
  currentPath: string;
  logo?: ReactNode;
  footer?: ReactNode;
  onNavigate?: (path: string) => void;
  collapsed?: boolean;
  onCollapsedChange?: (v: boolean) => void;
  className?: string;
}

// Rail (Sidebar collapsed 형태)
interface RailProps {
  menuItems: MenuItem[];
  currentPath: string;
  onNavigate?: (path: string) => void;
  className?: string;
}

interface MenuItem {
  id: string;
  label: string;
  path?: string;
  icon?: ReactNode;
  children?: MenuItem[];
}
```

## 구성 요소 재사용

- Header: Avatar(atoms), Badge(atoms), Tooltip(atoms)
- Sidebar: Tooltip(collapsed 모드), Button
- Rail: Tooltip (아이콘 호버)

## 접근성

- Header: `role="banner"`
- Sidebar: `role="navigation" aria-label="주 메뉴"`
- Main: AppShell 내부 `<main role="main" id="main">` + skip link
- 키보드: Tab 순서 Header → Sidebar → Main

## 테스트 범위

- AppShell: 레이아웃 래핑, sidebarCollapsed 반영, children 렌더
- Header: title/breadcrumbs/notifications 배지/user 드롭다운/onMenuToggle
- Sidebar: menuItems 렌더, currentPath 하이라이트, children 확장, collapsed 전환
- Rail: 아이콘만 렌더, currentPath 표시, 툴팁 동작
