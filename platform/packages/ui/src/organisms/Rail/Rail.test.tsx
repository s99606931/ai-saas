/**
 * DS-ORG-R1 — Rail 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Rail, type RailMenuItem } from './index.js';

const items: RailMenuItem[] = [
  { id: '1', label: '대시보드', path: '/dashboard', icon: <svg data-testid="i1" /> },
  { id: '2', label: '사용자', path: '/users', icon: <svg data-testid="i2" /> },
  { id: '3', label: '감사', path: '/audit', icon: <svg data-testid="i3" /> },
];

describe('Rail', () => {
  it('renders navigation with all icon buttons', () => {
    render(<Rail menuItems={items} currentPath="/" />);
    expect(
      screen.getByRole('navigation', { name: '주 메뉴 (축소)' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('대시보드')).toBeInTheDocument();
    expect(screen.getByLabelText('사용자')).toBeInTheDocument();
    expect(screen.getByLabelText('감사')).toBeInTheDocument();
  });

  it('marks current path with aria-current', () => {
    render(<Rail menuItems={items} currentPath="/users" />);
    expect(screen.getByLabelText('사용자')).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByLabelText('대시보드')).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('calls onNavigate with path on click', () => {
    const onNavigate = vi.fn();
    render(
      <Rail menuItems={items} currentPath="/" onNavigate={onNavigate} />
    );
    fireEvent.click(screen.getByLabelText('감사'));
    expect(onNavigate).toHaveBeenCalledWith('/audit');
  });
});
