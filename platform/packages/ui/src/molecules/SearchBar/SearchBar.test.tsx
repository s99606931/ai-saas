/**
 * DS-MOL-R2 — SearchBar 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from './index.js';

describe('SearchBar', () => {
  it('renders searchbox role and placeholder', () => {
    render(<SearchBar placeholder="이름으로 검색" />);
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('placeholder', '이름으로 검색');
  });

  it('applies custom aria-label', () => {
    render(<SearchBar aria-label="사용자 검색" />);
    expect(screen.getByLabelText('사용자 검색')).toBeInTheDocument();
  });

  it('fires onChange on input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchBar onChange={onChange} />);
    await user.type(screen.getByRole('searchbox'), 'abc');
    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith('abc');
  });

  it('debounces onSearch', async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} debounceMs={200} />);
    const input = screen.getByRole('searchbox');
    // fireEvent-style change via native
    act(() => {
      (input as HTMLInputElement).value = 'hello';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // 200ms 전: 호출 없음
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onSearch).not.toHaveBeenCalled();
    // 200ms 경과 후: 호출
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(onSearch).toHaveBeenCalledWith('hello');
    vi.useRealTimers();
  });

  it('shows clear button when value present and clears on click', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<SearchBar defaultValue="테스트" onClear={onClear} />);
    const clearBtn = screen.getByRole('button', { name: '검색어 지우기' });
    await user.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('clears on Escape key', async () => {
    const user = userEvent.setup();
    render(<SearchBar defaultValue="abc" />);
    const input = screen.getByRole('searchbox');
    input.focus();
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
  });

  it('renders recent searches on focus when empty', async () => {
    const user = userEvent.setup();
    render(
      <SearchBar recentSearches={['서울', '부산', '제주']} />
    );
    const input = screen.getByRole('searchbox');
    await user.click(input);
    expect(screen.getByRole('listbox', { name: '최근 검색' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '서울' })).toBeInTheDocument();
  });

  it('selecting recent updates value', async () => {
    const user = userEvent.setup();
    const onRecentSelect = vi.fn();
    render(
      <SearchBar
        recentSearches={['서울', '부산']}
        onRecentSelect={onRecentSelect}
      />
    );
    const input = screen.getByRole('searchbox');
    await user.click(input);
    await user.click(screen.getByRole('option', { name: '서울' }));
    expect(onRecentSelect).toHaveBeenCalledWith('서울');
    expect(input).toHaveValue('서울');
  });

  it('disables input and hides clear when disabled', () => {
    render(<SearchBar defaultValue="x" disabled />);
    expect(screen.getByRole('searchbox')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: '검색어 지우기' })
    ).not.toBeInTheDocument();
  });
});
