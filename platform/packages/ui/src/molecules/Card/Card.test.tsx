/**
 * DS-MOL-R1 — Card 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card } from './index.js';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>콘텐츠</Card>);
    expect(screen.getByText('콘텐츠')).toBeInTheDocument();
  });

  it('renders compound structure', () => {
    render(
      <Card>
        <Card.Header>
          <Card.Title>제목</Card.Title>
          <Card.Description>설명</Card.Description>
        </Card.Header>
        <Card.Body>본문</Card.Body>
        <Card.Footer>푸터</Card.Footer>
      </Card>
    );
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('제목');
    expect(screen.getByText('설명')).toBeInTheDocument();
    expect(screen.getByText('본문')).toBeInTheDocument();
    expect(screen.getByText('푸터')).toBeInTheDocument();
  });

  it('interactive card has button role and is focusable', () => {
    render(<Card interactive>클릭</Card>);
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('tabindex', '0');
  });

  it('interactive card handles click', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Card interactive onClick={handleClick}>
        클릭 가능
      </Card>
    );
    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });

  it('non-interactive card has no button role', () => {
    render(<Card>정적</Card>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
