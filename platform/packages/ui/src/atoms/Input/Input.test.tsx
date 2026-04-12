/**
 * DS-ATOM-R2 — Input 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './index.js';

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="이메일 입력" />);
    expect(screen.getByPlaceholderText('이메일 입력')).toBeInTheDocument();
  });

  it('handles text input', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    await user.type(screen.getByRole('textbox'), 'hello');
    expect(handleChange).toHaveBeenCalled();
  });

  it('shows error message with role="alert"', () => {
    render(<Input error="필수 항목입니다" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('필수 항목입니다');
  });

  it('sets aria-invalid when error is present', () => {
    render(<Input error="오류" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows helper text when no error', () => {
    render(<Input helperText="8자 이상 입력하세요" />);
    expect(screen.getByText('8자 이상 입력하세요')).toBeInTheDocument();
  });

  it('hides helper text when error present', () => {
    render(<Input helperText="도움말" error="에러" />);
    expect(screen.queryByText('도움말')).not.toBeInTheDocument();
    expect(screen.getByText('에러')).toBeInTheDocument();
  });

  it('links aria-describedby to error id', () => {
    render(<Input error="에러 메시지" id="email" />);
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-describedby')).toContain('email-error');
  });

  it('supports disabled state', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('renders leading and trailing icons', () => {
    render(
      <Input
        leadingIcon={<span data-testid="lead">L</span>}
        trailingIcon={<span data-testid="trail">T</span>}
      />
    );
    expect(screen.getByTestId('lead')).toBeInTheDocument();
    expect(screen.getByTestId('trail')).toBeInTheDocument();
  });

  it('forwards ref', () => {
    let ref: HTMLInputElement | null = null;
    render(
      <Input
        ref={(el) => {
          ref = el;
        }}
      />
    );
    expect(ref).toBeInstanceOf(HTMLInputElement);
  });
});
