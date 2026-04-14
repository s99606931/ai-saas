/**
 * DS-ORG-R2 — EmptyState 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from './index.js';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState title="데이터가 없습니다" description="조건을 변경하여 다시 시도하세요" />
    );
    expect(
      screen.getByRole('heading', { name: '데이터가 없습니다' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('조건을 변경하여 다시 시도하세요')
    ).toBeInTheDocument();
  });

  it('uses role=status for default variant', () => {
    render(<EmptyState title="없음" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('uses role=alert for error variant', () => {
    render(<EmptyState variant="error" title="오류" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('uses role=alert for forbidden variant', () => {
    render(<EmptyState variant="forbidden" title="권한 없음" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('marks variant via data attribute', () => {
    render(<EmptyState variant="search" title="검색 결과 없음" />);
    expect(screen.getByRole('status')).toHaveAttribute(
      'data-variant',
      'search'
    );
  });

  it('renders action slot', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="X"
        action={
          <button type="button" onClick={onClick}>
            새로 만들기
          </button>
        }
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '새로 만들기' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders custom icon', () => {
    render(
      <EmptyState
        title="X"
        icon={<span data-testid="custom-icon">⭐</span>}
      />
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
