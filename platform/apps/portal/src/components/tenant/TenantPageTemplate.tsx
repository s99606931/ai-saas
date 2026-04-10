// Design Ref: DESIGN-MTU-U1-P §F — TenantPageTemplate
// Plan SC: FR-UP.16

'use client';

import type { ReactNode } from 'react';

interface TenantPageTemplateProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function TenantPageTemplate({ title, description, children }: TenantPageTemplateProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
          {title}
        </h1>
        {description && (
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {description}
          </p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
