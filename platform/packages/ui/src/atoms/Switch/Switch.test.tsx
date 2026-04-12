/**
 * DS-ATOM-R2 — Switch 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from './index.js';

describe('Switch', () => {
  it('renders with label', () => {
    render(<Switch label="알림 수신" />);
    expect(screen.getByLabelText('알림 수신')).toBeInTheDocument();
  });

  it('has role="switch"', () => {
    render(<Switch />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('toggles on click', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Switch label="토글" onChange={handleChange} />);
    await user.click(screen.getByRole('switch'));
    expect(handleChange).toHaveBeenCalled();
  });

  it('supports disabled', () => {
    render(<Switch disabled />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('renders all sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    sizes.forEach((s) => {
      const { unmount } = render(<Switch size={s} label={`size-${s}`} />);
      expect(screen.getByLabelText(`size-${s}`)).toBeInTheDocument();
      unmount();
    });
  });
});
