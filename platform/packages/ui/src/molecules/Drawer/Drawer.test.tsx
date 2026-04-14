/**
 * DS-MOL-R3 — Drawer 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Drawer } from './index.js';

describe('Drawer', () => {
  it('does not render when closed', () => {
    render(
      <Drawer open={false} onClose={vi.fn()} title="설정">
        본문
      </Drawer>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when open', () => {
    render(
      <Drawer open onClose={vi.fn()} title="설정">
        본문
      </Drawer>
    );
    const dialog = screen.getByRole('dialog', { name: '설정' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('defaults to right side', () => {
    render(
      <Drawer open onClose={vi.fn()} title="X">
        본문
      </Drawer>
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'right');
  });

  it('renders with left side', () => {
    render(
      <Drawer open onClose={vi.fn()} side="left" title="X">
        본문
      </Drawer>
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'left');
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="X">
        본문
      </Drawer>
    );
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="X">
        본문
      </Drawer>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders footer slot', () => {
    render(
      <Drawer
        open
        onClose={vi.fn()}
        title="X"
        footer={<button>저장</button>}
      >
        본문
      </Drawer>
    );
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
  });
});
