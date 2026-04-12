/**
 * DS-ATOM-R2 — Label 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from './index.js';

describe('Label', () => {
  it('renders children', () => {
    render(<Label>이메일</Label>);
    expect(screen.getByText('이메일')).toBeInTheDocument();
  });

  it('shows required marker', () => {
    render(<Label required>이름</Label>);
    const star = screen.getByLabelText('필수 입력');
    expect(star).toHaveTextContent('*');
  });

  it('shows optional marker', () => {
    render(<Label optional>비고</Label>);
    expect(screen.getByText('(선택)')).toBeInTheDocument();
  });

  it('does not show optional when required', () => {
    render(<Label required optional>항목</Label>);
    expect(screen.queryByText('(선택)')).not.toBeInTheDocument();
  });

  it('links to input via htmlFor', () => {
    render(<Label htmlFor="email-input">이메일</Label>);
    const lbl = screen.getByText('이메일');
    expect(lbl.closest('label')).toHaveAttribute('for', 'email-input');
  });
});
