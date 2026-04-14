/**
 * DS-MOL-R4 — DatePicker 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatePicker, formatKoreanDate } from './index.js';

describe('formatKoreanDate', () => {
  it('formats valid ISO date', () => {
    expect(formatKoreanDate('2026-04-14')).toBe('2026년 4월 14일');
  });

  it('returns empty for invalid input', () => {
    expect(formatKoreanDate('')).toBe('');
    expect(formatKoreanDate('not-a-date')).toBe('');
    expect(formatKoreanDate('2026/04/14')).toBe('');
  });

  it('rejects out-of-range month/day', () => {
    expect(formatKoreanDate('2026-13-01')).toBe('');
    expect(formatKoreanDate('2026-01-32')).toBe('');
  });

  it('accepts single-digit month/day', () => {
    expect(formatKoreanDate('2026-4-1')).toBe('2026년 4월 1일');
  });
});

describe('DatePicker', () => {
  it('renders input type=date', () => {
    render(<DatePicker aria-label="날짜" />);
    const input = screen.getByLabelText('날짜') as HTMLInputElement;
    expect(input.type).toBe('date');
  });

  it('fires onChange with ISO value', () => {
    const onChange = vi.fn();
    render(<DatePicker onChange={onChange} aria-label="날짜" />);
    const input = screen.getByLabelText('날짜');
    fireEvent.change(input, { target: { value: '2026-04-14' } });
    expect(onChange).toHaveBeenCalledWith('2026-04-14');
  });

  it('respects min and max', () => {
    render(
      <DatePicker min="2026-01-01" max="2026-12-31" aria-label="날짜" />
    );
    const input = screen.getByLabelText('날짜');
    expect(input).toHaveAttribute('min', '2026-01-01');
    expect(input).toHaveAttribute('max', '2026-12-31');
  });

  it('sets aria-invalid and shows error message', () => {
    render(
      <DatePicker error="날짜 필수" aria-label="날짜" />
    );
    expect(screen.getByLabelText('날짜')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('날짜 필수');
  });

  it('renders helper text when no error', () => {
    render(
      <DatePicker helperText="YYYY-MM-DD 형식" aria-label="날짜" />
    );
    expect(screen.getByText('YYYY-MM-DD 형식')).toBeInTheDocument();
  });

  it('sets aria-required when required', () => {
    render(<DatePicker required aria-label="날짜" />);
    expect(screen.getByLabelText('날짜')).toHaveAttribute(
      'aria-required',
      'true'
    );
  });

  it('forwards ref', () => {
    let ref: HTMLInputElement | null = null;
    render(
      <DatePicker
        aria-label="날짜"
        ref={(el) => {
          ref = el;
        }}
      />
    );
    expect(ref).toBeInstanceOf(HTMLInputElement);
  });
});
