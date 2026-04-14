/**
 * DS-ORG-R1 — Sidebar 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar, type SidebarMenuItem } from './index.js';

const items: SidebarMenuItem[] = [
  { id: '1', label: '대시보드', path: '/dashboard' },
  {
    id: '2',
    label: '사용자 관리',
    children: [
      { id: '2-1', label: '목록', path: '/users' },
      { id: '2-2', label: '권한', path: '/users/roles' },
    ],
  },
  { id: '3', label: '감사로그', path: '/audit' },
];

describe('Sidebar', () => {
  it('renders nav with aria-label', () => {
    render(<Sidebar menuItems={items} currentPath="/dashboard" />);
    expect(screen.getByRole('navigation', { name: '주 메뉴' })).toBeInTheDocument();
  });

  it('renders top-level menu items', () => {
    render(<Sidebar menuItems={items} currentPath="/" />);
    expect(
      screen.getByRole('button', { name: '대시보드' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /사용자 관리/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '감사로그' })
    ).toBeInTheDocument();
  });

  it('marks current path as aria-current', () => {
    render(<Sidebar menuItems={items} currentPath="/dashboard" />);
    expect(
      screen.getByRole('button', { name: '대시보드' })
    ).toHaveAttribute('aria-current', 'page');
  });

  it('auto-expands parent when child is active', () => {
    render(<Sidebar menuItems={items} currentPath="/users/roles" />);
    expect(screen.getByRole('button', { name: '목록' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '권한' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('toggles children on click', () => {
    render(<Sidebar menuItems={items} currentPath="/" />);
    const parent = screen.getByRole('button', { name: /사용자 관리/ });
    expect(parent).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(parent);
    expect(parent).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '목록' })).toBeInTheDocument();
  });

  it('calls onNavigate for leaf items', () => {
    const onNavigate = vi.fn();
    render(
      <Sidebar
        menuItems={items}
        currentPath="/"
        onNavigate={onNavigate}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '대시보드' }));
    expect(onNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('renders logo and footer slots', () => {
    render(
      <Sidebar
        menuItems={items}
        currentPath="/"
        logo={<div>LOGO</div>}
        footer={<div>FOOTER</div>}
      />
    );
    expect(screen.getByText('LOGO')).toBeInTheDocument();
    expect(screen.getByText('FOOTER')).toBeInTheDocument();
  });
});
