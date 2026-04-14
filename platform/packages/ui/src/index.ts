// 공공기관 SaaS 플랫폼 — 공통 UI 컴포넌트 라이브러리
// Design Ref: DS-TOKEN-R1, DS-ATOM-R1, DS-ATOM-R2, DS-ATOM-R3, DS-THEME-R1
// Plan SC: FR-DST.11, FR-DSA.11, FR-DSA.21~24, FR-DST.13~18

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

// ─────────── Atoms (DS-ATOM-R1 + R2 + R3) ───────────
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
  // R3
  Select,
  type SelectProps,
  type SelectOption,
  Radio,
  RadioGroup,
  type RadioProps,
  type RadioGroupProps,
  Avatar,
  getInitials,
  type AvatarProps,
  type AvatarSize,
  type AvatarShape,
  type AvatarStatus,
  Tooltip,
  type TooltipProps,
  type TooltipSide,
  // R4
  Heading,
  type HeadingProps,
  type HeadingLevel,
  type HeadingWeight,
  Text,
  type TextProps,
  type TextSize,
  type TextWeight,
  type TextVariant,
  type TextAs,
  Code,
  type CodeProps,
  type CodeSize,
  // Variants
  buttonVariants,
  badgeVariants,
  inputVariants,
  avatarVariants,
  statusIndicatorVariants,
} from './atoms/index.js';

// ─────────── Theme System (DS-THEME-R1) ───────────
export {
  ThemeProvider,
  type ThemeProviderProps,
  useTheme,
  ThemeContext,
  type ThemeContextValue,
  ThemeSwitcher,
  type ThemeSwitcherProps,
  ModeToggle,
  type ModeToggleProps,
  getInitialThemeScript,
  type InitScriptOptions,
  STORAGE_KEYS,
  isBrowser,
  getSystemPrefersDark,
  subscribeSystemTheme,
} from './theme/index.js';

// ─────────── Molecules (DS-MOL-R1 + R2) ───────────
export {
  // R1
  FormField,
  type FormFieldProps,
  Alert,
  type AlertProps,
  alertVariants,
  type AlertVariant,
  Card,
  type CardProps,
  // R2
  DataTable,
  type DataTableProps,
  type DataTableColumn,
  type DataTablePagination,
  type DataTableSelection,
  StatusCard,
  type StatusCardProps,
  type StatusCardVariant,
  type StatusCardTrend,
  type StatusCardTrendDirection,
  SearchBar,
  type SearchBarProps,
} from './molecules/index.js';

// ─────────── Organisms 스텁 (추후 DS-ORG-R1) ───────────
export type { SidebarProps, HeaderProps } from './organisms/types.js';
