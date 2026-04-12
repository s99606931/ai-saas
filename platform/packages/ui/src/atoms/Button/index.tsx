/**
 * DS-ATOM-R1 — Button 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-ATOM-R1.design.md §Button
 * Plan SC: FR-DSA.3, FR-DSA.4, FR-DSA.8, FR-DSA.9
 *
 * 5 variant × 3 size + loading/disabled/asChild
 * 키보드 접근 가능, ARIA 준수, KWCAG 2.2
 */

import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from '../Spinner/index.js';
import { cn } from '../lib/cn.js';
import { type VariantProps } from '../lib/cva.js';
import { buttonVariants } from './Button.variants.js';

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** 로딩 상태 — Spinner 표시 + aria-busy */
  loading?: boolean;
  /** Radix Slot — Link 등 다른 요소로 렌더 */
  asChild?: boolean;
  /** 좌측 아이콘 */
  leadingIcon?: ReactNode;
  /** 우측 아이콘 */
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      loading = false,
      disabled,
      asChild = false,
      leadingIcon,
      trailingIcon,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        {...props}
      >
        {loading ? (
          <Spinner
            size={size === 'lg' ? 'md' : 'sm'}
            label="로딩 중"
            aria-hidden="true"
          />
        ) : (
          leadingIcon
        )}
        {children}
        {!loading && trailingIcon}
      </Comp>
    );
  }
);

Button.displayName = 'Button';
