// 부하 테스트 스크립트
// Design Ref: DESIGN-MTU-P21
// 사용법: npx tsx platform/tests/load/load-test.ts

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3003';
const CONCURRENT = parseInt(process.env['CONCURRENT'] ?? '10', 10);
const DURATION_SEC = parseInt(process.env['DURATION'] ?? '30', 10);

interface LoadResult {
  endpoint: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgResponseMs: number;
  p95ResponseMs: number;
  rps: number;
}

async function runLoadTest(endpoint: string, durationSec: number, concurrent: number): Promise<LoadResult> {
  const responseTimes: number[] = [];
  let successCount = 0;
  let errorCount = 0;
  const endTime = Date.now() + durationSec * 1000;

  const worker = async () => {
    while (Date.now() < endTime) {
      const start = Date.now();
      try {
        const res = await fetch(`${BASE_URL}${endpoint}`);
        if (res.ok) successCount++; else errorCount++;
      } catch {
        errorCount++;
      }
      responseTimes.push(Date.now() - start);
    }
  };

  await Promise.all(Array.from({ length: concurrent }, () => worker()));

  responseTimes.sort((a, b) => a - b);
  const totalRequests = responseTimes.length;
  const avgResponseMs = responseTimes.reduce((s, v) => s + v, 0) / totalRequests;
  const p95Index = Math.floor(totalRequests * 0.95);
  const p95ResponseMs = responseTimes[p95Index] ?? 0;

  return {
    endpoint,
    totalRequests,
    successCount,
    errorCount,
    avgResponseMs: Math.round(avgResponseMs),
    p95ResponseMs,
    rps: Math.round(totalRequests / durationSec),
  };
}

async function main() {
  console.log(`부하 테스트 시작: ${CONCURRENT}개 동시 요청, ${DURATION_SEC}초`);
  console.log('---');

  const endpoints = ['/health', '/api/auth/health', '/api/users/health'];

  for (const ep of endpoints) {
    const result = await runLoadTest(ep, DURATION_SEC, CONCURRENT);
    console.log(`[${result.endpoint}]`);
    console.log(`  총 요청: ${result.totalRequests}, 성공: ${result.successCount}, 실패: ${result.errorCount}`);
    console.log(`  평균 응답: ${result.avgResponseMs}ms, P95: ${result.p95ResponseMs}ms, RPS: ${result.rps}`);
    console.log('---');
  }
}

main().catch(console.error);
