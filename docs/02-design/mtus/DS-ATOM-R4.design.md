# DS-ATOM-R4 — Design (Typography)

> **Plan**: `docs/01-plan/mtus/DS-ATOM-R4.plan.md`
> 작성: 2026-04-14

## Executive Summary

| 관점 | 결정 |
|------|-----|
| 기술 | 얇은 컴포넌트 래퍼 (기존 토큰 재사용) |
| 재사용 | `--font-size-*`, `--font-weight-*`, `--line-height-*`, `--font-sans`, `--font-mono` |
| 접근성 | 의미론적 태그 유지 + aria-level 자동 |

## Design Anchor

- **옵션**: 1) 각 레벨별 개별 파일 2) 단일 Heading + 단일 Text 3) 추상 Typography 컴포넌트
- **선택**: **옵션 2 (Pragmatic Balance)** — Heading + Text + Code 3개 파일로 최소화
- **근거**: 각 레벨 파일은 보일러플레이트 과다. 단일 컴포넌트 + variant로 표현 가능

## 1. Heading 컴포넌트

```typescript
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingWeight = 'regular' | 'medium' | 'semibold' | 'bold';

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level: HeadingLevel;
  as?: HeadingLevel;          // 실제 렌더 태그 (semantic vs visual 분리)
  weight?: HeadingWeight;
  truncate?: boolean;
}
```

- 실제 태그: `as ?? level`
- 원래 level은 `aria-level` 로 보존 (as로 다운그레이드된 경우에도 스크린리더 의미 유지)
- 레벨별 size 매핑:
  - 1: `--font-size-5xl`
  - 2: `--font-size-4xl`
  - 3: `--font-size-3xl`
  - 4: `--font-size-2xl`
  - 5: `--font-size-xl`
  - 6: `--font-size-lg`
- line-height: tight
- font-family: `--font-sans` (Pretendard)
- default weight: bold (1~3), semibold (4~6)

## 2. Text 컴포넌트

```typescript
type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl';
type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';
type TextVariant = 'body' | 'caption' | 'label' | 'muted' | 'error';

interface TextProps extends HTMLAttributes<HTMLElement> {
  size?: TextSize;
  weight?: TextWeight;
  variant?: TextVariant;
  as?: 'p' | 'span' | 'div' | 'strong' | 'em' | 'small';
  truncate?: boolean;
}
```

- `as` 기본: `p`
- variant별 색상:
  - body: `--color-on-surface`
  - caption: `--color-on-surface-muted`
  - label: `--color-on-surface` (medium weight 기본)
  - muted: `--color-on-surface-muted`
  - error: `--color-error`
- size 기본: `base`
- line-height: normal

## 3. Code 컴포넌트

```typescript
interface CodeProps extends HTMLAttributes<HTMLElement> {
  block?: boolean;      // true → <pre><code>, false → <code>
  size?: 'xs' | 'sm' | 'base';
}
```

- font-family: `--font-mono`
- inline: `<code>` with subtle background
- block: `<pre><code>` with surface background + padding + overflow-x auto
- 색상: `--color-on-surface-alt` + bg `--color-surface-alt`

## 토큰 매핑

- `--font-sans` (Pretendard), `--font-mono`
- `--font-size-xs`~`5xl` (이미 fluid)
- `--font-weight-regular/medium/semibold/bold`
- `--line-height-tight/normal`
- `--color-on-surface`, `--color-on-surface-muted`, `--color-error`, `--color-surface-alt`

## 구현 순서

1. Heading + test
2. Text + test
3. Code + test
4. atoms/index.ts + src/index.ts export

## 변경 이력

| 버전 | 일자 | 내용 |
|-----|-----|-----|
| 1.0.0 | 2026-04-14 | 초안 |
