/**
 * DS-ATOM-R3 — Tooltip 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from './index.js';

describe('Tooltip', () => {
  it('is hidden by default', () => {
    render(
      <Tooltip content="도움말" delay={0}>
        <button>버튼</button>
      </Tooltip>
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows on hover after delay', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="도움말" delay={0}>
        <button>버튼</button>
      </Tooltip>
    );
    await user.hover(screen.getByRole('button'));
    // delay=0 이지만 setTimeout 은 매크로태스크 → act 필요
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('도움말');
  });

  it('hides on mouse leave', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="도움말" delay={0}>
        <button>버튼</button>
      </Tooltip>
    );
    const btn = screen.getByRole('button');
    await user.hover(btn);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    await user.unhover(btn);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows on focus', async () => {
    render(
      <Tooltip content="포커스 도움말" delay={0}>
        <button>버튼</button>
      </Tooltip>
    );
    const btn = screen.getByRole('button');
    act(() => {
      btn.focus();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('포커스 도움말');
  });

  it('hides on Escape key', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="ESC 테스트" delay={0}>
        <button>버튼</button>
      </Tooltip>
    );
    const btn = screen.getByRole('button');
    act(() => {
      btn.focus();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('does not show when disabled', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="숨김" delay={0} disabled>
        <button>버튼</button>
      </Tooltip>
    );
    await user.hover(screen.getByRole('button'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('applies side attribute', async () => {
    render(
      <Tooltip content="위치" delay={0} side="right">
        <button>버튼</button>
      </Tooltip>
    );
    act(() => {
      screen.getByRole('button').focus();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-side', 'right');
  });

  it('connects aria-describedby when open', async () => {
    render(
      <Tooltip content="aria 설명" delay={0} id="tip-1">
        <button>버튼</button>
      </Tooltip>
    );
    const btn = screen.getByRole('button');
    act(() => {
      btn.focus();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(btn).toHaveAttribute('aria-describedby', 'tip-1');
    expect(screen.getByRole('tooltip')).toHaveAttribute('id', 'tip-1');
  });
});
