// 부하 테스트 스크립트
// Design Ref: DESIGN-MTU-P21
// Plan SC: FR-P21.3, FR-P21.4
// 사용법: npx tsx platform/tests/load/load-test.ts
//
// 시나리오:
//   1. 헬스체크: 각 서비스 /health 엔드포인트
//   2. 인증 흐름: 로그인 -> 토큰 갱신 -> 로그아웃
//   3. API 호출: 인증 후 테넌트/사용자/메뉴 조회
//   4. 동시 접속: 다수 사용자 동시 로그인 시뮬레이션

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3000';
const AUTH_URL = process.env['AUTH_URL'] ?? 'http://localhost:3001';
const CONCURRENT = parseInt(process.env['CONCURRENT'] ?? '10', 10);
const DURATION_SEC = parseInt(process.env['DURATION'] ?? '30', 10);
const TEST_EMAIL = process.env['TEST_EMAIL'] ?? 'admin@mois-demo.go.kr';
const TEST_PASSWORD = process.env['TEST_PASSWORD'] ?? 'Demo2026!';

interface LoadResult {
  endpoint: string;
  method: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgResponseMs: number;
  p50ResponseMs: number;
  p95ResponseMs: number;
  p99ResponseMs: number;
  minResponseMs: number;
  maxResponseMs: number;
  rps: number;
  errorRate: string;
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * 단일 엔드포인트 부하 테스트
 */
async function runLoadTest(
  endpoint: string,
  durationSec: number,
  concurrent: number,
  options: RequestOptions = {},
): Promise<LoadResult> {
  const responseTimes: number[] = [];
  let successCount = 0;
  let errorCount = 0;
  const endTime = Date.now() + durationSec * 1000;
  const method = options.method ?? 'GET';

  const worker = async () => {
    while (Date.now() < endTime) {
      const start = Date.now();
      try {
        const fetchOptions: RequestInit = {
          method,
          headers: {
            'content-type': 'application/json',
            ...options.headers,
          },
        };
        if (options.body && method !== 'GET') {
          fetchOptions.body = options.body;
        }
        const res = await fetch(`${BASE_URL}${endpoint}`, fetchOptions);
        if (res.ok) successCount++;
        else errorCount++;
      } catch {
        errorCount++;
      }
      responseTimes.push(Date.now() - start);
    }
  };

  await Promise.all(Array.from({ length: concurrent }, () => worker()));

  responseTimes.sort((a, b) => a - b);
  const totalRequests = responseTimes.length;

  if (totalRequests === 0) {
    return {
      endpoint,
      method,
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      avgResponseMs: 0,
      p50ResponseMs: 0,
      p95ResponseMs: 0,
      p99ResponseMs: 0,
      minResponseMs: 0,
      maxResponseMs: 0,
      rps: 0,
      errorRate: '0%',
    };
  }

  const avgResponseMs = responseTimes.reduce((s, v) => s + v, 0) / totalRequests;
  const p50Index = Math.floor(totalRequests * 0.5);
  const p95Index = Math.floor(totalRequests * 0.95);
  const p99Index = Math.floor(totalRequests * 0.99);
  const errorRate = ((errorCount / totalRequests) * 100).toFixed(1);

  return {
    endpoint,
    method,
    totalRequests,
    successCount,
    errorCount,
    avgResponseMs: Math.round(avgResponseMs),
    p50ResponseMs: responseTimes[p50Index] ?? 0,
    p95ResponseMs: responseTimes[p95Index] ?? 0,
    p99ResponseMs: responseTimes[p99Index] ?? 0,
    minResponseMs: responseTimes[0] ?? 0,
    maxResponseMs: responseTimes[totalRequests - 1] ?? 0,
    rps: Math.round(totalRequests / durationSec),
    errorRate: `${errorRate}%`,
  };
}

/**
 * 로그인하여 JWT 토큰 획득
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const res = await fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { accessToken?: string } };
    return data.data?.accessToken ?? null;
  } catch {
    return null;
  }
}

function printResult(result: LoadResult): void {
  console.log(`[${result.method} ${result.endpoint}]`);
  console.log(
    `  총 요청: ${result.totalRequests}, 성공: ${result.successCount}, 실패: ${result.errorCount} (${result.errorRate})`,
  );
  console.log(
    `  응답시간: 평균=${result.avgResponseMs}ms, P50=${result.p50ResponseMs}ms, P95=${result.p95ResponseMs}ms, P99=${result.p99ResponseMs}ms`,
  );
  console.log(`  범위: 최소=${result.minResponseMs}ms, 최대=${result.maxResponseMs}ms`);
  console.log(`  RPS: ${result.rps}`);
  console.log('---');
}

function printSummary(results: LoadResult[]): void {
  console.log('');
  console.log('=== 종합 요약 ===');
  console.log(`테스트 조건: 동시 ${CONCURRENT}개, ${DURATION_SEC}초`);
  console.log('');

  const totalReqs = results.reduce((s, r) => s + r.totalRequests, 0);
  const totalErrors = results.reduce((s, r) => s + r.errorCount, 0);
  const avgP95 = Math.round(results.reduce((s, r) => s + r.p95ResponseMs, 0) / results.length);

  console.log(`총 요청: ${totalReqs}`);
  console.log(`총 오류: ${totalErrors} (${((totalErrors / totalReqs) * 100).toFixed(2)}%)`);
  console.log(`평균 P95: ${avgP95}ms`);
  console.log('');

  // SLA 기준 판정 (CSAP 성능 요건)
  const SLA_P95_MS = 500;
  const SLA_ERROR_RATE = 1;
  const p95Pass = results.every((r) => r.p95ResponseMs <= SLA_P95_MS);
  const errorPass = (totalErrors / totalReqs) * 100 <= SLA_ERROR_RATE;

  console.log(`SLA 판정 (P95 <= ${SLA_P95_MS}ms): ${p95Pass ? 'PASS' : 'FAIL'}`);
  console.log(`SLA 판정 (오류율 <= ${SLA_ERROR_RATE}%): ${errorPass ? 'PASS' : 'FAIL'}`);
}

async function main() {
  console.log('============================================');
  console.log('공공기관 SaaS 플랫폼 — 부하 테스트');
  console.log('Design Ref: DESIGN-MTU-P21');
  console.log('============================================');
  console.log(`대상: ${BASE_URL}`);
  console.log(`동시 요청: ${CONCURRENT}개, 지속 시간: ${DURATION_SEC}초`);
  console.log('');

  const results: LoadResult[] = [];

  // ── 시나리오 1: 헬스체크 ──
  console.log('=== 시나리오 1: 헬스체크 ===');
  const healthEndpoints = ['/health', '/api/v1/auth/health', '/api/v1/users/health'];

  for (const ep of healthEndpoints) {
    const result = await runLoadTest(ep, DURATION_SEC, CONCURRENT);
    printResult(result);
    results.push(result);
  }

  // ── 시나리오 2: 인증 흐름 ──
  console.log('=== 시나리오 2: 인증 (로그인) ===');
  const loginResult = await runLoadTest('/api/v1/auth/login', DURATION_SEC, Math.min(CONCURRENT, 5), {
    method: 'POST',
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  printResult(loginResult);
  results.push(loginResult);

  // ── 시나리오 3: 인증된 API 호출 ──
  console.log('=== 시나리오 3: 인증된 API 호출 ===');
  const token = await getAuthToken();

  if (token) {
    const authHeaders = { authorization: `Bearer ${token}` };

    const authenticatedEndpoints: Array<{ path: string; method?: string }> = [
      { path: '/api/v1/tenants/' },
      { path: '/api/v1/users/' },
      { path: '/api/v1/menus/tree' },
      { path: '/api/v1/services/services' },
      { path: '/api/v1/compliance/csap' },
      { path: '/api/v1/audit/logs' },
    ];

    for (const ep of authenticatedEndpoints) {
      const result = await runLoadTest(ep.path, DURATION_SEC, CONCURRENT, {
        method: ep.method ?? 'GET',
        headers: authHeaders,
      });
      printResult(result);
      results.push(result);
    }
  } else {
    console.log('  인증 토큰 획득 실패 — 인증 시나리오 스킵');
    console.log('  (서비스가 실행 중인지 확인: docker-compose up)');
    console.log('---');
  }

  // ── 시나리오 4: 동시 로그인 스파이크 ──
  console.log('=== 시나리오 4: 동시 로그인 스파이크 ===');
  const spikeResult = await runLoadTest('/api/v1/auth/login', 10, CONCURRENT * 2, {
    method: 'POST',
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  printResult(spikeResult);
  results.push(spikeResult);

  // ── 종합 요약 ──
  printSummary(results);
}

main().catch(console.error);
