/**
 * DS-THEME-R1 — useTheme 훅
 * Design Ref: docs/02-design/mtus/DS-THEME-R1.design.md
 * Plan SC: FR-DST.14
 */

import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from './context.js';

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error(
      'useTheme must be used within a <ThemeProvider>. 앱 루트를 ThemeProvider로 감싸주세요.'
    );
  }
  return ctx;
}
