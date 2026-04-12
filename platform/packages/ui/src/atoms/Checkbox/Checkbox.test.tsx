/**
 * DS-ATOM-R2 — Checkbox 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './index.js';

describe('Checkbox', () => {
  it('renders with label', () => {
    render(<Checkbox label="동의합니다" />);
    expect(screen.getByLabelText('동의합니다')).toBeInTheDocument();
  });

  it('toggles on click', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Checkbox label="체크" onChange={handleChange} />);
    const cb = screen.getByRole('checkbox');
    await user.click(cb);
    expect(handleChange).toHaveBeenCalled();
    expect(cb).toBeChecked();
  });

  it('supports indeterminate state', () => {
    render(<Checkbox label="일부" indeterminate />);
    const cb = screen.getByRole('checkbox') as HTMLInputElement;
    expect(cb.indeterminate).toBe(true);
  });

  it('keyboard activation with Space', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="키보드" />);
    const cb = screen.getByRole('checkbox');
    cb.focus();
    await user.keyboard(' ');
    expect(cb).toBeChecked();
  });

  it('sets aria-invalid on error', () => {
    render(<Checkbox error />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables when disabled prop set', () => {
    render(<Checkbox disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});
