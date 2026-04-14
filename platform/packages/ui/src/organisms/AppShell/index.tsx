/**
 * DS-ORG-R1 — AppShell 레이아웃
 * Design Ref: docs/02-design/mtus/DS-ORG-R1.design.md §AppShell 구조
 * Plan SC: FR-DSO.11, FR-DSO.11.1
 *
 * Header(60px 고정) + Sidebar + main 을 CSS Grid로 배치.
 * 모바일(<768px)에서는 Sidebar를 숨기고 main 단일 컬럼.
 */

import { forwardRef, type ReactNode } from 'react';
import { cn } from '../../atoms/lib/cn.js';

export interface AppShellProps {
  header: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
  /** 사이드바 접힘 여부. true=64px, false=240px */
  sidebarCollapsed?: boolean;
  className?: string;
  /** main 영역 className */
  mainClassName?: string;
}

export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(
  (
    {
      header,
      sidebar,
      children,
      sidebarCollapsed = false,
      className,
      mainClassName,
    },
    ref
  ) => {
    const sidebarWidth = sidebarCollapsed ? '64px' : '240px';

    return (
      <div
        ref={ref}
        className={cn(
          'min-h-screen grid bg-[var(--color-background)] text-[var(--color-on-background)]',
          className
        )}
        style={{
          gridTemplateAreas: "'header header' 'sidebar main'",
          gridTemplateRows: '60px 1fr',
          gridTemplateColumns: `${sidebarWidth} 1fr`,
        }}
        data-shell-collapsed={sidebarCollapsed || undefined}
      >
        <div
          style={{ gridArea: 'header' }}
          className="border-b border-[var(--color-border)]"
        >
          {header}
        </div>
        <div
          style={{ gridArea: 'sidebar' }}
          className="hidden md:block border-r border-[var(--color-border)] overflow-y-auto"
        >
          {sidebar}
        </div>
        <main
          id="main"
          role="main"
          style={{ gridArea: 'main' }}
          className={cn('overflow-y-auto p-6', mainClassName)}
        >
          {/* Skip link target — 접근성 */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-[var(--color-primary)] focus:text-[var(--color-on-primary)] focus:px-3 focus:py-2 focus:rounded-md"
          >
            본문 바로가기
          </a>
          {children}
        </main>
      </div>
    );
  }
);

AppShell.displayName = 'AppShell';
