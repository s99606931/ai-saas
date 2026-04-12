# DS-TOKEN-R1 Plan — 디자인 토큰 시스템 (W3C 3계층)

> 작성일: 2026-04-11 | 작성자: PM Lead
> 상위: 공공기관 SaaS 디자인시스템 무한 개선 루프

## Executive Summary (4관점)

| 관점 | 항목 | 목표 | 비고 |
|------|------|------|------|
| 비즈니스 | 비즈니스별 테마 전환 | 6개 프리셋 | government/finance/healthcare/dark/high-contrast/default |
| 사용자 | 접근성 | WCAG 2.2 AA + KWCAG 2.2 | 색상 대비 4.5:1 이상 |
| 기술 | 토큰 계층 | W3C 3-tier | base → semantic → component |
| 운영 | 테마 전환 비용 | CSS 클래스 1개 | `.theme-{name}` |

## Context Anchor

- **WHY**: 35개 MTU 전체에서 일관된 시각적 정체성 + 비즈니스별 빠른 테마 전환이 필요. 현재는 평면 변수 12개만 존재해 확장 불가.
- **WHO**: 공공기관 운영자(메인), 협력사 입주 기업(테넌트), 시민 사용자(End-user)
- **RISK**: 토큰 계층 잘못 설계 시 추후 컴포넌트 100개 모두 재작성. 접근성 미준수 시 KWCAG 감리 결함.
- **SUCCESS**:
  - SC-1: 3계층(base/semantic/component) CSS 파일 분리 완료
  - SC-2: 6개 테마 프리셋 작동 (CSS 클래스 전환)
  - SC-3: 모든 시맨틱 색상이 WCAG AA 4.5:1 이상 충족
  - SC-4: Tailwind v4 `@theme` 블록과 연동
- **SCOPE**:
  - In: tokens/base.css, tokens/semantic.css, tokens/component.css, tokens/themes/{6}.css, ui 패키지 export
  - Out: 컴포넌트 구현 (DS-ATOM-R1에서), Storybook (이후 이터레이션)

## 요구사항 (FR)

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-DST.1 | base.css에 원시 색상 팔레트 정의 (50~950 11단계) | P0 |
| FR-DST.2 | base.css에 spacing/radius/font-size/shadow/motion 스케일 정의 | P0 |
| FR-DST.3 | semantic.css에 의미론적 역할 토큰 정의 (surface/on-surface/primary 등) | P0 |
| FR-DST.4 | component.css에 컴포넌트별 토큰 정의 (button/input/card) | P0 |
| FR-DST.5 | themes/default.css — 공공기관 기본 테마 | P0 |
| FR-DST.6 | themes/dark.css — 다크 모드 | P0 |
| FR-DST.7 | themes/government.css — 정부24 딥블루 | P0 |
| FR-DST.8 | themes/finance.css — 딥그린+골드 | P0 |
| FR-DST.9 | themes/healthcare.css — 소프트블루+민트 | P0 |
| FR-DST.10 | themes/high-contrast.css — WCAG AAA 고대비 | P0 |
| FR-DST.11 | ui 패키지 index.ts에서 토큰 CSS 통합 export | P0 |
| FR-DST.12 | portal globals.css가 새 토큰 시스템 사용 | P1 |

| NFR ID | 비기능 요구사항 |
|--------|---------------|
| NFR-DST.1 | 모든 시맨틱 색상 WCAG AA 대비 4.5:1 이상 |
| NFR-DST.2 | 토큰 파일 합계 50KB 이하 (gzip 후 10KB 이하) |
| NFR-DST.3 | `prefers-reduced-motion` 자동 처리 (motion 토큰) |
| NFR-DST.4 | `prefers-color-scheme: dark` 자동 처리 |

## 추적성 매트릭스

| FR | 산출물 | 검증 |
|----|--------|------|
| FR-DST.1~2 | tokens/base.css | 토큰 카운트 ≥ 80 |
| FR-DST.3 | tokens/semantic.css | 시맨틱 역할 ≥ 30 |
| FR-DST.4 | tokens/component.css | 컴포넌트 토큰 ≥ 20 |
| FR-DST.5~10 | themes/*.css | 6개 파일 |
| FR-DST.11 | packages/ui/src/index.ts | export 추가 |

## 변경 이력
- 2026-04-11 v1.0 PM Lead 최초 작성
