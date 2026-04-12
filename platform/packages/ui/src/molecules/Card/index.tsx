/**
 * DS-MOL-R1 — Card 분자 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-MOL-R1.design.md §결정 3
 * Plan SC: FR-DSM.5, FR-DSM.6
 *
 * Compound Component: Card + Card.Header + Card.Body + Card.Footer
 */

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../atoms/lib/cn.js';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 호버 효과 + 클릭 가능 */
  interactive?: boolean;
  /** padding 제거 (slot 내부에서 직접 관리) */
  noPadding?: boolean;
}

const CardRoot = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, noPadding, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-[var(--card-bg)]',
          'border border-[var(--card-border)]',
          'rounded-[var(--card-radius)]',
          'shadow-[var(--card-shadow)]',
          !noPadding && 'p-[var(--card-padding)]',
          'transition-[box-shadow,border-color,transform]',
          'duration-[var(--motion-duration-base)]',
          'ease-[var(--motion-ease-out)]',
          interactive && [
            'cursor-pointer',
            'hover:shadow-[var(--card-shadow-hover)]',
            'hover:border-[var(--color-outline)]',
            'focus-visible:outline-none',
            'focus-visible:ring-2',
            'focus-visible:ring-[var(--color-focus-ring)]',
            'focus-visible:ring-offset-2',
          ].join(' '),
          className
        )}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? 'button' : undefined}
        {...props}
      />
    );
  }
);
CardRoot.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-start justify-between gap-4',
        'pb-[var(--space-3)]',
        'border-b border-[var(--color-outline-variant)]',
        'mb-[var(--space-4)]',
        className
      )}
      {...props}
    />
  )
);
CardHeader.displayName = 'Card.Header';

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'text-[length:var(--font-size-lg)]',
        'font-[var(--font-weight-semibold)]',
        'text-[var(--color-on-surface)]',
        'leading-[var(--line-height-snug)]',
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = 'Card.Title';

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        'text-[length:var(--font-size-sm)]',
        'text-[var(--color-on-surface-variant)]',
        'mt-1',
        className
      )}
      {...props}
    />
  )
);
CardDescription.displayName = 'Card.Description';

const CardBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-[var(--color-on-surface)]', className)} {...props} />
  )
);
CardBody.displayName = 'Card.Body';

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-end gap-2',
        'mt-[var(--space-4)]',
        'pt-[var(--space-3)]',
        'border-t border-[var(--color-outline-variant)]',
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = 'Card.Footer';

type CardCompound = typeof CardRoot & {
  Header: typeof CardHeader;
  Title: typeof CardTitle;
  Description: typeof CardDescription;
  Body: typeof CardBody;
  Footer: typeof CardFooter;
};

export const Card = CardRoot as CardCompound;
Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Body = CardBody;
Card.Footer = CardFooter;
