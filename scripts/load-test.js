#!/usr/bin/env node
// Design Ref: MTU-N33 Design -- 부하 테스트 설계
// Plan SC: FR-N33.2
// CSAP: NFR (비기능 요건 성능 검증)

'use strict';

const { execSync } = require('child_process');

const API_GATEWAY = process.env.API_GATEWAY_URL || 'http://localhost:32276';
const DURATION = parseInt(process.env.LOAD_TEST_DURATION || '30', 10);
const CONNECTIONS = parseInt(process.env.LOAD_TEST_CONNECTIONS || '10', 10);
const COOLDOWN = 5;

const scenarios = [
  {
    title: 'S1: Health Check (기준선)',
    url: `${API_GATEWAY}/health`,
    connections: CONNECTIONS,
    duration: DURATION,
    description: 'API Gateway /health 엔드포인트 기준선 측정',
  },
  {
    title: 'S2: Auth 서비스 라우팅',
    url: `${API_GATEWAY}/api/auth/health`,
    connections: CONNECTIONS,
    duration: DURATION,
    description: 'API Gateway -> Auth Service 라우팅 성능',
  },
  {
    title: 'S3: 동시 접속 부하',
    url: `${API_GATEWAY}/health`,
    connections: 50,
    duration: 15,
    description: '50 동시 접속 시 성능 한계 측정',
  },
];

function formatDate() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function runScenario(scenario, index) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${formatDate()}] 시나리오 ${index + 1}/${scenarios.length}: ${scenario.title}`);
  console.log(`설명: ${scenario.description}`);
  console.log(`URL: ${scenario.url}`);
  console.log(`접속 수: ${scenario.connections}, 시간: ${scenario.duration}초`);
  console.log('='.repeat(60));

  try {
    const cmd = `npx autocannon -c ${scenario.connections} -d ${scenario.duration} -j ${scenario.url}`;
    const result = execSync(cmd, {
      timeout: (scenario.duration + 60) * 1000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const data = JSON.parse(result);

    console.log('\n--- 결과 ---');
    console.log(`  요청 총수:     ${data.requests?.total || 'N/A'}`);
    console.log(`  TPS (평균):    ${data.requests?.average || 'N/A'} req/s`);
    console.log(`  응답시간 P50:  ${data.latency?.p50 || 'N/A'} ms`);
    console.log(`  응답시간 P95:  ${data.latency?.p95 || 'N/A'} ms`);
    console.log(`  응답시간 P99:  ${data.latency?.p99 || 'N/A'} ms`);
    console.log(`  처리량:        ${formatBytes(data.throughput?.average || 0)}/s`);
    console.log(`  에러 수:       ${data.errors || 0}`);
    console.log(`  타임아웃:      ${data.timeouts || 0}`);
    console.log(`  Non-2xx:       ${data.non2xx || 0}`);

    const errorRate =
      data.requests?.total > 0
        ? ((((data.errors || 0) + (data.non2xx || 0)) / data.requests.total) * 100).toFixed(2)
        : '0.00';
    console.log(`  에러율:        ${errorRate}%`);

    return {
      title: scenario.title,
      totalRequests: data.requests?.total || 0,
      avgTPS: data.requests?.average || 0,
      p50: data.latency?.p50 || 0,
      p95: data.latency?.p95 || 0,
      p99: data.latency?.p99 || 0,
      errors: (data.errors || 0) + (data.non2xx || 0),
      errorRate: parseFloat(errorRate),
      throughput: data.throughput?.average || 0,
    };
  } catch (err) {
    console.error(`  오류: ${err.message}`);
    return {
      title: scenario.title,
      error: err.message,
      totalRequests: 0,
      avgTPS: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      errors: -1,
      errorRate: 100,
      throughput: 0,
    };
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function sleep(seconds) {
  execSync(`sleep ${seconds}`);
}

// Main
console.log('='.repeat(60));
console.log('공공기관 SaaS 프레임워크 -- 부하 테스트');
console.log(`시작: ${formatDate()}`);
console.log(`대상: ${API_GATEWAY}`);
console.log(`기본 접속 수: ${CONNECTIONS}, 기본 시간: ${DURATION}초`);
console.log('='.repeat(60));

const results = [];

for (let i = 0; i < scenarios.length; i++) {
  const result = runScenario(scenarios[i], i);
  results.push(result);

  if (i < scenarios.length - 1) {
    console.log(`\n쿨다운 ${COOLDOWN}초...`);
    sleep(COOLDOWN);
  }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('종합 결과 요약');
console.log('='.repeat(60));
console.log('| 시나리오 | TPS | P50 | P95 | P99 | 에러율 |');
console.log('|---------|-----|-----|-----|-----|--------|');
for (const r of results) {
  if (r.error) {
    console.log(`| ${r.title} | ERROR | - | - | - | - |`);
  } else {
    console.log(`| ${r.title} | ${r.avgTPS} | ${r.p50}ms | ${r.p95}ms | ${r.p99}ms | ${r.errorRate}% |`);
  }
}

console.log(`\n완료: ${formatDate()}`);
console.log('='.repeat(60));

// Exit with error if any scenario failed badly
const hasError = results.some((r) => r.error || r.errorRate > 50);
process.exit(hasError ? 1 : 0);
