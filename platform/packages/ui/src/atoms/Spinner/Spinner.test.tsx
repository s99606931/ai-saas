/**
 * DS-ATOM-R1 — Spinner 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from './index.js';

describe('Spinner', () => {
  it('renders with default label', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('로딩 중')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<Spinner label="저장 중입니다" />);
    expect(screen.getByText('저장 중입니다')).toBeInTheDocument();
  });

  it('has aria-live="polite"', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('renders all sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    sizes.forEach((s) => {
      const { unmount } = render(<Spinner size={s} label={`size-${s}`} />);
      expect(screen.getByText(`size-${s}`)).toBeInTheDocument();
      unmount();
    });
  });
});
