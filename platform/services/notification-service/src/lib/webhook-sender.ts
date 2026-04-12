// 웹훅 발송기
// Design Ref: DESIGN-MTU-Q2 §2 FR-P11.3, SVC-NOTIFR2-R56.design.md §7
// Plan SC: FR-P11.3, FR-SSRF.7
// CSAP: D-12-04 SSRF 방지 — DNS 해석 + CIDR 차단

import { assertSafeUrl } from '@public-saas/ssrf-guard';

const WEBHOOK_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;

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
 * 웹훅 HTTP POST 발송 (재시도 + SSRF 방지 강화)
 * Design Ref: SVC-NOTIFR2-R56.design.md §7
 * CSAP D-12-04: DNS 해석 후 모든 IP가 차단 대역에 속하지 않아야 통과
 */
export async function sendWebhook(
  webhookUrl: string,
  payload: WebhookPayload,
): Promise<WebhookResult> {
  // SSRF 방지 (FR-SSRF.4/.7): URL 파싱, hostname 차단, DNS 해석, CIDR 매칭
  const ssrfCheck = await assertSafeUrl(webhookUrl);
  if (!ssrfCheck.safe) {
    return {
      success: false,
      attempts: 0,
      error: `SSRF_BLOCKED: ${ssrfCheck.reason ?? 'unknown'}`,
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
