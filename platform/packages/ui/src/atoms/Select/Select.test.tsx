/**
 * DS-ATOM-R3 — Select 단위 테스트
 * Plan SC: NFR-DSA.4
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select, type SelectOption } from './index.js';

const options: SelectOption[] = [
  { label: '서울', value: 'seoul' },
  { label: '부산', value: 'busan' },
  { label: '제주', value: 'jeju', disabled: true },
];

describe('Select', () => {
  it('renders options', () => {
    render(<Select options={options} aria-label="도시" />);
    expect(screen.getByRole('combobox', { name: '도시' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '서울' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '부산' })).toBeInTheDocument();
  });

  it('renders placeholder as disabled first option', () => {
    render(
      <Select
        options={options}
        placeholder="선택하세요"
        aria-label="도시"
      />
    );
    const placeholder = screen.getByRole('option', { name: '선택하세요' });
    expect(placeholder).toBeDisabled();
  });

  it('disables specific options', () => {
    render(<Select options={options} aria-label="도시" />);
    expect(screen.getByRole('option', { name: '제주' })).toBeDisabled();
  });

  it('fires onChange when value selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select options={options} onChange={onChange} aria-label="도시" />
    );
    await user.selectOptions(screen.getByRole('combobox'), 'busan');
    expect(onChange).toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toHaveValue('busan');
  });

  it('sets aria-invalid when error', () => {
    render(
      <Select options={options} error="필수 항목입니다" aria-label="도시" />
    );
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('필수 항목입니다');
  });

  it('renders helper text when no error', () => {
    render(
      <Select options={options} helperText="지역을 선택하세요" aria-label="도시" />
    );
    expect(screen.getByText('지역을 선택하세요')).toBeInTheDocument();
  });

  it('sets aria-required when required', () => {
    render(<Select options={options} required aria-label="도시" />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-required', 'true');
  });

  it('forwards ref to select element', () => {
    let ref: HTMLSelectElement | null = null;
    render(
      <Select
        options={options}
        aria-label="도시"
        ref={(el) => {
          ref = el;
        }}
      />
    );
    expect(ref).toBeInstanceOf(HTMLSelectElement);
  });
});
