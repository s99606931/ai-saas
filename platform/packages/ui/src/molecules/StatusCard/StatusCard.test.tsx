/**
 * DS-MOL-R2 — StatusCard 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusCard } from './index.js';

describe('StatusCard', () => {
  it('renders title and value', () => {
    render(<StatusCard title="일일 방문자" value={1234} />);
    expect(screen.getByText('일일 방문자')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<StatusCard title="상태" value="정상" />);
    expect(screen.getByText('정상')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <StatusCard
        title="사용자"
        value={100}
        icon={<span data-testid="user-icon">👤</span>}
      />
    );
    expect(screen.getByTestId('user-icon')).toBeInTheDocument();
  });

  it('renders trend with up direction', () => {
    render(
      <StatusCard
        title="방문자"
        value={1000}
        trend={{ value: 12.5, direction: 'up', label: '전월 대비' }}
      />
    );
    expect(screen.getByText('12.5%')).toBeInTheDocument();
    expect(screen.getByText('전월 대비')).toBeInTheDocument();
  });

  it('applies accessibility label on trend', () => {
    render(
      <StatusCard
        title="방문자"
        value={1000}
        trend={{ value: 5, direction: 'down', label: '전주 대비' }}
      />
    );
    expect(screen.getByLabelText(/전주 대비 down 5/)).toBeInTheDocument();
  });

  it('renders description slot', () => {
    render(
      <StatusCard
        title="건수"
        value={42}
        description="최근 24시간 기준"
      />
    );
    expect(screen.getByText('최근 24시간 기준')).toBeInTheDocument();
  });

  it('applies variant accent class', () => {
    const { container } = render(
      <StatusCard title="경고" value={5} variant="warning" />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('--color-warning');
  });
});
