/**
 * DS-ATOM-R3 — Radio / RadioGroup 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Radio, RadioGroup } from './index.js';

describe('Radio (standalone)', () => {
  it('renders with label', () => {
    render(<Radio value="a" label="옵션 A" name="x" />);
    expect(screen.getByLabelText('옵션 A')).toBeInTheDocument();
  });

  it('supports keyboard activation (Space)', async () => {
    const user = userEvent.setup();
    render(<Radio value="a" label="키보드" name="x" />);
    const radio = screen.getByRole('radio');
    radio.focus();
    await user.keyboard(' ');
    expect(radio).toBeChecked();
  });

  it('sets aria-invalid when error', () => {
    render(<Radio value="a" error name="x" />);
    expect(screen.getByRole('radio')).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables when disabled prop set', () => {
    render(<Radio value="a" disabled name="x" />);
    expect(screen.getByRole('radio')).toBeDisabled();
  });
});

describe('RadioGroup', () => {
  it('renders radiogroup role', () => {
    render(
      <RadioGroup name="city" aria-label="도시">
        <Radio value="seoul" label="서울" />
        <Radio value="busan" label="부산" />
      </RadioGroup>
    );
    expect(screen.getByRole('radiogroup', { name: '도시' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('propagates name from group context', () => {
    render(
      <RadioGroup name="city" aria-label="도시">
        <Radio value="seoul" label="서울" />
        <Radio value="busan" label="부산" />
      </RadioGroup>
    );
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios[0]?.name).toBe('city');
    expect(radios[1]?.name).toBe('city');
  });

  it('controlled selection via value prop', () => {
    render(
      <RadioGroup name="city" value="busan" aria-label="도시">
        <Radio value="seoul" label="서울" />
        <Radio value="busan" label="부산" />
      </RadioGroup>
    );
    expect(screen.getByLabelText('서울')).not.toBeChecked();
    expect(screen.getByLabelText('부산')).toBeChecked();
  });

  it('calls onChange with new value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup name="city" onChange={onChange} aria-label="도시">
        <Radio value="seoul" label="서울" />
        <Radio value="busan" label="부산" />
      </RadioGroup>
    );
    await user.click(screen.getByLabelText('부산'));
    expect(onChange).toHaveBeenCalledWith('busan');
  });

  it('sets aria-required when required', () => {
    render(
      <RadioGroup name="city" required aria-label="도시">
        <Radio value="seoul" label="서울" />
      </RadioGroup>
    );
    expect(screen.getByRole('radiogroup')).toHaveAttribute(
      'aria-required',
      'true'
    );
  });

  it('disables all radios when group disabled', () => {
    render(
      <RadioGroup name="city" disabled aria-label="도시">
        <Radio value="seoul" label="서울" />
        <Radio value="busan" label="부산" />
      </RadioGroup>
    );
    screen.getAllByRole('radio').forEach((r) => {
      expect(r).toBeDisabled();
    });
  });

  it('supports horizontal orientation', () => {
    render(
      <RadioGroup name="city" orientation="horizontal" aria-label="도시">
        <Radio value="seoul" label="서울" />
      </RadioGroup>
    );
    expect(screen.getByRole('radiogroup')).toHaveAttribute(
      'data-orientation',
      'horizontal'
    );
  });
});
