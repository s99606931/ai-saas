// API 공통 응답 타입
// Design Ref: D-P00.2

/**
 * API 성공 응답
 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/**
 * 페이지네이션 응답
 */
export interface PaginatedResponse<T = unknown> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * API 오류 응답
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    /** 오류 추적 ID (감사 로그 연결) */
    errorId?: string;
  };
}
