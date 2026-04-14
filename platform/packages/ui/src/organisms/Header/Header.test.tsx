/**
 * DS-ORG-R1 — Header 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from './index.js';

describe('Header', () => {
  it('renders title in h1', () => {
    render(<Header title="관리자 대시보드" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '관리자 대시보드'
    );
  });

  it('renders breadcrumbs with links', () => {
    render(
      <Header
        title="상세"
        breadcrumbs={[
          { label: '홈', path: '/' },
          { label: '사용자' },
        ]}
      />
    );
    expect(screen.getByRole('link', { name: '홈' })).toBeInTheDocument();
    expect(screen.getByText('사용자')).toBeInTheDocument();
  });

  it('has banner role', () => {
    render(<Header title="X" />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('shows notification badge when count > 0', () => {
    render(<Header title="X" notifications={5} />);
    expect(screen.getByLabelText('알림 5개')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('caps notification count at 99+', () => {
    render(<Header title="X" notifications={123} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('hides notification when count is 0', () => {
    render(<Header title="X" notifications={0} />);
    expect(screen.queryByLabelText(/알림/)).not.toBeInTheDocument();
  });

  it('toggles user menu on click', () => {
    render(
      <Header
        title="X"
        user={{ name: '홍길동', email: 'hong@example.com' }}
      />
    );
    const btn = screen.getByLabelText('사용자 메뉴: 홍길동');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('hong@example.com')).toBeInTheDocument();
  });

  it('calls onLogout when logout clicked', () => {
    const onLogout = vi.fn();
    render(
      <Header
        title="X"
        user={{ name: '홍길동', email: 'x@x' }}
        onLogout={onLogout}
      />
    );
    fireEvent.click(screen.getByLabelText('사용자 메뉴: 홍길동'));
    fireEvent.click(screen.getByRole('menuitem', { name: /로그아웃/ }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('calls onMenuToggle when menu button clicked', () => {
    const onMenuToggle = vi.fn();
    render(<Header title="X" onMenuToggle={onMenuToggle} />);
    fireEvent.click(screen.getByLabelText('메뉴 열기'));
    expect(onMenuToggle).toHaveBeenCalledTimes(1);
  });
});
