/**
 * DS-THEME-R1 — localStorage 안전 wrapper
 * Design Ref: docs/02-design/mtus/DS-THEME-R1.design.md §SSR 안전
 * Plan SC: FR-DST.15
 */

import type { ThemeName, ThemeMode } from '../tokens/themes/index.js';

export const STORAGE_KEYS = {
  theme: 'public-saas-theme',
  mode: 'public-saas-mode',
} as const;

/**
 * 브라우저 환경 감지 (SSR 안전)
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * localStorage 에서 테마 읽기 (SSR 안전, 에러 허용)
 */
export function readStoredTheme(): ThemeName | null {
  if (!isBrowser()) return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEYS.theme);
    return value as ThemeName | null;
  } catch {
    return null;
  }
}

export function readStoredMode(): ThemeMode | null {
  if (!isBrowser()) return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEYS.mode);
    return value as ThemeMode | null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(theme: ThemeName): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.theme, theme);
  } catch {
    /* 프라이빗 모드 등에서 실패 허용 */
  }
}

export function writeStoredMode(mode: ThemeMode): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.mode, mode);
  } catch {
    /* 허용 */
  }
}
