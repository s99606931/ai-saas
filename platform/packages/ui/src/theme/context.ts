/**
 * DS-THEME-R1 — React Context 정의
 * Plan SC: FR-DST.13
 */

import { createContext } from 'react';
import type { ThemeName, ThemeMode, ThemePreset } from '../tokens/themes/index.js';

export interface ThemeContextValue {
  /** 현재 선택된 테마 */
  theme: ThemeName;
  /** 현재 모드 (light/dark/system) */
  mode: ThemeMode;
  /** system 모드일 때 해석된 실제 값 (light 또는 dark) */
  resolvedMode: 'light' | 'dark';
  /** 현재 테마 프리셋 메타데이터 */
  preset: ThemePreset;
  /** 테마 변경 */
  setTheme: (theme: ThemeName) => void;
  /** 모드 변경 */
  setMode: (mode: ThemeMode) => void;
  /** 다크/라이트 빠른 토글 (system → light → dark) */
  toggleMode: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
ThemeContext.displayName = 'ThemeContext';
