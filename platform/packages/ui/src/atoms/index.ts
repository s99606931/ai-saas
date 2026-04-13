/**
 * DS-ATOM-R1 + R2 + R3 — atoms 통합 export
 * Plan SC: FR-DSA.11, FR-DSA.21~24
 *
 * 구현된 컴포넌트:
 *  R1: Button, Badge, Spinner, Icon
 *  R2: Input, Textarea, Checkbox, Switch, Label
 *  R3: Select, Radio/RadioGroup, Avatar, Tooltip
 *
 * 다음 (DS-ATOM-R4): Typography (Pretendard + fluid type)
 */

// ─────────── 유틸 ───────────
export { cn } from './lib/cn.js';
export { cva, type VariantProps } from './lib/cva.js';

// ─────────── R1: 표시/액션 ───────────
export { Button, type ButtonProps } from './Button/index.js';
export { Badge, type BadgeProps } from './Badge/index.js';
export { Spinner, type SpinnerProps } from './Spinner/index.js';
export { Icon, type IconProps, type IconSize } from './Icon/index.js';

// ─────────── R2: 폼 ───────────
export { Input, type InputProps } from './Input/index.js';
export { Textarea, type TextareaProps } from './Textarea/index.js';
export { Checkbox, type CheckboxProps } from './Checkbox/index.js';
export { Switch, type SwitchProps } from './Switch/index.js';
export { Label, type LabelProps } from './Label/index.js';

// ─────────── R3: 선택/표시/오버레이 ───────────
export {
  Select,
  type SelectProps,
  type SelectOption,
} from './Select/index.js';
export {
  Radio,
  RadioGroup,
  type RadioProps,
  type RadioGroupProps,
} from './Radio/index.js';
export {
  Avatar,
  getInitials,
  type AvatarProps,
  type AvatarSize,
  type AvatarShape,
  type AvatarStatus,
} from './Avatar/index.js';
export {
  Tooltip,
  type TooltipProps,
  type TooltipSide,
} from './Tooltip/index.js';

// ─────────── Variants ───────────
export { buttonVariants } from './Button/Button.variants.js';
export { badgeVariants } from './Badge/Badge.variants.js';
export { inputVariants } from './Input/Input.variants.js';
export {
  avatarVariants,
  statusIndicatorVariants,
} from './Avatar/Avatar.variants.js';
