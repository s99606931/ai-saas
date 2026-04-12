// 키 기반 마스킹 정책
// Plan SC: FR-DM.8

import type { MaskPolicy } from './types.js';

const DEFAULT_MASKED_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'authorization',
  'apikey',
  'api_key',
  'ssn',
  'social_security_number',
  'credit_card',
  'creditcard',
  'cvv',
  'pin',
]);

export function shouldMaskKey(
  key: string,
  policy?: MaskPolicy,
): boolean {
  const lower = key.toLowerCase();

  if (DEFAULT_MASKED_KEYS.has(lower)) return true;

  if (policy?.maskedKeys) {
    for (const k of policy.maskedKeys) {
      if (k.toLowerCase() === lower) return true;
    }
  }

  if (policy?.maskedKeyPatterns) {
    for (const re of policy.maskedKeyPatterns) {
      if (re.test(key)) return true;
    }
  }

  return false;
}
