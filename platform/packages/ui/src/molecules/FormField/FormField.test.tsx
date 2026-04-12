/**
 * DS-MOL-R1 — FormField 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from './index.js';
import { Input } from '../../atoms/Input/index.js';

describe('FormField', () => {
  it('renders label and input', () => {
    render(
      <FormField label="이메일">
        <Input type="email" />
      </FormField>
    );
    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
  });

  it('shows required marker', () => {
    render(
      <FormField label="이름" required>
        <Input />
      </FormField>
    );
    expect(screen.getByLabelText('필수 입력')).toBeInTheDocument();
  });

  it('shows error message with alert role', () => {
    render(
      <FormField label="이메일" error="이메일 형식이 아닙니다">
        <Input type="email" />
      </FormField>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('이메일 형식이 아닙니다');
  });

  it('propagates aria-invalid to child input', () => {
    render(
      <FormField label="이메일" error="에러">
        <Input />
      </FormField>
    );
    expect(screen.getByLabelText('이메일')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows helper text when no error', () => {
    render(
      <FormField label="비밀번호" helper="8자 이상">
        <Input type="password" />
      </FormField>
    );
    expect(screen.getByText('8자 이상')).toBeInTheDocument();
  });

  it('hides helper when error present', () => {
    render(
      <FormField label="비밀번호" helper="8자 이상" error="너무 짧습니다">
        <Input type="password" />
      </FormField>
    );
    expect(screen.queryByText('8자 이상')).not.toBeInTheDocument();
    expect(screen.getByText('너무 짧습니다')).toBeInTheDocument();
  });

  it('connects label to input via id', () => {
    render(
      <FormField label="이름">
        <Input />
      </FormField>
    );
    const input = screen.getByLabelText('이름');
    expect(input.id).toBeTruthy();
  });
});
