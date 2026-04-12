// 객체/배열 트리 재귀 마스킹
// Plan SC: FR-DM.7

import { maskString } from './string-masker.js';
import { shouldMaskKey } from './key-policy.js';
import type { MaskPolicy } from './types.js';

const MASKED_LITERAL = '[MASKED]';

/**
 * 객체/배열 트리를 깊이 우선으로 순회하며 마스킹
 * 순환 참조는 WeakSet으로 차단
 *
 * Plan SC: FR-DM.7
 */
export function maskTree<T>(node: T, policy?: MaskPolicy): T {
  return maskTreeInternal(node, policy, new WeakSet()) as T;
}

function maskTreeInternal(
  node: unknown,
  policy: MaskPolicy | undefined,
  seen: WeakSet<object>,
): unknown {
  if (node === null || node === undefined) return node;

  if (typeof node === 'string') {
    return maskString(node, policy);
  }

  if (
    typeof node === 'number' ||
    typeof node === 'boolean' ||
    typeof node === 'bigint'
  ) {
    return node;
  }

  if (typeof node !== 'object') return node;

  if (seen.has(node as object)) {
    return '[CIRCULAR]';
  }
  seen.add(node as object);

  if (Array.isArray(node)) {
    return node.map((item) => maskTreeInternal(item, policy, seen));
  }

  // Date, RegExp, Map, Set 등은 그대로 보존
  const proto = Object.getPrototypeOf(node);
  if (proto !== Object.prototype && proto !== null) {
    return node;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (shouldMaskKey(key, policy)) {
      if (policy?.onMask) {
        try {
          policy.onMask({ type: 'key', location: key });
        } catch {
          /* 격리 */
        }
      }
      result[key] = MASKED_LITERAL;
    } else {
      result[key] = maskTreeInternal(value, policy, seen);
    }
  }
  return result;
}
