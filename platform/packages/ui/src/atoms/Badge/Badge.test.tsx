/**
 * DS-ATOM-R1 — Badge 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './index.js';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>활성</Badge>);
    expect(screen.getByText('활성')).toBeInTheDocument();
  });

  it('renders all variants without crashing', () => {
    const variants = ['default', 'primary', 'success', 'warning', 'error', 'info'] as const;
    variants.forEach((v) => {
      const { unmount } = render(<Badge variant={v}>{v}</Badge>);
      expect(screen.getByText(v)).toBeInTheDocument();
      unmount();
    });
  });

  it('shows dot indicator when dot prop is true', () => {
    const { container } = render(<Badge dot>알림</Badge>);
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
  });

  it('does not show dot when dot prop is false', () => {
    const { container } = render(<Badge>알림</Badge>);
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).not.toBeInTheDocument();
  });

  it('forwards ref to span element', () => {
    let ref: HTMLSpanElement | null = null;
    render(
      <Badge
        ref={(el) => {
          ref = el;
        }}
      >
        ref
      </Badge>
    );
    expect(ref).toBeInstanceOf(HTMLSpanElement);
  });

  it('applies custom className', () => {
    render(<Badge className="custom-badge">테스트</Badge>);
    expect(screen.getByText('테스트').className).toContain('custom-badge');
  });
});
