// Design Ref: DESIGN-MTU-U1-P §F — AdminPageTemplate
// Plan SC: FR-UP.15

'use client';

import type { ReactNode } from 'react';

interface AdminPageTemplateProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminPageTemplate({
  title,
  description,
  actions,
  children,
}: AdminPageTemplateProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            {title}
          </h1>
          {description && (
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}
