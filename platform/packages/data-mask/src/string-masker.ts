// 문자열 PII 마스킹
// Plan SC: FR-DM.1~FR-DM.6, FR-DM.10

import {
  ssnPattern,
  cardPattern,
  mobilePattern,
  landlinePattern,
  emailPattern,
  accountPattern,
  isLuhnValid,
  maskAddress,
} from './pii-patterns.js';
import type { MaskPolicy, PiiType } from './types.js';

function emit(policy: MaskPolicy | undefined, type: PiiType): void {
  if (policy?.onMask) {
    try {
      policy.onMask({ type });
    } catch {
      /* hook 격리 */
    }
  }
}

function isEnabled(policy: MaskPolicy | undefined, type: PiiType): boolean {
  if (!policy?.enabledTypes) return true;
  return policy.enabledTypes.includes(type);
}

/**
 * 문자열에서 PII를 탐지하여 마스킹
 * Plan SC: FR-DM.1~FR-DM.6
 */
export function maskString(input: string, policy?: MaskPolicy): string {
  if (typeof input !== 'string' || input.length === 0) return input;

  let result = input;

  // 1. 주민등록번호 우선 (카드 패턴과 충돌 방지)
  if (isEnabled(policy, 'ssn')) {
    result = result.replace(ssnPattern(), (_m, pre, gender) => {
      emit(policy, 'ssn');
      return `${pre}-${gender}******`;
    });
  }

  // 2. 신용카드 (Luhn 검증)
  // Luhn 실패 카드도 sentinel로 보호하여 후속 계좌 패턴이 잘못 매칭하지 않도록 함
  const cardSentinels: string[] = [];
  if (isEnabled(policy, 'card')) {
    result = result.replace(cardPattern(), (match) => {
      if (isLuhnValid(match)) {
        emit(policy, 'card');
        const digits = match.replace(/\D/g, '');
        return `${digits.slice(0, 4)}-${digits.slice(4, 6)}**-****-${digits.slice(12, 16)}`;
      }
      // Luhn 실패: sentinel로 보호 후 끝에서 복원
      const idx = cardSentinels.length;
      cardSentinels.push(match);
      return `\u0000CARD${idx}\u0000`;
    });
  }

  // 3. 휴대폰
  if (isEnabled(policy, 'phone')) {
    result = result.replace(mobilePattern(), (_m, prefix, _mid, last) => {
      emit(policy, 'phone');
      return `${prefix}-****-${last}`;
    });
  }

  // 4. 유선전화
  if (isEnabled(policy, 'landline')) {
    result = result.replace(landlinePattern(), (_m, area, _mid, last) => {
      emit(policy, 'landline');
      return `${area}-****-${last}`;
    });
  }

  // 5. 이메일
  if (isEnabled(policy, 'email')) {
    result = result.replace(emailPattern(), (_m, local, domain) => {
      emit(policy, 'email');
      const visible = local.length > 0 ? local[0] : '';
      return `${visible}***@${domain}`;
    });
  }

  // 6. 계좌번호 (마지막에 — 가장 광범위한 패턴)
  if (isEnabled(policy, 'account')) {
    result = result.replace(accountPattern(), (match, a, b, c) => {
      // 카드/SSN과 겹친 부분은 이미 마스킹됨
      if (match.includes('*')) return match;
      const total = (a as string).length + (b as string).length + (c as string).length;
      if (total < 10 || total > 16) return match;
      emit(policy, 'account');
      return `***-***-${(c as string).slice(-4)}`;
    });
  }

  // 7. 주소
  if (isEnabled(policy, 'address')) {
    const masked = maskAddress(result);
    if (masked !== result) {
      emit(policy, 'address');
      result = masked;
    }
  }

  // sentinel 복원 (Luhn 실패 카드)
  if (cardSentinels.length > 0) {
    result = result.replace(/\u0000CARD(\d+)\u0000/g, (_m, idx) => {
      return cardSentinels[parseInt(idx, 10)] ?? '';
    });
  }

  return result;
}
