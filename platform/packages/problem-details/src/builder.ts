// Problem Details 빌더
// Plan SC: FR-PD.2, FR-PD.4, FR-PD.5, FR-PD.7

import {
  PROBLEM_BASE_URI,
  type FieldError,
  type ProblemDetails,
  type ProblemOptions,
} from './types.js';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Problem Details 객체 생성
 * Plan SC: FR-PD.2
 */
export function problem(options: ProblemOptions): ProblemDetails {
  if (!options.title) {
    throw new Error('ProblemDetails.title is required');
  }
  if (
    !Number.isInteger(options.status) ||
    options.status < 100 ||
    options.status > 599
  ) {
    throw new Error(
      `ProblemDetails.status must be an integer in [100, 599], got ${options.status}`,
    );
  }

  const type =
    options.type ?? `${PROBLEM_BASE_URI}/${slugify(options.title) || 'error'}`;

  const result: ProblemDetails = {
    type,
    title: options.title,
    status: options.status,
  };

  if (options.detail !== undefined) result.detail = options.detail;
  if (options.instance !== undefined) result.instance = options.instance;

  if (options.extensions) {
    for (const [k, v] of Object.entries(options.extensions)) {
      if (k === 'type' || k === 'title' || k === 'status') continue;
      result[k] = v;
    }
  }

  return result;
}

/**
 * traceId 주입
 * Plan SC: FR-PD.4
 */
export function withTraceId(
  pd: ProblemDetails,
  traceId: string,
): ProblemDetails {
  return { ...pd, traceId };
}

/**
 * 필드 에러 첨부
 * Plan SC: FR-PD.5
 */
export function withErrors(
  pd: ProblemDetails,
  errors: FieldError[],
): ProblemDetails {
  return { ...pd, errors: [...errors] };
}
