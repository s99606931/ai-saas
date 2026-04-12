// 공공기관 SaaS 플랫폼 — 공통 UI 컴포넌트 라이브러리
// Design Ref: docs/02-design/mtus/DS-TOKEN-R1.design.md
// Plan SC: FR-DST.11
// MTU-U1 디자인 시스템 + DS-TOKEN-R1 토큰 시스템

// ─────────── 디자인 토큰 (TypeScript 메타) ───────────
export {
  type ThemeName,
  type ThemeMode,
  type ThemePreset,
  THEME_PRESETS,
  DEFAULT_THEME,
  DEFAULT_MODE,
  buildThemeClassName,
} from './tokens/index.js';

// ─────────── 컴포넌트 타입 (DS-ATOM-R1 이전 스텁) ───────────
// NOTE: 실제 컴포넌트 구현은 DS-ATOM-R1 이터레이션에서 추가
export type { ButtonProps, BadgeProps, InputProps } from './atoms/types.js';
export type { DataTableProps, FormFieldProps, StatusCardProps } from './molecules/types.js';
export type { SidebarProps, HeaderProps } from './organisms/types.js';
