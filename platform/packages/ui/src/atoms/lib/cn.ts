/**
 * DS-ATOM-R1 — cn() 클래스 합성 유틸
 * Design Ref: docs/02-design/mtus/DS-ATOM-R1.design.md §결정 4
 * Plan SC: FR-DSA.1
 *
 * clsx + tailwind-merge 결합
 * - clsx: 조건부 클래스 합성
 * - tailwind-merge: 충돌하는 Tailwind 클래스 자동 해결
 *
 * 사용:
 *   cn('px-2', isActive && 'bg-blue-500', 'px-4')  → 'bg-blue-500 px-4'
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
