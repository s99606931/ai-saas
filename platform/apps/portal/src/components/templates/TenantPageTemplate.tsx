// Design Ref: DESIGN-MTU-U1-P §F — TenantPageTemplate
// Plan SC: FR-UP.16

'use client';

import type { ReactNode } from 'react';

interface TenantPageTemplateProps {
  title: string;
  tenantName?: string;
  breadcrumbs?: { label: string; href?: string }[];
  children: ReactNode;
}

export function TenantPageTemplate({
  title,
  tenantName,
  breadcrumbs,
  children,
}: TenantPageTemplateProps) {
  return (
    <div className="p-6 space-y-4">
      {/* 브레드크럼 */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="경로 탐색" className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.label}>
              {i > 0 && <span className="mx-1">/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="hover:underline">{crumb.label}</a>
              ) : (
                <span style={{ color: 'var(--color-text)' }}>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* 페이지 헤더 */}
      <div>
        {tenantName && (
          <p className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
            {tenantName}
          </p>
        )}
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          {title}
        </h1>
      </div>

      {/* 페이지 본문 */}
      <div>{children}</div>
    </div>
  );
}
