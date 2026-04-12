/**
 * DS-ATOM-R2 — Input 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-ATOM-R2.design.md §Input
 * Plan SC: FR-DSA.12, FR-DSA.13, FR-DSA.18
 */

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { inputVariants } from './Input.variants.js';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md' | 'lg';
  /** 에러 상태 (boolean) 또는 에러 메시지 (string) */
  error?: boolean | string;
  /** 좌측 장식 (아이콘 등) */
  leadingIcon?: ReactNode;
  /** 우측 장식 (아이콘 등) */
  trailingIcon?: ReactNode;
  /** 도움말 텍스트 */
  helperText?: ReactNode;
  /** 래퍼 className */
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      wrapperClassName,
      size = 'md',
      type = 'text',
      error,
      leadingIcon,
      trailingIcon,
      helperText,
      id: providedId,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId ?? generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : undefined;

    const describedBy =
      [
        ariaDescribedBy,
        errorMessage ? errorId : null,
        helperText && !errorMessage ? helperId : null,
      ]
        .filter(Boolean)
        .join(' ') || undefined;

    return (
      <div className={cn('w-full', wrapperClassName)}>
        <div className="relative">
          {leadingIcon && (
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--color-on-surface-muted)]"
              aria-hidden="true"
            >
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            type={type}
            className={cn(
              inputVariants({
                size,
                withLeadingIcon: Boolean(leadingIcon),
                withTrailingIcon: Boolean(trailingIcon),
              }),
              className
            )}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            {...props}
          />
          {trailingIcon && (
            <span
              className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-on-surface-muted)]"
              aria-hidden="true"
            >
              {trailingIcon}
            </span>
          )}
        </div>
        {errorMessage && (
          <p
            id={errorId}
            role="alert"
            aria-live="polite"
            className="mt-1 text-[length:var(--font-size-xs)] text-[var(--color-error)]"
          >
            {errorMessage}
          </p>
        )}
        {helperText && !errorMessage && (
          <p
            id={helperId}
            className="mt-1 text-[length:var(--font-size-xs)] text-[var(--color-on-surface-muted)]"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
