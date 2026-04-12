/**
 * DS-MOL-R1 — Alert 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Alert } from './index.js';

describe('Alert', () => {
  it('renders with title and children', () => {
    render(
      <Alert title="저장 완료" variant="success">
        데이터가 저장되었습니다
      </Alert>
    );
    expect(screen.getByText('저장 완료')).toBeInTheDocument();
    expect(screen.getByText('데이터가 저장되었습니다')).toBeInTheDocument();
  });

  it('uses role="alert" for warning and error', () => {
    const { rerender } = render(<Alert variant="warning">경고</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<Alert variant="error">에러</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('uses role="status" for info and success', () => {
    const { rerender } = render(<Alert variant="info">정보</Alert>);
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(<Alert variant="success">성공</Alert>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows dismiss button when dismissible', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(
      <Alert dismissible onDismiss={onDismiss}>
        닫을 수 있음
      </Alert>
    );
    await user.click(screen.getByRole('button', { name: '닫기' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('hides default icon when icon={false}', () => {
    const { container } = render(
      <Alert variant="info" icon={false}>
        아이콘 없음
      </Alert>
    );
    // lucide 아이콘은 svg
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders custom icon', () => {
    render(
      <Alert icon={<span data-testid="custom-icon">!</span>}>커스텀</Alert>
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
