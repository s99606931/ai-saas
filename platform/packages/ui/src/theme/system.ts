/**
 * DS-THEME-R1 — 시스템 prefers-color-scheme 감지
 * Design Ref: docs/02-design/mtus/DS-THEME-R1.design.md §결정 2
 * Plan SC: FR-DST.16
 */

import { isBrowser } from './storage.js';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * 현재 시스템이 다크 모드를 선호하는지
 */
export function getSystemPrefersDark(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.matchMedia(MEDIA_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * prefers-color-scheme 변화 구독
 * @returns unsubscribe 함수
 */
export function subscribeSystemTheme(callback: (prefersDark: boolean) => void): () => void {
  if (!isBrowser()) return () => undefined;

  let mql: MediaQueryList;
  try {
    mql = window.matchMedia(MEDIA_QUERY);
  } catch {
    return () => undefined;
  }

  const handler = (event: MediaQueryListEvent) => {
    callback(event.matches);
  };

  // 최신 API 우선, 레거시 폴백
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  } else {
    // 구형 Safari
    const legacyMql = mql as MediaQueryList & {
      addListener: (cb: (e: MediaQueryListEvent) => void) => void;
      removeListener: (cb: (e: MediaQueryListEvent) => void) => void;
    };
    legacyMql.addListener(handler);
    return () => legacyMql.removeListener(handler);
  }
}
