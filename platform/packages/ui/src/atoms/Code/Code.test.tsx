/**
 * DS-ATOM-R4 — Code 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Code } from './index.js';

describe('Code', () => {
  it('renders inline <code> by default', () => {
    const { container } = render(<Code>const x = 1</Code>);
    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe('CODE');
    expect(el).toHaveTextContent('const x = 1');
  });

  it('renders <pre><code> when block=true', () => {
    const { container } = render(<Code block>line1\nline2</Code>);
    const pre = container.firstChild as HTMLElement;
    expect(pre.tagName).toBe('PRE');
    const code = pre.firstChild as HTMLElement;
    expect(code.tagName).toBe('CODE');
  });

  it('applies mono font via token', () => {
    const { container } = render(<Code>x</Code>);
    expect((container.firstChild as HTMLElement).className).toContain(
      '--font-mono'
    );
  });

  it('applies size variant', () => {
    const { container } = render(<Code size="base">x</Code>);
    expect((container.firstChild as HTMLElement).className).toContain(
      '--font-size-base'
    );
  });

  it('block mode has overflow scroll', () => {
    const { container } = render(<Code block>x</Code>);
    expect((container.firstChild as HTMLElement).className).toContain(
      'overflow-x-auto'
    );
  });

  it('applies custom className', () => {
    const { container } = render(<Code className="foo">x</Code>);
    expect((container.firstChild as HTMLElement).className).toContain('foo');
  });
});
