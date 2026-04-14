/**
 * DS-ATOM-R4 — Text 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-ATOM-R4.design.md §2
 * Plan SC: FR-DSA.32, FR-DSA.34
 */

import {
  forwardRef,
  createElement,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn.js';

export type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl';
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';
export type TextVariant = 'body' | 'caption' | 'label' | 'muted' | 'error';
export type TextAs = 'p' | 'span' | 'div' | 'strong' | 'em' | 'small';

export interface TextProps extends HTMLAttributes<HTMLElement> {
  size?: TextSize;
  weight?: TextWeight;
  variant?: TextVariant;
  as?: TextAs;
  truncate?: boolean;
  children?: ReactNode;
}

const sizeClass: Record<TextSize, string> = {
  xs: 'text-[length:var(--font-size-xs)]',
  sm: 'text-[length:var(--font-size-sm)]',
  base: 'text-[length:var(--font-size-base)]',
  lg: 'text-[length:var(--font-size-lg)]',
  xl: 'text-[length:var(--font-size-xl)]',
};

const weightClass: Record<TextWeight, string> = {
  regular: 'font-[var(--font-weight-regular)]',
  medium: 'font-[var(--font-weight-medium)]',
  semibold: 'font-[var(--font-weight-semibold)]',
  bold: 'font-[var(--font-weight-bold)]',
};

const variantClass: Record<TextVariant, string> = {
  body: 'text-[var(--color-on-surface)]',
  caption: 'text-[var(--color-on-surface-muted)]',
  label: 'text-[var(--color-on-surface)]',
  muted: 'text-[var(--color-on-surface-muted)]',
  error: 'text-[var(--color-error)]',
};

function defaultSize(variant: TextVariant): TextSize {
  if (variant === 'caption') return 'xs';
  if (variant === 'label') return 'sm';
  return 'base';
}

function defaultWeight(variant: TextVariant): TextWeight {
  if (variant === 'label') return 'medium';
  return 'regular';
}

export const Text = forwardRef<HTMLElement, TextProps>(
  (
    {
      size,
      weight,
      variant = 'body',
      as = 'p',
      truncate,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const effectiveSize = size ?? defaultSize(variant);
    const effectiveWeight = weight ?? defaultWeight(variant);

    return createElement(
      as,
      {
        ref,
        className: cn(
          'font-[var(--font-sans)]',
          'leading-[var(--line-height-normal)]',
          sizeClass[effectiveSize],
          weightClass[effectiveWeight],
          variantClass[variant],
          truncate && 'truncate',
          className
        ),
        ...props,
      },
      children
    );
  }
);

Text.displayName = 'Text';
