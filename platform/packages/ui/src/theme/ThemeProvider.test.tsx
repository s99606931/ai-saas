/**
 * DS-THEME-R1 — ThemeProvider 단위 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from './ThemeProvider.js';
import { useTheme } from './useTheme.js';
import { ThemeSwitcher, ModeToggle } from './ThemeSwitcher.js';
import { STORAGE_KEYS } from './storage.js';

function ThemeProbe() {
  const { theme, mode, resolvedMode, setTheme, setMode } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="mode">{mode}</span>
      <span data-testid="resolved">{resolvedMode}</span>
      <button onClick={() => setTheme('finance')}>금융</button>
      <button onClick={() => setMode('dark')}>다크</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
  });

  it('provides default theme and mode', () => {
    render(
      <ThemeProvider defaultTheme="government" defaultMode="light">
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('government');
    expect(screen.getByTestId('mode')).toHaveTextContent('light');
  });

  it('applies theme class to documentElement', () => {
    render(
      <ThemeProvider defaultTheme="finance" defaultMode="light">
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('theme-finance')).toBe(true);
  });

  it('applies dark class when mode=dark', () => {
    render(
      <ThemeProvider defaultTheme="default" defaultMode="dark">
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('switches theme on setTheme', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="default" defaultMode="light">
        <ThemeProbe />
      </ThemeProvider>
    );
    await user.click(screen.getByText('금융'));
    expect(screen.getByTestId('theme')).toHaveTextContent('finance');
    expect(document.documentElement.classList.contains('theme-finance')).toBe(true);
    expect(document.documentElement.classList.contains('theme-default')).toBe(false);
  });

  it('persists theme to localStorage', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="default" defaultMode="light">
        <ThemeProbe />
      </ThemeProvider>
    );
    await user.click(screen.getByText('금융'));
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe('finance');
  });

  it('reads theme from localStorage on init', () => {
    window.localStorage.setItem(STORAGE_KEYS.theme, 'healthcare');
    render(
      <ThemeProvider defaultTheme="default" defaultMode="light">
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('healthcare');
  });

  it('ignores invalid stored theme', () => {
    window.localStorage.setItem(STORAGE_KEYS.theme, 'nonexistent');
    render(
      <ThemeProvider defaultTheme="government" defaultMode="light">
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('government');
  });

  it('useTheme throws outside provider', () => {
    const originalError = console.error;
    console.error = () => undefined;
    expect(() => render(<ThemeProbe />)).toThrow(/ThemeProvider/);
    console.error = originalError;
  });

  it('ThemeSwitcher changes theme', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="default" defaultMode="light">
        <ThemeSwitcher />
        <ThemeProbe />
      </ThemeProvider>
    );
    const select = screen.getByLabelText('테마 선택') as HTMLSelectElement;
    await user.selectOptions(select, 'finance');
    expect(screen.getByTestId('theme')).toHaveTextContent('finance');
  });

  it('ModeToggle cycles modes', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="default" defaultMode="light">
        <ModeToggle />
        <ThemeProbe />
      </ThemeProvider>
    );
    // light → dark → system → light
    await user.click(screen.getByRole('button', { name: /변경/ }));
    // light 다음은 system → dark 순서? 우리 구현은 system → light → dark 순환
    // 초기 light → 다음 dark (light idx=1, next=2)
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
  });
});
