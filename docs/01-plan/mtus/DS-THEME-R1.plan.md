# DS-THEME-R1 Plan — ThemeProvider + useTheme 훅

> 의존: DS-TOKEN-R1 (완료)
> 작성일: 2026-04-13

## Executive Summary

| 관점 | 항목 | 목표 |
|------|------|------|
| 비즈니스 | 테마 전환 UI | 1줄 설정 변경으로 전체 스타일 전환 |
| 사용자 | 접근성 | prefers-color-scheme/reduced-motion 존중 |
| 기술 | React Context | Provider/Hook 패턴 |
| 운영 | 영속성 | localStorage 저장 + SSR 안전 |

## Context Anchor

- **WHY**: CSS 토큰은 완성됐지만 React 앱에서 어떻게 `.theme-finance` 클래스를 바꿀지 인터페이스 없음. 사용자 지시의 핵심 — "간단한 설정으로 전체 전환" 실현.
- **WHO**: 앱 레벨 개발자, 관리자(테마 선택 UI)
- **RISK**: SSR 하이드레이션 mismatch. localStorage 미지원 환경. 플래시(FOUC).
- **SUCCESS**:
  - SC-1: ThemeProvider — theme + mode(light/dark/system) 상태 관리
  - SC-2: useTheme() 훅 — 현재 값 + setter
  - SC-3: localStorage 영속성 (SSR 안전)
  - SC-4: 시스템 prefers-color-scheme 자동 감지
  - SC-5: ThemeSwitcher 선택 컴포넌트 (메타데이터 기반 드롭다운)
  - SC-6: FOUC 방지 inline 스크립트

## 요구사항

| FR | 요구사항 |
|----|--------|
| FR-DST.13 | ThemeProvider: theme + mode + setTheme + setMode 컨텍스트 |
| FR-DST.14 | useTheme 훅 — 컨텍스트 밖 사용 시 에러 throw |
| FR-DST.15 | localStorage 키 `public-saas-theme`, `public-saas-mode` |
| FR-DST.16 | system mode — matchMedia('(prefers-color-scheme: dark)') 구독 |
| FR-DST.17 | ThemeSwitcher — THEME_PRESETS 기반 선택 UI |
| FR-DST.18 | getInitialThemeScript — FOUC 방지용 inline 스크립트 |

## 추적성

| FR | 산출물 |
|----|-------|
| FR-DST.13~14 | theme/ThemeProvider.tsx, theme/useTheme.ts |
| FR-DST.15~16 | theme/storage.ts, theme/system.ts |
| FR-DST.17 | theme/ThemeSwitcher.tsx |
| FR-DST.18 | theme/initScript.ts |
