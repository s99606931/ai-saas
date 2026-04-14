/**
 * DS-ORG-R1 + R2 — organisms 통합 export
 *
 * R1: AppShell, Header, Sidebar, Rail
 * R2: PageHeader, FilterBar, EmptyState
 */

export { AppShell, type AppShellProps } from './AppShell/index.js';
export {
  Header,
  type HeaderProps,
  type HeaderBreadcrumb,
  type HeaderUser,
} from './Header/index.js';
export {
  Sidebar,
  type SidebarProps,
  type SidebarMenuItem,
} from './Sidebar/index.js';
export {
  Rail,
  type RailProps,
  type RailMenuItem,
} from './Rail/index.js';

// ─────────── R2: 페이지 패턴 ───────────
export {
  PageHeader,
  type PageHeaderProps,
  type PageHeaderBreadcrumb,
} from './PageHeader/index.js';
export { FilterBar, type FilterBarProps } from './FilterBar/index.js';
export {
  EmptyState,
  type EmptyStateProps,
  type EmptyStateVariant,
} from './EmptyState/index.js';

// 기존 스텁 타입 재export (호환)
export type {
  SidebarProps as LegacySidebarProps,
  HeaderProps as LegacyHeaderProps,
} from './types.js';
