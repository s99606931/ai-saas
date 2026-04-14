/**
 * DS-ORG-R1 — AppShell 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from './index.js';

describe('AppShell', () => {
  it('renders header, sidebar, and children', () => {
    render(
      <AppShell
        header={<div>HEADER</div>}
        sidebar={<nav>SIDEBAR</nav>}
      >
        <p>CONTENT</p>
      </AppShell>
    );
    expect(screen.getByText('HEADER')).toBeInTheDocument();
    expect(screen.getByText('SIDEBAR')).toBeInTheDocument();
    expect(screen.getByText('CONTENT')).toBeInTheDocument();
  });

  it('main has role=main and id=main', () => {
    render(
      <AppShell header={<div />} sidebar={<div />}>
        <p>x</p>
      </AppShell>
    );
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
  });

  it('applies collapsed sidebar width', () => {
    const { container } = render(
      <AppShell
        header={<div />}
        sidebar={<div />}
        sidebarCollapsed
      >
        <p>x</p>
      </AppShell>
    );
    const shell = container.firstChild as HTMLElement;
    expect(shell).toHaveAttribute('data-shell-collapsed', 'true');
    expect(shell.style.gridTemplateColumns).toContain('64px');
  });

  it('default sidebar width is 240px', () => {
    const { container } = render(
      <AppShell header={<div />} sidebar={<div />}>
        <p>x</p>
      </AppShell>
    );
    const shell = container.firstChild as HTMLElement;
    expect(shell.style.gridTemplateColumns).toContain('240px');
  });

  it('renders skip link for accessibility', () => {
    render(
      <AppShell header={<div />} sidebar={<div />}>
        <p>x</p>
      </AppShell>
    );
    expect(screen.getByText('본문 바로가기')).toBeInTheDocument();
  });
});
