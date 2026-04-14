/**
 * DS-ATOM-R4 — Text 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Text } from './index.js';

describe('Text', () => {
  it('renders as p by default', () => {
    const { container } = render(<Text>본문</Text>);
    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe('P');
    expect(el).toHaveTextContent('본문');
  });

  it('renders as span when as=span', () => {
    const { container } = render(<Text as="span">인라인</Text>);
    expect((container.firstChild as HTMLElement).tagName).toBe('SPAN');
  });

  it('applies body variant by default', () => {
    const { container } = render(<Text>기본</Text>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('--color-on-surface');
  });

  it('caption variant has muted color and xs size', () => {
    const { container } = render(<Text variant="caption">설명</Text>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('--color-on-surface-muted');
    expect(el.className).toContain('--font-size-xs');
  });

  it('label variant defaults to medium weight', () => {
    const { container } = render(<Text variant="label">라벨</Text>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('--font-weight-medium');
  });

  it('error variant applies error color', () => {
    const { container } = render(<Text variant="error">오류</Text>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('--color-error');
  });

  it('explicit size overrides variant default', () => {
    const { container } = render(
      <Text variant="caption" size="xl">
        큰 캡션
      </Text>
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('--font-size-xl');
  });

  it('applies truncate class', () => {
    const { container } = render(<Text truncate>긴 텍스트</Text>);
    expect((container.firstChild as HTMLElement).className).toContain(
      'truncate'
    );
  });
});
