/**
 * DS-MOL-R2 — StatusCard 분자 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-MOL-R2.design.md §2
 * Plan SC: FR-DSM.12, FR-DSM.12.1
 *
 * KPI 카드: 제목 + 수치 + 아이콘 + 트렌드 + variant.
 */

import { type ReactNode } from 'react';
import { cn } from '../../atoms/lib/cn.js';
import { Card } from '../Card/index.js';

export type StatusCardVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

export type StatusCardTrendDirection = 'up' | 'down' | 'neutral';

export interface StatusCardTrend {
  value: number;
  direction: StatusCardTrendDirection;
  label?: string;
}

export interface StatusCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: StatusCardTrend;
  description?: ReactNode;
  variant?: StatusCardVariant;
  className?: string;
}

const variantAccent: Record<StatusCardVariant, string> = {
  default: 'border-l-4 border-l-[var(--color-outline)]',
  success: 'border-l-4 border-l-[var(--color-success)]',
  warning: 'border-l-4 border-l-[var(--color-warning)]',
  error: 'border-l-4 border-l-[var(--color-error)]',
  info: 'border-l-4 border-l-[var(--color-primary)]',
};

const trendColor: Record<StatusCardTrendDirection, string> = {
  up: 'text-[var(--color-success)]',
  down: 'text-[var(--color-error)]',
  neutral: 'text-[var(--color-on-surface-muted)]',
};

const trendSymbol: Record<StatusCardTrendDirection, string> = {
  up: '↑',
  down: '↓',
  neutral: '→',
};

export function StatusCard({
  title,
  value,
  icon,
  trend,
  description,
  variant = 'default',
  className,
}: StatusCardProps) {
  return (
    <Card className={cn(variantAccent[variant], className)}>
      <div className="flex items-start justify-between gap-[var(--space-3)]">
        <div className="flex items-start gap-[var(--space-2)] min-w-0">
          {icon && (
            <span
              aria-hidden="true"
              className="shrink-0 text-[var(--color-on-surface-muted)]"
            >
              {icon}
            </span>
          )}
          <h3
            className={cn(
              'text-[length:var(--font-size-sm)]',
              'font-[var(--font-weight-medium)]',
              'text-[var(--color-on-surface-muted)]',
              'truncate'
            )}
          >
            {title}
          </h3>
        </div>
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-1',
              'text-[length:var(--font-size-xs)]',
              'font-[var(--font-weight-semibold)]',
              trendColor[trend.direction]
            )}
            aria-label={`${trend.label ?? '변화'} ${trend.direction} ${trend.value}%`}
          >
            <span aria-hidden="true">{trendSymbol[trend.direction]}</span>
            <span>{trend.value}%</span>
          </span>
        )}
      </div>
      <div
        className={cn(
          'mt-[var(--space-2)]',
          'text-[length:var(--font-size-3xl)]',
          'font-[var(--font-weight-bold)]',
          'text-[var(--color-on-surface)]',
          'leading-[var(--line-height-tight)]'
        )}
      >
        {value}
      </div>
      {description && (
        <p
          className={cn(
            'mt-[var(--space-1)]',
            'text-[length:var(--font-size-xs)]',
            'text-[var(--color-on-surface-muted)]'
          )}
        >
          {description}
          {trend?.label && !description && ` ${trend.label}`}
        </p>
      )}
      {!description && trend?.label && (
        <p
          className={cn(
            'mt-[var(--space-1)]',
            'text-[length:var(--font-size-xs)]',
            'text-[var(--color-on-surface-muted)]'
          )}
        >
          {trend.label}
        </p>
      )}
    </Card>
  );
}

StatusCard.displayName = 'StatusCard';
