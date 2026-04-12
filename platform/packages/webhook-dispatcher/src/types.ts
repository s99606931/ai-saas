// Webhook Dispatcher -- 공통 타입
// Design Ref: SVC-WEBHOOK-R52.design.md §3.1
// Plan SC: FR-WH.6

export interface DispatchResult {
  /** 최종 성공 여부 */
  success: boolean;
  /** 총 시도 횟수 (첫 시도 포함) */
  attempts: number;
  /** 마지막 HTTP 상태 코드 (시도 시점에 받은) */
  lastStatus?: number;
  /** 마지막 에러 메시지 */
  lastError?: string;
  /** 전체 소요 시간 (ms) */
  durationMs: number;
}

export interface DispatchOptions {
  /** HMAC 비밀키 (환경변수/볼트에서 주입) */
  secret: string;
  /** 최대 재시도 횟수 (기본 5, 첫 시도 포함) */
  maxAttempts?: number;
  /** 초기 백오프 지연 (ms, 기본 1000) */
  baseDelayMs?: number;
  /** 최대 백오프 지연 (ms, 기본 60000) */
  maxDelayMs?: number;
  /** fetch 타임아웃 (ms, 기본 10000) */
  timeoutMs?: number;
  /** 추가 HTTP 헤더 */
  headers?: Record<string, string>;
  /** 현재 시각 주입 (테스트용, epoch seconds) */
  now?: () => number;
  /** fetch 구현 주입 (테스트용) */
  fetchImpl?: typeof fetch;
  /** sleep 구현 주입 (테스트용) */
  sleepImpl?: (ms: number) => Promise<void>;
  /** 취소 시그널 */
  signal?: AbortSignal;
}
