/**
 * DS-ATOM-R1 — Badge variants
 * Design Ref: docs/02-design/mtus/DS-ATOM-R1.design.md §Badge
 * Plan SC: FR-DSA.5
 */

import { cva } from '../lib/cva.js';

export const badgeVariants = cva(
  [
    'inline-flex items-center gap-1',
    'h-[var(--badge-height)]',
    'px-[var(--badge-padding-x)]',
    'text-[length:var(--badge-font-size)]',
    'font-[var(--badge-font-weight)]',
    'rounded-[var(--badge-radius)]',
    'whitespace-nowrap',
    'transition-colors duration-[var(--motion-duration-fast)]',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          'bg-[var(--color-surface-container)]',
          'text-[var(--color-on-surface)]',
        ].join(' '),
        primary: [
          'bg-[var(--color-primary-container)]',
          'text-[var(--color-on-primary-container)]',
        ].join(' '),
        success: [
          'bg-[var(--color-success-container)]',
          'text-[var(--color-on-success-container)]',
        ].join(' '),
        warning: [
          'bg-[var(--color-warning-container)]',
          'text-[var(--color-on-warning-container)]',
        ].join(' '),
        error: [
          'bg-[var(--color-error-container)]',
          'text-[var(--color-on-error-container)]',
        ].join(' '),
        info: [
          'bg-[var(--color-info-container)]',
          'text-[var(--color-on-info-container)]',
        ].join(' '),
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const dotColorMap = {
  default: 'bg-[var(--color-on-surface-muted)]',
  primary: 'bg-[var(--color-primary)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  error: 'bg-[var(--color-error)]',
  info: 'bg-[var(--color-info)]',
} as const;

export type BadgeVariant = keyof typeof dotColorMap;

export function getDotColor(variant: BadgeVariant): string {
  return dotColorMap[variant];
}
