// Problem Details sanitize (production 모드)
// Plan SC: FR-PD.6

import type { ProblemDetails } from './types.js';

export type Environment = 'development' | 'staging' | 'production';

const SENSITIVE_EXTENSIONS = ['stack', 'sql', 'cause'];

/**
 * production 환경에서 detail 및 민감 extension 제거
 * Plan SC: FR-PD.6
 */
export function sanitize(
  pd: ProblemDetails,
  env: Environment,
): ProblemDetails {
  if (env !== 'production') {
    return pd;
  }
  const result: ProblemDetails = { ...pd };
  delete result.detail;
  for (const key of SENSITIVE_EXTENSIONS) {
    if (key in result) delete result[key];
  }
  return result;
}
