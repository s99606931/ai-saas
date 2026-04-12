// 공공기관 SaaS 플랫폼 — 공통 UI 컴포넌트 라이브러리
// Design Ref: DS-TOKEN-R1, DS-ATOM-R1, DS-ATOM-R2
// Plan SC: FR-DST.11, FR-DSA.11

// ─────────── 디자인 토큰 ───────────
export {
  type ThemeName,
  type ThemeMode,
  type ThemePreset,
  THEME_PRESETS,
  DEFAULT_THEME,
  DEFAULT_MODE,
  buildThemeClassName,
} from './tokens/index.js';

// ─────────── Atoms (DS-ATOM-R1 + R2) ───────────
export {
  cn,
  cva,
  type VariantProps,
  // R1
  Button,
  type ButtonProps,
  Badge,
  type BadgeProps,
  Spinner,
  type SpinnerProps,
  Icon,
  type IconProps,
  type IconSize,
  // R2
  Input,
  type InputProps,
  Textarea,
  type TextareaProps,
  Checkbox,
  type CheckboxProps,
  Switch,
  type SwitchProps,
  Label,
  type LabelProps,
  // Variants
  buttonVariants,
  badgeVariants,
  inputVariants,
} from './atoms/index.js';

// ─────────── Molecules / Organisms 스텁 ───────────
export type { DataTableProps, FormFieldProps, StatusCardProps } from './molecules/types.js';
export type { SidebarProps, HeaderProps } from './organisms/types.js';
