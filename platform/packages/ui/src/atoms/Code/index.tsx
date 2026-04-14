/**
 * DS-ATOM-R4 — Code 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-ATOM-R4.design.md §3
 * Plan SC: FR-DSA.33, FR-DSA.34
 *
 * inline <code> 또는 block <pre><code>. mono 폰트 + 서피스 배경.
 */

import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn.js';

export type CodeSize = 'xs' | 'sm' | 'base';

export interface CodeProps extends HTMLAttributes<HTMLElement> {
  /** block 모드: <pre><code> 렌더 */
  block?: boolean;
  size?: CodeSize;
  children?: ReactNode;
}

const sizeClass: Record<CodeSize, string> = {
  xs: 'text-[length:var(--font-size-xs)]',
  sm: 'text-[length:var(--font-size-sm)]',
  base: 'text-[length:var(--font-size-base)]',
};

export const Code = forwardRef<HTMLElement, CodeProps>(
  ({ block = false, size = 'sm', className, children, ...props }, ref) => {
    const baseClass = cn(
      'font-[var(--font-mono)]',
      'text-[var(--color-on-surface)]',
      'bg-[var(--color-surface-alt)]',
      sizeClass[size]
    );

    if (block) {
      return (
        <pre
          className={cn(
            baseClass,
            'block w-full overflow-x-auto',
            'rounded-[var(--radius-md)]',
            'px-4 py-3',
            'leading-[var(--line-height-relaxed)]',
            className
          )}
        >
          <code ref={ref} {...props}>
            {children}
          </code>
        </pre>
      );
    }

    return (
      <code
        ref={ref}
        className={cn(
          baseClass,
          'inline rounded-[var(--radius-xs)] px-1 py-0.5',
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  }
);

Code.displayName = 'Code';
