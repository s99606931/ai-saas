/**
 * DS-ATOM-R1 — Badge 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-ATOM-R1.design.md §Badge
 * Plan SC: FR-DSA.5, FR-DSA.8, FR-DSA.9
 */

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';
import { type VariantProps } from '../lib/cva.js';
import { badgeVariants, getDotColor, type BadgeVariant } from './Badge.variants.js';

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** 좌측 점 인디케이터 표시 */
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, dot = false, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      >
        {dot && (
          <span
            aria-hidden="true"
            className={cn(
              'inline-block h-1.5 w-1.5 rounded-full',
              getDotColor((variant ?? 'default') as BadgeVariant)
            )}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
