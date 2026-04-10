// Design Ref: DESIGN-MTU-U1-P §G — SidebarBottomSheet 모바일 전용
// Plan SC: FR-UP.19

'use client';

import type { ReactNode } from 'react';

interface SidebarBottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function SidebarBottomSheet({ open, onClose, title, children }: SidebarBottomSheetProps) {
  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50">
      {/* 백드롭 */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        role="presentation"
      />

      {/* 바텀시트 */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl transition-transform duration-300"
        style={{
          backgroundColor: 'var(--color-bg)',
          maxHeight: '80vh',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
        }}
        role="dialog"
        aria-label={title}
      >
        {/* 핸들 */}
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--color-border)' }} />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {title}
          </h2>
          <button onClick={onClose} className="p-2" style={{ color: 'var(--color-text-muted)' }} aria-label="닫기">
            ✕
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="overflow-y-auto px-4 pb-8" style={{ maxHeight: 'calc(80vh - 80px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
