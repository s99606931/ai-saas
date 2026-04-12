/**
 * DS-ATOM-R2 — Textarea 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-ATOM-R2.design.md §Textarea
 * Plan SC: FR-DSA.14
 */

import {
  forwardRef,
  useId,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../lib/cn.js';

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 내용에 따라 자동 크기 조절 */
  autoResize?: boolean;
  minRows?: number;
  maxRows?: number;
  error?: boolean | string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      autoResize = false,
      minRows = 3,
      maxRows = 10,
      error,
      helperText,
      id: providedId,
      value,
      defaultValue,
      onChange,
      ...props
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const generatedId = useId();
    const id = providedId ?? generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : undefined;

    // forwardRef 병합
    const setRef = (el: HTMLTextAreaElement | null) => {
      internalRef.current = el;
      if (typeof forwardedRef === 'function') {
        forwardedRef(el);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      }
    };

    // 자동 크기 조절
    useLayoutEffect(() => {
      if (!autoResize) return;
      const el = internalRef.current;
      if (!el) return;
      el.style.height = 'auto';
      const lineHeight = parseInt(getComputedStyle(el).lineHeight || '20', 10);
      const minHeight = lineHeight * minRows;
      const maxHeight = lineHeight * maxRows;
      const newHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
      el.style.height = `${newHeight}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [autoResize, value, minRows, maxRows]);

    return (
      <div className="w-full">
        <textarea
          ref={setRef}
          id={id}
          rows={minRows}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          aria-invalid={hasError || undefined}
          aria-describedby={
            errorMessage ? errorId : helperText ? helperId : undefined
          }
          className={cn(
            'w-full bg-[var(--input-bg)] text-[var(--input-fg)]',
            'placeholder:text-[var(--input-placeholder)]',
            'border border-[var(--input-border)]',
            'rounded-[var(--input-radius)]',
            'px-[var(--input-padding-x)] py-[var(--space-2)]',
            'text-[length:var(--input-font-size)]',
            'transition-[border-color,box-shadow]',
            'duration-[var(--motion-duration-fast)]',
            'hover:border-[var(--input-border-hover)]',
            'focus:outline-none',
            'focus:border-[var(--input-border-focus)]',
            'focus:shadow-[var(--input-shadow-focus)]',
            'disabled:bg-[var(--color-disabled-bg)]',
            'disabled:text-[var(--color-disabled-fg)]',
            'disabled:cursor-not-allowed',
            'aria-[invalid=true]:border-[var(--input-border-error)]',
            autoResize && 'resize-none',
            className
          )}
          {...props}
        />
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

Textarea.displayName = 'Textarea';
