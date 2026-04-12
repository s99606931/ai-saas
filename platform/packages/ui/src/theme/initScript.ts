/**
 * DS-THEME-R1 — FOUC 방지 inline 스크립트
 * Design Ref: docs/02-design/mtus/DS-THEME-R1.design.md §결정 3
 * Plan SC: FR-DST.18
 *
 * React hydration 이전에 실행되어 html 클래스를 즉시 설정.
 * Next.js App Router <head>에서 dangerouslySetInnerHTML 로 삽입.
 */

import { DEFAULT_THEME, DEFAULT_MODE, type ThemeName, type ThemeMode } from '../tokens/themes/index.js';
import { STORAGE_KEYS } from './storage.js';

export interface InitScriptOptions {
  defaultTheme?: ThemeName;
  defaultMode?: ThemeMode;
}

/**
 * <script dangerouslySetInnerHTML={{ __html: getInitialThemeScript() }} />
 * 로 삽입하여 FOUC 방지.
 */
export function getInitialThemeScript(options: InitScriptOptions = {}): string {
  const defaultTheme = options.defaultTheme ?? DEFAULT_THEME;
  const defaultMode = options.defaultMode ?? DEFAULT_MODE;

  // 주의: 이 함수의 출력은 브라우저에서 eval 없이 실행되는 IIFE.
  // 모든 변수는 인라인 리터럴로 삽입.
  return `
(function(){
  try {
    var themeKey = ${JSON.stringify(STORAGE_KEYS.theme)};
    var modeKey = ${JSON.stringify(STORAGE_KEYS.mode)};
    var defaultTheme = ${JSON.stringify(defaultTheme)};
    var defaultMode = ${JSON.stringify(defaultMode)};
    var theme = localStorage.getItem(themeKey) || defaultTheme;
    var mode = localStorage.getItem(modeKey) || defaultMode;
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var resolved = mode === 'dark' || (mode === 'system' && prefersDark) ? 'dark' : 'light';
    var root = document.documentElement;
    Array.from(root.classList).forEach(function(c){ if (c.indexOf('theme-') === 0) root.classList.remove(c); });
    root.classList.add('theme-' + theme);
    if (resolved === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    root.style.colorScheme = resolved;
  } catch(e) { /* ignore */ }
})();
`.trim();
}
