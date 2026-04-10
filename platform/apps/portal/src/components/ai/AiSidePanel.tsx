// Design Ref: DESIGN-MTU-U1-P §D — AI 사이드 패널
// Plan SC: FR-UP.24

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface AiSidePanelProps {
  onClose: () => void;
}

const MIN_WIDTH = 260;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 360;

export function AiSidePanel({ onClose }: AiSidePanelProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [input, setInput] = useState('');
  const isDragging = useRef(false);

  // FR-UP.24: 드래그 리사이즈 (260~600px)
  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div
      className="flex shrink-0 border-l"
      style={{
        width: `${width}px`,
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg)',
      }}
      role="complementary"
      aria-label="AI 대화 패널"
    >
      {/* 리사이즈 핸들 */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1 cursor-col-resize hover:bg-blue-500/30 transition-colors"
        role="separator"
        aria-orientation="vertical"
        aria-label="AI 패널 크기 조절"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            AI 어시스턴트
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded text-xs"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="AI 패널 닫기"
          >
            ✕
          </button>
        </div>

        {/* 대화 영역 */}
        <div className="flex-1 overflow-y-auto p-3">
          <div
            className="text-sm p-3 rounded-lg"
            style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}
          >
            안녕하세요! 공공 SaaS 플랫폼 AI 어시스턴트입니다. CSAP 준수 현황 확인, 감리 문서 조회, 서비스 관리 등을
            도와드립니다.
          </div>
        </div>

        {/* 입력 영역 */}
        <div className="shrink-0 p-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="질문을 입력하세요..."
              className="flex-1 px-3 py-2 text-sm border rounded-lg"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
              }}
              aria-label="AI 질문 입력"
            />
            <button
              className="px-3 py-2 text-sm rounded-lg text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
              aria-label="전송"
            >
              전송
            </button>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            N2SF: O등급 데이터만 전송됩니다. C/S등급 데이터 전송 금지.
          </p>
        </div>
      </div>
    </div>
  );
}
