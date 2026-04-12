// RFC 7807 Problem Details 타입
// Plan SC: FR-PD.1

export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: FieldError[];
  traceId?: string;
  [extension: string]: unknown;
}

export interface ProblemOptions {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  extensions?: Record<string, unknown>;
}

export const PROBLEM_BASE_URI = 'https://problems.public-saas.kr';
