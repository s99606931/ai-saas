/**
 * DS-MOL-R2 — SearchBar 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

  it('fires onChange on input', () => {
    const onChange = vi.fn();
    render(<SearchBar onChange={onChange} />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('debounces onSearch', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} debounceMs={50} />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(onSearch).not.toHaveBeenCalled();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(onSearch).toHaveBeenCalledWith('hello');
  });

  it('shows clear button when value present and clears on click', () => {
    const onClear = vi.fn();
    render(<SearchBar defaultValue="테스트" onClear={onClear} />);
    const clearBtn = screen.getByRole('button', { name: '검색어 지우기' });
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('clears on Escape key', () => {
    render(<SearchBar defaultValue="abc" />);
    const input = screen.getByRole('searchbox');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
  });

  it('renders recent searches on focus when empty', () => {
    render(<SearchBar recentSearches={['서울', '부산', '제주']} />);
    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);
    expect(
      screen.getByRole('listbox', { name: '최근 검색' })
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '서울' })).toBeInTheDocument();
  });

  it('selecting recent updates value', () => {
    const onRecentSelect = vi.fn();
    render(
      <SearchBar
        recentSearches={['서울', '부산']}
        onRecentSelect={onRecentSelect}
      />
    );
    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);
    // 실제 클릭 핸들러는 내부 <button>에 있음
    fireEvent.click(screen.getByRole('button', { name: '서울' }));
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
