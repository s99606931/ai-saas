/**
 * DS-ATOM-R1 — Button 단위 테스트
 * Plan SC: NFR-DSA.4 (커버리지 80%+)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './index.js';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
  });

  it('applies primary variant by default', () => {
    render(<Button>버튼</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('button-primary-bg');
  });

  it('renders all variants without crashing', () => {
    const variants = ['primary', 'secondary', 'ghost', 'danger', 'link'] as const;
    variants.forEach((v) => {
      const { unmount } = render(<Button variant={v}>{v}</Button>);
      expect(screen.getByRole('button', { name: v })).toBeInTheDocument();
      unmount();
    });
  });

  it('renders all sizes without crashing', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    sizes.forEach((s) => {
      const { unmount } = render(<Button size={s}>{s}</Button>);
      expect(screen.getByRole('button', { name: s })).toBeInTheDocument();
      unmount();
    });
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={handleClick}>클릭</Button>);
    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disables button when disabled prop is set', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button disabled onClick={handleClick}>
        비활성
      </Button>
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    await user.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('shows spinner and sets aria-busy when loading', () => {
    render(<Button loading>저장 중</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('supports keyboard activation (Enter)', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={handleClick}>키보드</Button>);
    const btn = screen.getByRole('button');
    btn.focus();
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard activation (Space)', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={handleClick}>키보드</Button>);
    const btn = screen.getByRole('button');
    btn.focus();
    await user.keyboard(' ');
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders leading and trailing icons', () => {
    render(
      <Button
        leadingIcon={<span data-testid="lead">L</span>}
        trailingIcon={<span data-testid="trail">T</span>}
      >
        아이콘
      </Button>
    );
    expect(screen.getByTestId('lead')).toBeInTheDocument();
    expect(screen.getByTestId('trail')).toBeInTheDocument();
  });

  it('hides trailing icon when loading', () => {
    render(
      <Button loading trailingIcon={<span data-testid="trail">T</span>}>
        로딩
      </Button>
    );
    expect(screen.queryByTestId('trail')).not.toBeInTheDocument();
  });

  it('forwards ref to button element', () => {
    let ref: HTMLButtonElement | null = null;
    render(
      <Button
        ref={(el) => {
          ref = el;
        }}
      >
        ref
      </Button>
    );
    expect(ref).toBeInstanceOf(HTMLButtonElement);
  });

  it('applies custom className with cn merge', () => {
    render(<Button className="custom-class">병합</Button>);
    expect(screen.getByRole('button').className).toContain('custom-class');
  });

  it('renders as child element with asChild', () => {
    render(
      <Button asChild>
        <a href="/home">홈</a>
      </Button>
    );
    const link = screen.getByRole('link', { name: '홈' });
    expect(link).toHaveAttribute('href', '/home');
  });
});
