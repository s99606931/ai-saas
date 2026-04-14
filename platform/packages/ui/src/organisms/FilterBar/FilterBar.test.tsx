/**
 * DS-ORG-R2 — FilterBar 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from './index.js';

describe('FilterBar', () => {
  it('renders children inside section with aria-label', () => {
    render(
      <FilterBar>
        <input aria-label="검색" />
      </FilterBar>
    );
    expect(screen.getByRole('region', { name: '필터' })).toBeInTheDocument();
    expect(screen.getByLabelText('검색')).toBeInTheDocument();
  });

  it('uses custom aria-label', () => {
    render(
      <FilterBar aria-label="고급 필터">
        <div />
      </FilterBar>
    );
    expect(
      screen.getByRole('region', { name: '고급 필터' })
    ).toBeInTheDocument();
  });

  it('calls onReset when reset button clicked', () => {
    const onReset = vi.fn();
    render(
      <FilterBar onReset={onReset}>
        <div />
      </FilterBar>
    );
    fireEvent.click(screen.getByRole('button', { name: /초기화/ }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('uses custom resetLabel', () => {
    render(
      <FilterBar onReset={() => {}} resetLabel="리셋">
        <div />
      </FilterBar>
    );
    expect(screen.getByRole('button', { name: /리셋/ })).toBeInTheDocument();
  });

  it('marks data-active when hasActiveFilters', () => {
    const { container } = render(
      <FilterBar hasActiveFilters>
        <div />
      </FilterBar>
    );
    expect(container.querySelector('section')).toHaveAttribute(
      'data-active',
      'true'
    );
  });

  it('omits reset button when onReset not provided', () => {
    render(
      <FilterBar>
        <div />
      </FilterBar>
    );
    expect(
      screen.queryByRole('button', { name: /초기화/ })
    ).not.toBeInTheDocument();
  });
});
