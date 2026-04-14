/**
 * DS-ATOM-R4 — Heading 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-ATOM-R4.design.md §1
 * Plan SC: FR-DSA.31, FR-DSA.34, FR-DSA.35
 *
 * level(1~6) + optional as(다운그레이드). aria-level 보존.
 * 기존 --font-size-* fluid clamp 토큰 재사용.
 */

import {
  forwardRef,
  createElement,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn.js';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type HeadingWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /** 의미론적 헤딩 레벨 (필수) */
  level: HeadingLevel;
  /** 시각적 렌더 태그 — 생략 시 level 사용 */
  as?: HeadingLevel;
  /** 폰트 굵기 */
  weight?: HeadingWeight;
  /** 한 줄 말줄임 처리 */
  truncate?: boolean;
  children?: ReactNode;
}

const sizeByLevel: Record<HeadingLevel, string> = {
  1: 'text-[length:var(--font-size-5xl)]',
  2: 'text-[length:var(--font-size-4xl)]',
  3: 'text-[length:var(--font-size-3xl)]',
  4: 'text-[length:var(--font-size-2xl)]',
  5: 'text-[length:var(--font-size-xl)]',
  6: 'text-[length:var(--font-size-lg)]',
};

const weightClass: Record<HeadingWeight, string> = {
  regular: 'font-[var(--font-weight-regular)]',
  medium: 'font-[var(--font-weight-medium)]',
  semibold: 'font-[var(--font-weight-semibold)]',
  bold: 'font-[var(--font-weight-bold)]',
};

function defaultWeight(level: HeadingLevel): HeadingWeight {
  return level <= 3 ? 'bold' : 'semibold';
}

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level, as, weight, truncate, className, children, ...props }, ref) => {
    const renderLevel = as ?? level;
    const Tag = `h${renderLevel}` as const;
    const effectiveWeight = weight ?? defaultWeight(level);

    return createElement(
      Tag,
      {
        ref,
        'aria-level': as && as !== level ? level : undefined,
        className: cn(
          'font-[var(--font-sans)]',
          'leading-[var(--line-height-tight)]',
          'text-[var(--color-on-surface)]',
          sizeByLevel[level],
          weightClass[effectiveWeight],
          truncate && 'truncate',
          className
        ),
        ...props,
      },
      children
    );
  }
);

Heading.displayName = 'Heading';
