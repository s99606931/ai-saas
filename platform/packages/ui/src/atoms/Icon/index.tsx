/**
 * DS-ATOM-R1 — Icon 컴포넌트 (Lucide 래핑)
 * Design Ref: docs/02-design/mtus/DS-ATOM-R1.design.md §Icon
 * Plan SC: FR-DSA.7, FR-DSA.8, FR-DSA.9
 *
 * Lucide React 아이콘을 토큰 size 시스템으로 일관성 있게 표시.
 * label 있으면 aria-label, 없으면 aria-hidden (장식용).
 */

import { forwardRef, type SVGAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn.js';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'children'> {
  /** Lucide React 아이콘 컴포넌트 */
  icon: LucideIcon;
  /** 아이콘 크기 (토큰 기반) */
  size?: IconSize;
  /** 스크린리더 라벨 — 없으면 aria-hidden */
  label?: string;
}

const sizeMap: Record<IconSize, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ icon: LucideComponent, size = 'md', label, className, ...props }, ref) => {
    const pixels = sizeMap[size];

    return (
      <LucideComponent
        ref={ref}
        size={pixels}
        className={cn('shrink-0', className)}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        role={label ? 'img' : undefined}
        focusable="false"
        {...props}
      />
    );
  }
);

Icon.displayName = 'Icon';
