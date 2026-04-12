/**
 * DS-ATOM-R2 — Checkbox 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-ATOM-R2.design.md §Checkbox
 * Plan SC: FR-DSA.15
 *
 * 네이티브 input + 시각 래퍼. indeterminate 지원.
 */

import {
  forwardRef,
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn.js';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** 중간 상태 (일부 선택) */
  indeterminate?: boolean;
  /** 라벨 (inline) */
  label?: ReactNode;
  error?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { className, indeterminate = false, label, error, disabled, id, ...props },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLInputElement>(null);

    const setRef = (el: HTMLInputElement | null) => {
      internalRef.current = el;
      if (typeof forwardedRef === 'function') forwardedRef(el);
      else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      }
    };

    useEffect(() => {
      if (internalRef.current) {
        internalRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const content = (
      <span
        className={cn(
          'inline-flex items-center gap-2',
          disabled && 'cursor-not-allowed opacity-60',
          !disabled && 'cursor-pointer'
        )}
      >
        <input
          ref={setRef}
          id={id}
          type="checkbox"
          disabled={disabled}
          aria-invalid={error || undefined}
          className={cn(
            'h-4 w-4 shrink-0',
            'rounded-[var(--radius-xs)]',
            'border-[1.5px] border-[var(--color-outline-strong)]',
            'text-[var(--color-primary)]',
            'transition-colors duration-[var(--motion-duration-fast)]',
            'focus-visible:outline-none',
            'focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
            'focus-visible:ring-offset-2',
            'checked:bg-[var(--color-primary)]',
            'checked:border-[var(--color-primary)]',
            'indeterminate:bg-[var(--color-primary)]',
            'indeterminate:border-[var(--color-primary)]',
            'disabled:cursor-not-allowed',
            'aria-[invalid=true]:border-[var(--color-error)]',
            className
          )}
          {...props}
        />
        {label && (
          <span className="text-[length:var(--font-size-sm)] text-[var(--color-on-surface)]">
            {label}
          </span>
        )}
      </span>
    );

    return label ? <label>{content}</label> : content;
  }
);

Checkbox.displayName = 'Checkbox';
