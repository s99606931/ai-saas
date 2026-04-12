/**
 * DS-TOKEN-R1 — 테마 메타데이터 (TypeScript)
 * Design Ref: docs/02-design/mtus/DS-TOKEN-R1.design.md
 * Plan SC: FR-DST.5~10
 *
 * 런타임 테마 전환을 위한 메타데이터.
 * CSS는 별도로 import (@import "@public-saas/ui/tokens").
 */

export type ThemeName =
  | 'default'
  | 'government'
  | 'finance'
  | 'healthcare'
  | 'high-contrast';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemePreset {
  /** 테마 식별자 (HTML 클래스로 사용) */
  readonly name: ThemeName;
  /** 한국어 표시명 */
  readonly label: string;
  /** 비즈니스 카테고리 */
  readonly category: 'public' | 'finance' | 'healthcare' | 'accessibility';
  /** 미리보기 색상 (브랜드 대표) */
  readonly previewColor: string;
  /** 접근성 등급 */
  readonly a11yLevel: 'AA' | 'AAA';
  /** 다크 모드 지원 여부 */
  readonly supportsDark: boolean;
  /** 짧은 설명 */
  readonly description: string;
}

export const THEME_PRESETS: Record<ThemeName, ThemePreset> = {
  'default': {
    name: 'default',
    label: '공공기관 기본',
    category: 'public',
    previewColor: '#2563eb',
    a11yLevel: 'AA',
    supportsDark: true,
    description: '공공기관 SaaS 표준 블루 테마',
  },
  'government': {
    name: 'government',
    label: '정부24 스타일',
    category: 'public',
    previewColor: '#4338ca',
    a11yLevel: 'AA',
    supportsDark: true,
    description: '정부24 호환 딥블루 + 옐로우 액센트',
  },
  'finance': {
    name: 'finance',
    label: '금융',
    category: 'finance',
    previewColor: '#15803d',
    a11yLevel: 'AA',
    supportsDark: true,
    description: '딥그린 + 골드 — 신뢰감 있는 금융 비즈니스',
  },
  'healthcare': {
    name: 'healthcare',
    label: '의료/헬스케어',
    category: 'healthcare',
    previewColor: '#06b6d4',
    a11yLevel: 'AA',
    supportsDark: true,
    description: '소프트블루 + 민트 — 친근한 의료 서비스',
  },
  'high-contrast': {
    name: 'high-contrast',
    label: '고대비 (WCAG AAA)',
    category: 'accessibility',
    previewColor: '#003e9c',
    a11yLevel: 'AAA',
    supportsDark: true,
    description: 'WCAG 2.2 AAA + KWCAG 2.2 최고 접근성',
  },
};

export const DEFAULT_THEME: ThemeName = 'default';
export const DEFAULT_MODE: ThemeMode = 'system';

/** HTML 루트 클래스명 생성 */
export function buildThemeClassName(theme: ThemeName, mode: ThemeMode, systemPrefersDark = false): string {
  const themeClass = `theme-${theme}`;
  const isDark = mode === 'dark' || (mode === 'system' && systemPrefersDark);
  return isDark ? `${themeClass} dark` : themeClass;
}
