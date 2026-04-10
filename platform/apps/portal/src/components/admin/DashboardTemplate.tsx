// Design Ref: DESIGN-MTU-U1-P §F — DashboardTemplate 위젯 그리드
// Plan SC: FR-UP.17

'use client';

import type { ReactNode } from 'react';

interface Widget {
  id: string;
  title: string;
  span?: 1 | 2 | 3;
  content: ReactNode;
}

interface DashboardTemplateProps {
  title: string;
  widgets: Widget[];
}

export function DashboardTemplate({ title, widgets }: DashboardTemplateProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
        {title}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {widgets.map((widget) => (
          <div
            key={widget.id}
            className="border rounded-lg p-4"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              gridColumn: widget.span ? `span ${widget.span}` : undefined,
            }}
          >
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-muted)' }}>
              {widget.title}
            </h3>
            {widget.content}
          </div>
        ))}
      </div>
    </div>
  );
}
