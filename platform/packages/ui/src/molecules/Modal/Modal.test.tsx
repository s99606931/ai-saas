/**
 * DS-MOL-R3 — Modal 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './index.js';

describe('Modal', () => {
  it('does not render when open=false', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="제목">
        본문
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders with role=dialog and aria-modal when open', () => {
    render(
      <Modal open onClose={vi.fn()} title="확인">
        본문
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('connects title to aria-labelledby', () => {
    render(
      <Modal open onClose={vi.fn()} title="삭제 확인">
        본문
      </Modal>
    );
    const dialog = screen.getByRole('dialog', { name: '삭제 확인' });
    expect(dialog).toBeInTheDocument();
  });

  it('uses aria-label when no title', () => {
    render(
      <Modal open onClose={vi.fn()} aria-label="익명 다이얼로그">
        본문
      </Modal>
    );
    expect(screen.getByRole('dialog', { name: '익명 다이얼로그' })).toBeInTheDocument();
  });

  it('renders close button by default', () => {
    render(
      <Modal open onClose={vi.fn()} title="제목">
        본문
      </Modal>
    );
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();
  });

  it('hides close button when hideCloseButton=true', () => {
    render(
      <Modal open onClose={vi.fn()} title="제목" hideCloseButton>
        본문
      </Modal>
    );
    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="제목">
        본문
      </Modal>
    );
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="제목">
        본문
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close on Escape when closeOnEscape=false', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="제목" closeOnEscape={false}>
        본문
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on backdrop click by default', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} title="제목">
        본문
      </Modal>
    );
    const backdrop = container.querySelector('.bg-black\\/50') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders footer slot', () => {
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="제목"
        footer={<button>저장</button>}
      >
        본문
      </Modal>
    );
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
  });
});
