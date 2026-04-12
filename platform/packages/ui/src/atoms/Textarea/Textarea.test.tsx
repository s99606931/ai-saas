/**
 * DS-ATOM-R2 — Textarea 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from './index.js';

describe('Textarea', () => {
  it('renders with placeholder', () => {
    render(<Textarea placeholder="내용 입력" />);
    expect(screen.getByPlaceholderText('내용 입력')).toBeInTheDocument();
  });

  it('accepts multi-line input', async () => {
    const user = userEvent.setup();
    render(<Textarea />);
    const ta = screen.getByRole('textbox');
    await user.type(ta, 'line1{Enter}line2');
    expect((ta as HTMLTextAreaElement).value).toContain('line1');
    expect((ta as HTMLTextAreaElement).value).toContain('line2');
  });

  it('shows error message', () => {
    render(<Textarea error="필수 항목" />);
    expect(screen.getByRole('alert')).toHaveTextContent('필수 항목');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows helper text', () => {
    render(<Textarea helperText="500자 이내" />);
    expect(screen.getByText('500자 이내')).toBeInTheDocument();
  });

  it('supports disabled', () => {
    render(<Textarea disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
