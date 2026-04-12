/**
 * DS-THEME-R1 — ThemeSwitcher UI 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-THEME-R1.design.md
 * Plan SC: FR-DST.17
 *
 * THEME_PRESETS 기반 드롭다운. 앱 설정 페이지/헤더에 삽입.
 */

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { THEME_PRESETS, type ThemeName } from '../tokens/themes/index.js';
import { cn } from '../atoms/lib/cn.js';
import { useTheme } from './useTheme.js';

export interface ThemeSwitcherProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  /** 라벨 숨김 (aria-label만 사용) */
  hideLabel?: boolean;
  /** 커스텀 라벨 */
  label?: string;
}

export const ThemeSwitcher = forwardRef<HTMLSelectElement, ThemeSwitcherProps>(
  ({ className, hideLabel = false, label = '테마 선택', ...props }, ref) => {
    const { theme, setTheme } = useTheme();
    const presets = Object.values(THEME_PRESETS);

    return (
      <label
        className={cn(
          'inline-flex items-center gap-2',
          'text-[length:var(--font-size-sm)]',
          'text-[var(--color-on-surface)]'
        )}
      >
        {!hideLabel && <span>{label}</span>}
        <select
          ref={ref}
          aria-label={label}
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemeName)}
          className={cn(
            'h-[var(--input-height-sm)]',
            'px-[var(--space-2)]',
            'bg-[var(--input-bg)]',
            'text-[var(--input-fg)]',
            'border border-[var(--input-border)]',
            'rounded-[var(--input-radius)]',
            'focus:outline-none',
            'focus:border-[var(--input-border-focus)]',
            'focus:shadow-[var(--input-shadow-focus)]',
            className
          )}
          {...props}
        >
          {presets.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.label}
              {preset.a11yLevel === 'AAA' ? ' (접근성 AAA)' : ''}
            </option>
          ))}
        </select>
      </label>
    );
  }
);

ThemeSwitcher.displayName = 'ThemeSwitcher';

/**
 * 간단한 라이트/다크 토글 버튼
 */
export interface ModeToggleProps {
  className?: string;
}

export function ModeToggle({ className }: ModeToggleProps) {
  const { mode, resolvedMode, toggleMode } = useTheme();
  const labels: Record<string, string> = {
    light: '라이트',
    dark: '다크',
    system: '시스템',
  };

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={`화면 모드 변경 (현재: ${labels[mode]})`}
      className={cn(
        'inline-flex items-center justify-center',
        'h-[var(--button-height-md)]',
        'px-[var(--button-padding-x-md)]',
        'rounded-[var(--button-radius)]',
        'bg-[var(--button-ghost-bg)]',
        'text-[var(--button-ghost-fg)]',
        'hover:bg-[var(--button-ghost-bg-hover)]',
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-[var(--color-focus-ring)]',
        'focus-visible:ring-offset-2',
        'transition-colors duration-[var(--motion-duration-fast)]',
        className
      )}
    >
      {resolvedMode === 'dark' ? '🌙' : '☀️'}
      <span className="ml-2">{labels[mode]}</span>
    </button>
  );
}
