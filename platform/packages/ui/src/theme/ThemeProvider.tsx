/**
 * DS-THEME-R1 — ThemeProvider 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-THEME-R1.design.md §아키텍처
 * Plan SC: FR-DST.13
 *
 * 앱 루트에서 한 번 감싸면 전체 앱에 테마 적용.
 * 간단한 설정 변경으로 전체 UI/UX 전환 — 사용자 지시 핵심 충족.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  THEME_PRESETS,
  DEFAULT_THEME,
  DEFAULT_MODE,
  type ThemeName,
  type ThemeMode,
} from '../tokens/themes/index.js';
import { ThemeContext, type ThemeContextValue } from './context.js';
import {
  readStoredTheme,
  readStoredMode,
  writeStoredTheme,
  writeStoredMode,
  isBrowser,
} from './storage.js';
import { getSystemPrefersDark, subscribeSystemTheme } from './system.js';

export interface ThemeProviderProps {
  children: ReactNode;
  /** 초기 테마 (localStorage 값이 없을 때) */
  defaultTheme?: ThemeName;
  /** 초기 모드 */
  defaultMode?: ThemeMode;
  /** localStorage 사용 여부 */
  enableStorage?: boolean;
  /** 시스템 색상 선호도 감지 여부 */
  enableSystem?: boolean;
}

/**
 * HTML 루트 요소에 테마 클래스 적용
 */
function applyThemeToDocument(theme: ThemeName, resolvedMode: 'light' | 'dark'): void {
  if (!isBrowser()) return;
  const root = document.documentElement;

  // 기존 theme-* 클래스 제거
  const classesToRemove: string[] = [];
  root.classList.forEach((cls) => {
    if (cls.startsWith('theme-')) classesToRemove.push(cls);
  });
  classesToRemove.forEach((cls) => root.classList.remove(cls));

  // 새 테마 클래스 추가
  root.classList.add(`theme-${theme}`);

  // 다크 모드 클래스
  if (resolvedMode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // color-scheme (네이티브 스크롤바 등)
  root.style.colorScheme = resolvedMode;
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  defaultMode = DEFAULT_MODE,
  enableStorage = true,
  enableSystem = true,
}: ThemeProviderProps) {
  // 초기 상태 (SSR 안전: 클라이언트에서만 localStorage 읽기)
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (!enableStorage) return defaultTheme;
    const stored = readStoredTheme();
    return stored && THEME_PRESETS[stored] ? stored : defaultTheme;
  });

  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (!enableStorage) return defaultMode;
    const stored = readStoredMode();
    return stored ?? defaultMode;
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(false);

  // 시스템 색상 선호도 구독
  useEffect(() => {
    if (!enableSystem) return;
    setSystemPrefersDark(getSystemPrefersDark());
    const unsubscribe = subscribeSystemTheme(setSystemPrefersDark);
    return unsubscribe;
  }, [enableSystem]);

  // resolvedMode 계산
  const resolvedMode: 'light' | 'dark' = useMemo(() => {
    if (mode === 'dark') return 'dark';
    if (mode === 'light') return 'light';
    return systemPrefersDark ? 'dark' : 'light';
  }, [mode, systemPrefersDark]);

  // DOM 반영
  useEffect(() => {
    applyThemeToDocument(theme, resolvedMode);
  }, [theme, resolvedMode]);

  // 변경 핸들러
  const setTheme = useCallback(
    (next: ThemeName) => {
      if (!THEME_PRESETS[next]) return;
      setThemeState(next);
      if (enableStorage) writeStoredTheme(next);
    },
    [enableStorage]
  );

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      if (enableStorage) writeStoredMode(next);
    },
    [enableStorage]
  );

  const toggleMode = useCallback(() => {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    const currentIdx = order.indexOf(mode);
    const nextIdx = (currentIdx + 1) % order.length;
    setMode(order[nextIdx]);
  }, [mode, setMode]);

  const value: ThemeContextValue = useMemo(
    () => ({
      theme,
      mode,
      resolvedMode,
      preset: THEME_PRESETS[theme],
      setTheme,
      setMode,
      toggleMode,
    }),
    [theme, mode, resolvedMode, setTheme, setMode, toggleMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
