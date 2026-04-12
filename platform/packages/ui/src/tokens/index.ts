/**
 * DS-TOKEN-R1 — 토큰 모듈 진입점
 * Design Ref: docs/02-design/mtus/DS-TOKEN-R1.design.md
 *
 * CSS는 부수효과 import:
 *   import "@public-saas/ui/tokens/index.css";
 *
 * TypeScript 메타데이터:
 *   import { THEME_PRESETS, type ThemeName } from "@public-saas/ui/tokens";
 */

export {
  type ThemeName,
  type ThemeMode,
  type ThemePreset,
  THEME_PRESETS,
  DEFAULT_THEME,
  DEFAULT_MODE,
  buildThemeClassName,
} from './themes/index.js';
