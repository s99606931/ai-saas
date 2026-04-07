#!/usr/bin/env node
/**
 * 공공기관 SaaS 프레임워크 -- API 성능 벤치마크
 * Design Ref: DESIGN-MTU-N07
 * Plan SC: FR-N07.1, FR-N07.2, FR-N07.3, FR-N07.4
 *
 * 사용법:
 *   node platform/scripts/benchmark.mjs [--url http://localhost:3000] [--duration 10] [--connections 10]
 *
 * 의존성:
 *   pnpm add -D autocannon (workspace root)
 */

import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// autocannon이 없으면 안내 메시지 출력
let autocannon;
try {
  const require = createRequire(import.meta.url);
  autocannon = require('autocannon');
} catch {
  console.error('autocannon이 설치되지 않았습니다.');
  console.error('설치: pnpm add -D autocannon');
  console.error('또는: npx autocannon 사용');
  process.exit(1);
}

// CLI 인자 파싱
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultValue;
};

const BASE_URL = getArg('--url', 'http://localhost:3000');
const DURATION = parseInt(getArg('--duration', '10'), 10);
const CONNECTIONS = parseInt(getArg('--connections', '10'), 10);

// 벤치마크 대상 엔드포인트
const ENDPOINTS = [
  {
    name: 'Health Check',
    path: '/health',
    method: 'GET',
    needsAuth: false,
  },
  {
    name: 'API Gateway Health',
    path: '/api/v1/health',
    method: 'GET',
    needsAuth: false,
  },
  {
    name: 'Auth Login',
    path: '/api/v1/auth/login',
    method: 'POST',
    needsAuth: false,
    body: JSON.stringify({
      email: 'admin@example.go.kr',
      password: 'admin-password',
    }),
    headers: { 'Content-Type': 'application/json' },
  },
  {
    name: 'Users List (인증)',
    path: '/api/v1/users',
    method: 'GET',
    needsAuth: true,
  },
  {
    name: 'Tenants List (인증)',
    path: '/api/v1/tenants',
    method: 'GET',
    needsAuth: true,
  },
  {
    name: 'Audit Logs (인증)',
    path: '/api/v1/audit-logs',
    method: 'GET',
    needsAuth: true,
  },
  {
    name: 'Compliance Status (인증)',
    path: '/api/v1/compliance/csap',
    method: 'GET',
    needsAuth: true,
  },
];

// 성능 기준
const THRESHOLDS = {
  p95_ms: 200,
  p99_ms: 500,
  errorRate: 0.01, // 1%
  minRps: 100,
};

// 결과 저장
const results = [];

/**
 * 단일 엔드포인트 벤치마크 실행
 */
function runBenchmark(endpoint, authToken) {
  return new Promise((resolve) => {
    const opts = {
      url: `${BASE_URL}${endpoint.path}`,
      method: endpoint.method,
      duration: DURATION,
      connections: CONNECTIONS,
      headers: {
        ...(endpoint.headers || {}),
        ...(endpoint.needsAuth && authToken
          ? { Authorization: `Bearer ${authToken}` }
          : {}),
      },
    };

    if (endpoint.body) {
      opts.body = endpoint.body;
    }

    const instance = autocannon(opts, (err, result) => {
      if (err) {
        resolve({
          name: endpoint.name,
          path: endpoint.path,
          error: err.message,
          pass: false,
        });
        return;
      }

      const totalRequests = result.requests.total;
      const errors = result.errors + result.timeouts + (result.non2xx || 0);
      const errorRate = totalRequests > 0 ? errors / totalRequests : 0;

      const benchResult = {
        name: endpoint.name,
        path: endpoint.path,
        method: endpoint.method,
        duration: `${DURATION}s`,
        connections: CONNECTIONS,
        totalRequests,
        rps: Math.round(result.requests.average),
        latency: {
          avg: result.latency.average,
          p50: result.latency.p50 || result.latency.average,
          p95: result.latency.p97_5 || result.latency.average, // autocannon uses p97.5
          p99: result.latency.p99 || result.latency.average,
          max: result.latency.max,
        },
        errors,
        errorRate: (errorRate * 100).toFixed(2) + '%',
        throughput: `${(result.throughput.average / 1024).toFixed(1)} KB/s`,
        pass: {
          p95: (result.latency.p97_5 || result.latency.average) <= THRESHOLDS.p95_ms,
          p99: (result.latency.p99 || result.latency.average) <= THRESHOLDS.p99_ms,
          errorRate: errorRate <= THRESHOLDS.errorRate,
          rps: result.requests.average >= THRESHOLDS.minRps,
        },
      };

      benchResult.overallPass = Object.values(benchResult.pass).every(Boolean);
      resolve(benchResult);
    });

    // 진행 상황 출력
    autocannon.track(instance, { renderProgressBar: true });
  });
}

/**
 * 결과 테이블 출력
 */
function printResults(results) {
  console.log('\n');
  console.log('='.repeat(100));
  console.log(' 공공기관 SaaS 프레임워크 -- 성능 벤치마크 결과');
  console.log('='.repeat(100));
  console.log(
    `${'엔드포인트'.padEnd(30)} ${'RPS'.padStart(8)} ${'P95(ms)'.padStart(10)} ${'P99(ms)'.padStart(10)} ${'에러율'.padStart(10)} ${'결과'.padStart(8)}`
  );
  console.log('-'.repeat(100));

  for (const r of results) {
    if (r.error) {
      console.log(`${r.name.padEnd(30)} ${'ERROR'.padStart(8)} ${r.error}`);
      continue;
    }

    const passStr = r.overallPass ? 'PASS' : 'FAIL';
    console.log(
      `${r.name.padEnd(30)} ${String(r.rps).padStart(8)} ${String(r.latency.p95.toFixed(1)).padStart(10)} ${String(r.latency.p99.toFixed(1)).padStart(10)} ${r.errorRate.padStart(10)} ${passStr.padStart(8)}`
    );
  }

  console.log('-'.repeat(100));

  const allPassed = results.every((r) => r.error || r.overallPass);
  console.log(`\n전체 결과: ${allPassed ? 'ALL PASS' : 'FAIL'}`);
  console.log(`기준: P95 < ${THRESHOLDS.p95_ms}ms, P99 < ${THRESHOLDS.p99_ms}ms, 에러율 < ${THRESHOLDS.errorRate * 100}%, RPS > ${THRESHOLDS.minRps}`);
  console.log(`설정: duration=${DURATION}s, connections=${CONNECTIONS}`);
  console.log('='.repeat(100));
}

/**
 * 메인 실행
 */
async function main() {
  console.log('='.repeat(60));
  console.log(' 공공기관 SaaS 프레임워크 -- 성능 벤치마크');
  console.log(`  대상: ${BASE_URL}`);
  console.log(`  기간: ${DURATION}s | 동시 연결: ${CONNECTIONS}`);
  console.log('='.repeat(60));

  for (const endpoint of ENDPOINTS) {
    console.log(`\n>> ${endpoint.name} (${endpoint.method} ${endpoint.path})`);

    try {
      const result = await runBenchmark(endpoint, null);
      results.push(result);
    } catch (err) {
      results.push({
        name: endpoint.name,
        path: endpoint.path,
        error: err.message,
        pass: false,
      });
    }
  }

  printResults(results);

  // JSON 리포트 저장
  const reportPath = join(__dirname, '..', '..', 'docs', 'benchmark-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    duration: DURATION,
    connections: CONNECTIONS,
    thresholds: THRESHOLDS,
    results,
  };

  try {
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n리포트 저장: ${reportPath}`);
  } catch {
    console.log('\n리포트 저장 실패 (docs 디렉토리 확인)');
    // stdout으로 대체 출력
    console.log(JSON.stringify(report, null, 2));
  }

  // 실패 시 exit code 1
  const allPassed = results.every((r) => r.error || r.overallPass);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('벤치마크 실행 실패:', err.message);
  process.exit(1);
});
