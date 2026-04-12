/**
 * DS-ATOM-R1 — Spinner 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-ATOM-R1.design.md §Spinner
 * Plan SC: FR-DSA.6
 *
 * 로딩 인디케이터 — role="status", aria-live="polite"
 * prefers-reduced-motion 시 회전 정지
 */

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  /** 스크린리더 라벨 (기본: "로딩 중") */
  label?: string;
}

const sizeMap = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-[3px]',
  lg: 'h-10 w-10 border-4',
} as const;

export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = 'md', label = '로딩 중', ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn('inline-flex items-center justify-center', className)}
        {...props}
      >
        <span
          className={cn(
            'inline-block rounded-full',
            'border-current border-t-transparent',
            'animate-spin',
            'motion-reduce:animate-none',
            'text-[var(--color-primary)]',
            sizeMap[size]
          )}
          aria-hidden="true"
        />
        <span className="sr-only">{label}</span>
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';
