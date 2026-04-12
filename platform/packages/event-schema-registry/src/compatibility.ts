// 스키마 호환성 검사 (backward compatible)
// Plan SC: FR-ESR.4

import type { Schema, ObjectSchema } from './schema-validator.js';

export interface CompatibilityResult {
  compatible: boolean;
  reasons: string[];
}

/**
 * newSchema가 oldSchema와 backward-compatible한지 검사.
 * 즉, oldSchema로 검증되던 데이터가 newSchema로도 검증 가능해야 함.
 */
export function isBackwardCompatible(
  oldSchema: Schema,
  newSchema: Schema,
): CompatibilityResult {
  const reasons: string[] = [];
  check(oldSchema, newSchema, '', reasons);
  return { compatible: reasons.length === 0, reasons };
}

function check(
  oldS: Schema,
  newS: Schema,
  path: string,
  reasons: string[],
): void {
  // 타입 변경 → 비호환
  if (oldS.type !== newS.type) {
    reasons.push(`${path || '$'}: type changed ${oldS.type} → ${newS.type}`);
    return;
  }

  if (oldS.type === 'object' && newS.type === 'object') {
    checkObject(oldS, newS, path, reasons);
    return;
  }

  if ('enum' in oldS && oldS.enum && 'enum' in newS && newS.enum) {
    // enum 값 제거 → 비호환
    for (const v of oldS.enum) {
      if (!newS.enum.includes(v)) {
        reasons.push(`${path || '$'}: enum value removed: ${String(v)}`);
      }
    }
  }
}

function checkObject(
  oldS: ObjectSchema,
  newS: ObjectSchema,
  path: string,
  reasons: string[],
): void {
  const oldRequired = new Set(oldS.required ?? []);
  const newRequired = new Set(newS.required ?? []);

  // 새 required 필드 추가 → 비호환
  for (const r of newRequired) {
    if (!oldRequired.has(r)) {
      reasons.push(
        `${path || '$'}: new required field added: ${r}`,
      );
    }
  }

  const oldProps = oldS.properties ?? {};
  const newProps = newS.properties ?? {};

  // 기존 필드 제거 → 비호환
  for (const key of Object.keys(oldProps)) {
    if (!(key in newProps)) {
      reasons.push(`${path || '$'}: existing field removed: ${key}`);
      continue;
    }
    check(oldProps[key]!, newProps[key]!, joinPath(path, key), reasons);
  }
}

function joinPath(parent: string, child: string): string {
  return parent ? `${parent}.${child}` : child;
}
