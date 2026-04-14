/**
 * DS-MOL-R3 — Toast 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from './index.js';

function ShowButton({
  variant,
  duration,
}: {
  variant?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}) {
  const { show } = useToast();
  return (
    <button
      onClick={() =>
        show({
          title: '알림 제목',
          description: '알림 내용',
          variant,
          // duration이 명시되지 않으면 ToastProvider의 defaultDuration 사용
          ...(duration !== undefined ? { duration } : {}),
        })
      }
    >
      표시
    </button>
  );
}

describe('Toast', () => {
  it('useToast throws outside provider', () => {
    function Bad() {
      useToast();
      return null;
    }
    // 콘솔 에러 silencing
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });

  it('shows toast on show()', () => {
    render(
      <ToastProvider>
        <ShowButton duration={0} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: '표시' }));
    expect(screen.getByText('알림 제목')).toBeInTheDocument();
    expect(screen.getByText('알림 내용')).toBeInTheDocument();
  });

  it('uses role=status for non-error variants', () => {
    render(
      <ToastProvider>
        <ShowButton variant="success" duration={0} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: '표시' }));
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('uses role=alert for error variant', () => {
    render(
      <ToastProvider>
        <ShowButton variant="error" duration={0} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: '표시' }));
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('dismisses on close button click', () => {
    render(
      <ToastProvider>
        <ShowButton duration={0} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: '표시' }));
    fireEvent.click(screen.getByRole('button', { name: '알림 닫기' }));
    expect(screen.queryByText('알림 제목')).not.toBeInTheDocument();
  });

  it('auto-dismisses after duration', async () => {
    render(
      <ToastProvider defaultDuration={50}>
        <ShowButton />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: '표시' }));
    expect(screen.getByText('알림 제목')).toBeInTheDocument();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(screen.queryByText('알림 제목')).not.toBeInTheDocument();
  });

  it('persists when duration=0', async () => {
    render(
      <ToastProvider defaultDuration={50}>
        <ShowButton duration={0} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: '표시' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(screen.getByText('알림 제목')).toBeInTheDocument();
  });

  it('stacks multiple toasts', () => {
    function Multi() {
      const { show } = useToast();
      return (
        <button
          onClick={() => {
            show({ title: '첫번째', duration: 0 });
            show({ title: '두번째', duration: 0 });
          }}
        >
          표시
        </button>
      );
    }
    render(
      <ToastProvider>
        <Multi />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: '표시' }));
    expect(screen.getByText('첫번째')).toBeInTheDocument();
    expect(screen.getByText('두번째')).toBeInTheDocument();
  });
});
