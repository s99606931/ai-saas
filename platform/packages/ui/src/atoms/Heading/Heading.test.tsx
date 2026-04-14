/**
 * DS-ATOM-R4 — Heading 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Heading } from './index.js';

describe('Heading', () => {
  it('renders h1 for level 1', () => {
    render(<Heading level={1}>타이틀</Heading>);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.tagName).toBe('H1');
    expect(h1).toHaveTextContent('타이틀');
  });

  it('renders all levels 1-6', () => {
    const levels = [1, 2, 3, 4, 5, 6] as const;
    levels.forEach((l) => {
      const { unmount } = render(<Heading level={l}>제목 {l}</Heading>);
      const h = screen.getByRole('heading', { level: l });
      expect(h.tagName).toBe(`H${l}`);
      unmount();
    });
  });

  it('respects as override but keeps semantic aria-level', () => {
    render(
      <Heading level={1} as={3}>
        섹션
      </Heading>
    );
    // as=3 → h3 태그, level=1 → aria-level=1
    const h = screen.getByText('섹션');
    expect(h.tagName).toBe('H3');
    expect(h).toHaveAttribute('aria-level', '1');
  });

  it('does not set aria-level when as matches level', () => {
    render(<Heading level={2}>맞음</Heading>);
    const h = screen.getByRole('heading', { level: 2 });
    expect(h).not.toHaveAttribute('aria-level');
  });

  it('applies truncate class', () => {
    render(
      <Heading level={1} truncate>
        긴 제목
      </Heading>
    );
    expect(screen.getByRole('heading').className).toContain('truncate');
  });

  it('forwards ref', () => {
    let ref: HTMLHeadingElement | null = null;
    render(
      <Heading
        level={2}
        ref={(el) => {
          ref = el;
        }}
      >
        ref
      </Heading>
    );
    expect(ref).toBeInstanceOf(HTMLHeadingElement);
  });

  it('applies custom className', () => {
    render(
      <Heading level={1} className="custom-title">
        맞춤
      </Heading>
    );
    expect(screen.getByRole('heading').className).toContain('custom-title');
  });
});
