// 웹훅 발송기
// Design Ref: DESIGN-MTU-Q2 §2 FR-P11.3
// Plan SC: FR-P11.3
// CSAP: D-12 입력 검증 — SSRF 방지

const WEBHOOK_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;

/** 내부 IP 대역 검사 (SSRF 방지) */
function isInternalUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // 내부 IP 대역 차단
    const blockedPatterns = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];

    if (blockedPatterns.includes(hostname)) return true;

    // 사설 IP 대역 및 클라우드 메타데이터 엔드포인트 차단 (CSAP D-12-04 SSRF 방지)
    const parts = hostname.split('.');
    if (parts.length === 4) {
      const first = parseInt(parts[0] ?? '', 10);
      const second = parseInt(parts[1] ?? '', 10);
      if (first === 10) return true;
      if (first === 172 && second >= 16 && second <= 31) return true;
      if (first === 192 && second === 168) return true;
      if (first === 169 && second === 254) return true; // 클라우드 메타데이터 (AWS/GCP/Azure)
    }

    return false;
  } catch {
    return true; // 파싱 불가한 URL은 차단
  }
}

interface WebhookPayload {
  subject: string;
  body: string;
  channel: string;
  metadata?: Record<string, unknown>;
  sentAt: string;
}

interface WebhookResult {
  success: boolean;
  statusCode?: number;
  attempts: number;
  error?: string;
}

/**
 * 웹훅 HTTP POST 발송 (재시도 + SSRF 방지)
 * Design Ref: DESIGN-MTU-Q2 §2
 */
export async function sendWebhook(webhookUrl: string, payload: WebhookPayload): Promise<WebhookResult> {
  // SSRF 방지: 내부 URL 차단
  if (isInternalUrl(webhookUrl)) {
    return {
      success: false,
      attempts: 0,
      error: 'SSRF_BLOCKED: 내부 네트워크 대상 웹훅 발송이 차단되었습니다',
    };
  }

  let lastError = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PublicSaaS-NotificationService/1.0',
          'X-Webhook-Source': 'public-saas-platform',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: 'manual', // SSRF 방지: 리다이렉트 추적 차단 (CSAP D-12-04)
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { success: true, statusCode: response.status, attempts: attempt };
      }

      lastError = `HTTP ${response.status}: ${response.statusText}`;
    } catch (error) {
      const err = error as Error;
      lastError = err.name === 'AbortError' ? 'timeout' : err.message;
    }

    // 지수 백오프 대기 (재시도 간)
    if (attempt < MAX_RETRIES) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return {
    success: false,
    attempts: MAX_RETRIES,
    error: `최대 재시도 횟수(${MAX_RETRIES}) 초과: ${lastError}`,
  };
}
