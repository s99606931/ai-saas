/**
 * DS-ATOM-R3 — Avatar 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Avatar, getInitials } from './index.js';

describe('getInitials', () => {
  it('returns first hangul character for Korean name', () => {
    expect(getInitials('홍길동')).toBe('홍');
  });

  it('returns two-letter uppercase initials for English full name', () => {
    expect(getInitials('john doe')).toBe('JD');
  });

  it('returns single uppercase letter for single English word', () => {
    expect(getInitials('john')).toBe('J');
  });

  it('returns empty for empty string', () => {
    expect(getInitials('')).toBe('');
  });

  it('handles mixed whitespace', () => {
    expect(getInitials('  jane   smith  ')).toBe('JS');
  });
});

describe('Avatar', () => {
  it('renders image when src provided', () => {
    render(<Avatar src="/avatar.png" alt="홍길동" />);
    const img = screen.getByRole('img', { name: '홍길동' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/avatar.png');
  });

  it('renders initials fallback when no src', () => {
    render(<Avatar alt="사용자" name="홍길동" />);
    expect(screen.getByText('홍')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '사용자' })).toBeInTheDocument();
  });

  it('falls back to initials on image load error', () => {
    render(<Avatar src="/broken.png" alt="폴백 테스트" name="John Doe" />);
    const img = screen.getByRole('img', { name: '폴백 테스트' });
    fireEvent.error(img);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('uses alt for initials when name missing', () => {
    render(<Avatar alt="Kim" />);
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('renders custom fallback', () => {
    render(
      <Avatar alt="아이콘 폴백" fallback={<span data-testid="custom">★</span>} />
    );
    expect(screen.getByTestId('custom')).toBeInTheDocument();
  });

  it('renders status indicator', () => {
    render(<Avatar alt="사용자" status="online" />);
    expect(screen.getByRole('status', { name: /online/ })).toBeInTheDocument();
  });

  it('applies size variant classes', () => {
    const { container } = render(<Avatar alt="사용자" size="xl" />);
    const wrapper = container.querySelector('span');
    expect(wrapper?.className).toMatch(/h-20/);
  });

  it('applies square shape', () => {
    const { container } = render(<Avatar alt="사용자" shape="square" />);
    const wrapper = container.querySelector('span');
    expect(wrapper?.className).toMatch(/rounded-\[var\(--radius-md\)\]/);
  });
});
