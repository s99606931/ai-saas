/**
 * DS-MOL-R2 — SearchBar 분자 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-MOL-R2.design.md §3
 * Plan SC: FR-DSM.13, FR-DSM.13.1, FR-DSM.13.2, FR-DSM.13.3
 *
 * 디바운스 검색 + 클리어 + 최근 검색 드롭다운.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../atoms/lib/cn.js';

export interface SearchBarProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** 디바운스 후 발화 */
  onSearch?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  debounceMs?: number;
  recentSearches?: string[];
  onRecentSelect?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function SearchBar({
  value: controlledValue,
  defaultValue = '',
  onChange,
  onSearch,
  onClear,
  placeholder = '검색...',
  debounceMs = 300,
  recentSearches,
  onRecentSelect,
  disabled,
  className,
  'aria-label': ariaLabel = '검색',
}: SearchBarProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = isControlled ? controlledValue : internalValue;
  const [focused, setFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const updateValue = (next: string) => {
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
    clearTimer();
    if (onSearch) {
      timerRef.current = setTimeout(() => {
        onSearch(next);
      }, debounceMs);
    }
  };

  const handleClear = () => {
    updateValue('');
    onClear?.();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && value) {
      e.preventDefault();
      handleClear();
    }
  };

  const selectRecent = (recent: string) => {
    updateValue(recent);
    onRecentSelect?.(recent);
    setFocused(false);
  };

  const showRecent =
    focused && recentSearches && recentSearches.length > 0 && !value;

  return (
    <div className={cn('relative w-full', className)}>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--color-on-surface-muted)]"
        >
          <Search size={16} />
        </span>
        <input
          id={inputId}
          type="search"
          role="searchbox"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-controls={showRecent ? listboxId : undefined}
          aria-expanded={showRecent || undefined}
          aria-autocomplete={recentSearches ? 'list' : undefined}
          onChange={(e) => updateValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // 클릭 이벤트 처리 후 닫히도록 약간의 지연
            setTimeout(() => setFocused(false), 150);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full h-[var(--input-height-md)]',
            'pl-10 pr-10',
            'bg-[var(--input-bg)]',
            'text-[var(--input-fg)]',
            'placeholder:text-[var(--input-placeholder)]',
            'border border-[var(--input-border)]',
            'rounded-[var(--input-radius)]',
            'transition-colors',
            'focus:outline-none',
            'focus:border-[var(--input-border-focus)]',
            'focus:shadow-[var(--input-shadow-focus)]',
            'disabled:bg-[var(--color-disabled-bg)]',
            'disabled:cursor-not-allowed'
          )}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="검색어 지우기"
            className={cn(
              'absolute inset-y-0 right-0 flex items-center pr-3',
              'text-[var(--color-on-surface-muted)]',
              'hover:text-[var(--color-on-surface)]',
              'focus-visible:outline-none',
              'focus-visible:text-[var(--color-primary)]'
            )}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {showRecent && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="최근 검색"
          className={cn(
            'absolute z-10 mt-1 w-full',
            'bg-[var(--color-surface)]',
            'border border-[var(--color-outline)]',
            'rounded-[var(--radius-md)]',
            'shadow-[var(--shadow-md)]',
            'py-1'
          )}
        >
          {recentSearches.map((recent) => (
            <li key={recent} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectRecent(recent)}
                className={cn(
                  'w-full text-left px-3 py-2',
                  'text-[length:var(--font-size-sm)]',
                  'text-[var(--color-on-surface)]',
                  'hover:bg-[var(--color-surface-alt)]',
                  'focus-visible:outline-none',
                  'focus-visible:bg-[var(--color-surface-alt)]'
                )}
              >
                {recent}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

SearchBar.displayName = 'SearchBar';
