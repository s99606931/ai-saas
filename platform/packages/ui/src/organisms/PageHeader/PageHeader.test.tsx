/**
 * DS-ORG-R2 — PageHeader 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './index.js';

describe('PageHeader', () => {
  it('renders title as h1 by default', () => {
    render(<PageHeader title="사용자 목록" />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('사용자 목록');
  });

  it('renders as h2 when as="h2"', () => {
    render(<PageHeader title="섹션 제목" as="h2" />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      '섹션 제목'
    );
  });

  it('renders subtitle', () => {
    render(<PageHeader title="X" subtitle="부제입니다" />);
    expect(screen.getByText('부제입니다')).toBeInTheDocument();
  });

  it('renders breadcrumbs with nav aria-label', () => {
    render(
      <PageHeader
        title="X"
        breadcrumbs={[
          { label: '홈', path: '/' },
          { label: '사용자' },
        ]}
      />
    );
    const nav = screen.getByRole('navigation', { name: '경로' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute(
      'href',
      '/'
    );
  });

  it('renders actions slot', () => {
    render(
      <PageHeader
        title="X"
        actions={<button type="button">추가</button>}
      />
    );
    expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument();
  });
});
