# 실습 19: 고급 부하 테스트 — k6 스크립트 작성부터 병목 분석까지

**문서 ID**: ONBOARD-EXERCISE-19
**버전**: 1.0.0
**작성일**: 2026-04-13
**목적**: k6를 사용하여 실제 서비스의 최대 처리량을 측정하고 병목 지점을 발견하여 최적화하는 능력을 습득한다.
**선행 학습**: `09-performance-testing.md`, `03-monitoring-lab.md`, `02-service-development.md`
**소요 시간**: 약 4시간
**난이도**: 고급

---

## 목차

1. [실습 개요](#1-실습-개요)
2. [k6 스크립트 고급 작성](#2-k6-스크립트-고급-작성)
3. [실습 1: auth-service 부하 테스트](#3-실습-1-auth-service-부하-테스트)
4. [실습 2: AI API 부하 테스트](#4-실습-2-ai-api-부하-테스트)
5. [실습 3: 데이터베이스 병목 분석](#5-실습-3-데이터베이스-병목-분석)
6. [성능 개선 사이클](#6-성능-개선-사이클)
7. [채점 기준](#7-채점-기준)
8. [변경 이력](#변경-이력)

---

## 1. 실습 개요

### 1.1 이 실습의 목표

부하 테스트는 "서비스가 얼마나 많은 요청을 처리할 수 있는가"를 측정하는 과정입니다. 단순히 서버가 죽지 않는다는 것을 확인하는 것이 아니라, 다음 질문에 답하는 것이 목표입니다.

- 이 서비스의 최대 초당 처리 요청 수(TPS, Transactions Per Second)는 얼마인가?
- 어디에서 병목이 발생하는가? CPU인가, 메모리인가, DB인가, 네트워크인가?
- SLO를 위반하기 시작하는 부하 수준은 어디인가? (임계점, Break Point)
- 병목을 해결하면 TPS가 얼마나 개선되는가?

이 실습에서는 세 가지 핵심 시나리오를 다룹니다.

- 실습 1: auth-service 로그인 API 1000 VU(가상 사용자) 부하 테스트
- 실습 2: AI 서비스 비동기 스트리밍 동시 요청 한계 탐지
- 실습 3: PostgreSQL 병목 분석 및 인덱스 최적화

### 1.2 사전 준비

```bash
# k6 설치 (Linux/WSL2)
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# 버전 확인
k6 version
# k6 v0.50.0 (go1.21.x, linux/amd64)

# Grafana 대시보드 확인 (k6 결과 시각화)
# http://localhost:3000 → k6 대시보드 확인
```

환경 변수 설정:
```bash
# 부하 테스트 환경 변수
export K6_BASE_URL="http://localhost:3000"   # API Gateway
export K6_AUTH_URL="http://localhost:3001"   # auth-service 직접
export K6_AI_URL="http://localhost:3005"     # ai-service 직접

# 테스트용 계정 (별도 테스트 테넌트)
export K6_TEST_EMAIL="loadtest@test.public-saas.kr"
export K6_TEST_PASSWORD="LoadTest2026!"
export K6_TEST_TENANT_ID="tenant-loadtest-001"
```

### 1.3 부하 테스트 사이클 플로우

```mermaid
flowchart TD
    A[시작: 서비스 상태 확인] --> B[k6 스크립트 작성]
    B --> C[소규모 검증 실행<br/>VU=10, 1분]
    C --> D{오류 없음?}
    D -->|No| E[스크립트 디버그]
    E --> C
    D -->|Yes| F[본 부하 테스트 실행<br/>VU 단계별 증가]

    F --> G[Grafana 실시간 모니터링]
    G --> H{SLO 위반 감지?}
    H -->|No| I[VU 증가 계속]
    I --> F
    H -->|Yes| J[임계점 기록]

    J --> K[병목 분석]
    K --> L{병목 유형}

    L -->|CPU| M[로직 최적화<br/>알고리즘 개선]
    L -->|DB| N[인덱스 추가<br/>쿼리 최적화<br/>커넥션 풀 조정]
    L -->|메모리| O[메모리 누수 수정<br/>캐시 설정 조정]
    L -->|네트워크| P[커넥션 재사용<br/>압축 활성화]

    M & N & O & P --> Q[최적화 적용]
    Q --> R[재테스트]
    R --> S[Before/After 비교 보고서]
    S --> T[완료]

    style A fill:#e8f4f8
    style J fill:#ffe8e8
    style T fill:#e8ffe8
    style K fill:#fff3e0
```

---

## 2. k6 스크립트 고급 작성

### 2.1 k6 핵심 개념

k6에서 알아야 할 핵심 용어입니다.

**VU (Virtual User)**: 동시에 요청을 보내는 가상 사용자 수. VU가 100이면 100명이 동시에 요청을 보내는 것과 같습니다.

**Iteration**: 각 VU가 스크립트를 실행하는 횟수. VU가 100이고 각 VU가 10번 반복하면 총 1000번 요청합니다.

**Throughput**: 초당 처리되는 요청 수 (RPS, Requests Per Second 또는 TPS).

**p95 레이턴시**: 전체 요청 중 95%가 이 시간 이내에 완료됨을 의미합니다. 평균보다 신뢰성 있는 성능 지표입니다.

**Error Rate**: 전체 요청 중 오류(4xx, 5xx)가 발생한 비율.

### 2.2 Ramping VU 패턴

현실적인 부하는 갑자기 늘어나지 않습니다. Ramping VU 패턴으로 부하를 단계별로 증가시킵니다.

```javascript
// scripts/ramping-vus.js
// Ramping VU 패턴: 0 → 100 → 500 → 100 → 0

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// 커스텀 메트릭 정의
const errorRate = new Rate('custom_error_rate');
const loginDuration = new Trend('login_duration_ms');
const successfulLogins = new Counter('successful_logins');

export const options = {
  // 단계별 VU 증가 (Ramping)
  stages: [
    { duration: '2m',  target: 100  }, // 2분간 0 → 100 VU
    { duration: '5m',  target: 100  }, // 5분간 100 VU 유지 (워밍업)
    { duration: '5m',  target: 500  }, // 5분간 100 → 500 VU (점진 증가)
    { duration: '10m', target: 500  }, // 10분간 500 VU 유지 (최대 부하)
    { duration: '3m',  target: 100  }, // 3분간 500 → 100 VU (쿨다운)
    { duration: '2m',  target: 0    }, // 2분간 100 → 0 VU (종료)
  ],

  // 임계값: 이 기준을 초과하면 테스트 실패
  thresholds: {
    // p95 레이턴시 500ms 이하
    'http_req_duration': ['p(95)<500'],

    // 로그인 전용 p95 레이턴시 300ms 이하
    'login_duration_ms': ['p(95)<300'],

    // 에러율 1% 이하
    'custom_error_rate': ['rate<0.01'],

    // HTTP 오류율 0.5% 이하
    'http_req_failed': ['rate<0.005'],
  },
};
```

### 2.3 Threshold 설정 (SLO 연계)

Threshold는 SLO(서비스 수준 목표)와 직접 연결됩니다. 이 프로젝트의 SLO를 k6 Threshold로 표현합니다.

```javascript
// SLO 기반 Threshold 설정
export const options = {
  thresholds: {
    // SLO-1: API 응답 시간
    // 목표: 99%의 요청이 1초 이내
    'http_req_duration': [
      'p(50)<100',   // 중앙값 100ms
      'p(95)<500',   // 95분위 500ms
      'p(99)<1000',  // 99분위 1000ms (SLO 임계값)
    ],

    // SLO-2: 가용성
    // 목표: 에러율 0.1% 이하
    'http_req_failed': ['rate<0.001'],

    // SLO-3: 처리량 (최소 보장)
    // 목표: 초당 100 RPS 이상 처리
    'http_reqs': ['rate>100'],
  },
};
```

### 2.4 Scenario 병렬 실행

현실에서는 로그인과 API 호출이 동시에 발생합니다. 복수 시나리오를 병렬로 실행합니다.

```javascript
// scripts/multi-scenario.js
// 로그인 + API 조회를 동시 시나리오로 병렬 실행

export const options = {
  scenarios: {
    // 시나리오 1: 로그인 플로우
    login_flow: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 0 },
      ],
      exec: 'loginScenario',  // 아래 loginScenario 함수 실행
      tags: { scenario: 'login' },
    },

    // 시나리오 2: 구독 조회 (인증된 사용자)
    subscription_query: {
      executor: 'ramping-vus',
      startTime: '1m',  // 1분 후 시작 (로그인 후)
      stages: [
        { duration: '2m', target: 200 },
        { duration: '8m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      exec: 'subscriptionQueryScenario',
      tags: { scenario: 'subscription-query' },
    },

    // 시나리오 3: 인보이스 조회
    billing_query: {
      executor: 'constant-arrival-rate',
      rate: 50,         // 초당 50 RPS 고정
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 100,
      maxVUs: 500,
      exec: 'billingQueryScenario',
      tags: { scenario: 'billing-query' },
    },
  },
};

// 시나리오 1: 로그인
export function loginScenario() {
  const response = http.post(
    `${__ENV.K6_AUTH_URL}/auth/login`,
    JSON.stringify({
      email: __ENV.K6_TEST_EMAIL,
      password: __ENV.K6_TEST_PASSWORD,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  check(response, {
    'login status 200': (r) => r.status === 200,
    'has token': (r) => r.json('data.accessToken') !== undefined,
  });

  sleep(1);
}

// 시나리오 2: 구독 조회
export function subscriptionQueryScenario() {
  const token = getOrRefreshToken();  // 토큰 캐싱
  const response = http.get(
    `${__ENV.K6_BASE_URL}/subscription/plans`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  check(response, {
    'plans status 200': (r) => r.status === 200,
    'has plans data': (r) => r.json('data') !== undefined,
  });

  sleep(0.5);
}

// 시나리오 3: 인보이스 조회
export function billingQueryScenario() {
  const token = getOrRefreshToken();
  const response = http.get(
    `${__ENV.K6_BASE_URL}/billing/invoices`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  check(response, {
    'invoices status 200': (r) => r.status === 200,
  });

  sleep(0.2);
}
```

---

## 3. 실습 1: auth-service 부하 테스트

### 3.1 목표

- auth-service 로그인 API의 최대 TPS 측정
- JWT 생성 처리량 한계 파악
- Redis 세션 스토어 병목 탐지

### 3.2 테스트 스크립트 작성

```javascript
// scripts/auth-load-test.js
// auth-service 로그인 API 1000 VU 부하 테스트

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const loginErrors = new Rate('login_errors');
const loginDuration = new Trend('login_duration_ms', true); // true = ms 단위
const jwtValidationDuration = new Trend('jwt_validation_ms', true);
const successCount = new Counter('login_success_count');

export const options = {
  stages: [
    { duration: '1m',  target: 100  }, // 워밍업
    { duration: '3m',  target: 100  }, // 안정 상태 확인
    { duration: '5m',  target: 500  }, // 중간 부하
    { duration: '5m',  target: 1000 }, // 최대 부하 (1000 VU)
    { duration: '3m',  target: 100  }, // 쿨다운
    { duration: '1m',  target: 0    }, // 종료
  ],

  thresholds: {
    'login_duration_ms': ['p(95)<300', 'p(99)<1000'],
    'login_errors': ['rate<0.01'],
    'jwt_validation_ms': ['p(95)<50'],
    'http_req_duration': ['p(95)<500'],
  },
};

// 테스트 데이터 (여러 계정으로 분산 요청 — 실제 패턴 모방)
const testAccounts = [
  { email: 'load-test-1@test.public-saas.kr', password: 'TestPass2026!' },
  { email: 'load-test-2@test.public-saas.kr', password: 'TestPass2026!' },
  { email: 'load-test-3@test.public-saas.kr', password: 'TestPass2026!' },
  // ... 50개 테스트 계정
];

export default function () {
  // VU ID를 기반으로 계정 선택 (균등 분산)
  const account = testAccounts[__VU % testAccounts.length];

  group('로그인 플로우', () => {
    // Step 1: 로그인
    const loginStart = Date.now();
    const loginRes = http.post(
      `${__ENV.K6_AUTH_URL}/auth/login`,
      JSON.stringify(account),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'login' },
      },
    );
    loginDuration.add(Date.now() - loginStart);

    const loginOk = check(loginRes, {
      '로그인 성공 (200)': (r) => r.status === 200,
      '토큰 존재': (r) => {
        try {
          return r.json('data.accessToken') !== undefined;
        } catch { return false; }
      },
      '응답 형식 유효': (r) => r.json('success') === true,
    });

    loginErrors.add(!loginOk);
    if (!loginOk) {
      console.error(`로그인 실패: VU=${__VU}, status=${loginRes.status}, body=${loginRes.body?.slice(0, 200)}`);
      sleep(1);
      return;
    }

    successCount.add(1);
    const token = loginRes.json('data.accessToken');

    // Step 2: JWT 검증 테스트 (보호된 API 호출)
    const jwtStart = Date.now();
    const profileRes = http.get(
      `${__ENV.K6_AUTH_URL}/auth/me`,
      {
        headers: { Authorization: `Bearer ${token}` },
        tags: { name: 'jwt_validation' },
      },
    );
    jwtValidationDuration.add(Date.now() - jwtStart);

    check(profileRes, {
      'JWT 검증 성공 (200)': (r) => r.status === 200,
      'JWT 검증 속도 (<50ms)': () => (Date.now() - jwtStart) < 50,
    });

    // Step 3: 로그아웃
    http.post(
      `${__ENV.K6_AUTH_URL}/auth/logout`,
      null,
      {
        headers: { Authorization: `Bearer ${token}` },
        tags: { name: 'logout' },
      },
    );

    sleep(Math.random() * 2 + 0.5); // 0.5 ~ 2.5초 대기 (실제 사용 패턴)
  });
}

// 테스트 완료 후 리포트 출력
export function handleSummary(data) {
  return {
    'reports/auth-load-test-summary.json': JSON.stringify(data, null, 2),
    stdout: `
=== auth-service 부하 테스트 결과 ===
요청 총 수:      ${data.metrics.http_reqs.values.count}
성공 로그인:     ${data.metrics.login_success_count?.values.count ?? 0}
에러율:          ${(data.metrics.login_errors.values.rate * 100).toFixed(2)}%
로그인 p95:      ${data.metrics.login_duration_ms.values['p(95)'].toFixed(0)}ms
JWT 검증 p95:    ${data.metrics.jwt_validation_ms.values['p(95)'].toFixed(0)}ms
최대 VU:         1000
    `,
  };
}
```

### 3.3 JWT 검증 처리량 측정

JWT 검증은 모든 API 요청에서 발생하는 핵심 작업입니다. 처리량이 부족하면 전체 시스템이 느려집니다.

```javascript
// JWT 검증 전용 스크립트 (처리량 측정)
// scripts/jwt-throughput.js

import http from 'k6/http';
import { check } from 'k6';

export const options = {
  // constant-arrival-rate: 초당 고정 요청 수 유지
  scenarios: {
    jwt_throughput: {
      executor: 'constant-arrival-rate',
      rate: 1000,        // 초당 1000 요청 시도
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 100,
      maxVUs: 2000,       // 필요 시 최대 2000 VU
    },
  },

  thresholds: {
    // JWT 검증은 50ms 이내 완료되어야 함
    'http_req_duration{name:jwt_check}': ['p(95)<50'],
    'http_req_failed{name:jwt_check}': ['rate<0.001'],
  },
};

// 사전에 발급된 장기 토큰 사용 (테스트 전용)
const LONG_LIVED_TOKEN = __ENV.K6_TEST_TOKEN;

export default function () {
  const res = http.get(
    `${__ENV.K6_AUTH_URL}/auth/me`,
    {
      headers: { Authorization: `Bearer ${LONG_LIVED_TOKEN}` },
      tags: { name: 'jwt_check' },
    },
  );

  check(res, {
    'JWT 검증 200': (r) => r.status === 200,
  });
}
```

### 3.4 Redis 세션 스토어 병목 탐지

Redis가 JWT 블랙리스트와 세션을 저장합니다. Redis 과부하 시 다음 증상이 나타납니다.

```bash
# Redis 모니터링 명령 (부하 테스트 중 실행)

# Redis 초당 명령 처리량 확인
watch -n 1 'redis-cli INFO stats | grep instantaneous_ops_per_sec'

# Redis 연결 수 확인
redis-cli INFO clients | grep connected_clients

# 느린 쿼리 로그 확인 (10ms 이상)
redis-cli SLOWLOG GET 10

# Redis 메모리 사용량
redis-cli INFO memory | grep used_memory_human

# 키 공간 통계 (세션, 블랙리스트 키 수)
redis-cli INFO keyspace
```

Redis 병목 신호:
- `instantaneous_ops_per_sec` 값이 갑자기 떨어짐
- `blocked_clients` 값 증가
- `SLOWLOG`에 10ms 이상 명령 다수 등장
- k6에서 JWT 검증 p95가 50ms를 초과

해결책:
```bash
# Redis 연결 풀 크기 조정 (환경 변수)
REDIS_MAX_CONNECTIONS=100   # 현재 설정
REDIS_MAX_CONNECTIONS=500   # 조정 후

# Redis 클러스터 추가 노드 투입
# k3s Redis StatefulSet 레플리카 수 증가
kubectl scale statefulset redis-cluster --replicas=3 -n platform
```

### 3.5 Grafana 실시간 모니터링

```bash
# k6 결과를 Grafana로 실시간 전송
K6_OUT=influxdb=http://localhost:8086/k6 k6 run scripts/auth-load-test.js

# 또는 Prometheus remote_write 사용
K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
k6 run --out experimental-prometheus-rw scripts/auth-load-test.js
```

Grafana에서 확인할 패널:
1. `k6 Overview` → 전체 RPS, 에러율, VU 수
2. `k6 HTTP Metrics` → 엔드포인트별 레이턴시 분포
3. `Node Exporter` → CPU/메모리 사용률
4. `Redis Exporter` → Redis ops/sec, 연결 수

---

## 4. 실습 2: AI API 부하 테스트

### 4.1 목표

- AI 서비스 동시 요청 한계 탐지
- 스트리밍 응답의 레이턴시 측정
- SLO 위반 발생 지점 확인

### 4.2 AI 엔드포인트 특수성

AI API는 일반 REST API와 다릅니다.

- **응답 시간이 김**: 토큰 생성에 수 초~수십 초가 걸립니다.
- **스트리밍 응답**: Server-Sent Events(SSE)로 토큰을 실시간 전송합니다.
- **비용 지출**: 실제 LLM API를 호출하므로 테스트 횟수를 제한합니다.
- **레이트 리밋**: 외부 AI API의 RPM(분당 요청 수) 제한이 있습니다.

```javascript
// scripts/ai-load-test.js
// AI API 부하 테스트 — 스트리밍 응답 처리

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Gauge } from 'k6/metrics';

const firstTokenLatency = new Trend('ai_first_token_latency_ms', true);
const totalResponseDuration = new Trend('ai_total_response_ms', true);
const streamTokensPerSecond = new Trend('ai_tokens_per_second');
const aiErrorRate = new Rate('ai_error_rate');
const concurrentAiRequests = new Gauge('ai_concurrent_requests');

export const options = {
  // AI API는 응답이 느리므로 VU를 낮게 유지
  stages: [
    { duration: '1m', target: 5  },   // 5 VU (매우 낮게 시작)
    { duration: '3m', target: 10 },   // 10 VU
    { duration: '5m', target: 20 },   // 20 VU (한계점 탐색)
    { duration: '5m', target: 30 },   // 30 VU
    { duration: '3m', target: 10 },   // 쿨다운
    { duration: '1m', target: 0  },
  ],

  thresholds: {
    // AI API SLO: 첫 토큰 2초 이내
    'ai_first_token_latency_ms': ['p(95)<2000'],

    // 전체 응답 30초 이내 (긴 응답 허용)
    'ai_total_response_ms': ['p(95)<30000'],

    // AI 에러율 5% 이하 (레이트 리밋 포함)
    'ai_error_rate': ['rate<0.05'],
  },
};

// N2SF O 등급 데이터만 사용 (테스트 프롬프트)
// 주의: 실제 기관 데이터 절대 금지 (CSAP N2SF 요건)
const testPrompts = [
  '공공기관 SaaS 플랫폼의 장점을 3가지 나열하세요.',
  '클라우드 보안의 중요성에 대해 설명하세요.',
  '마이크로서비스 아키텍처의 특징은 무엇인가요?',
  'DevOps와 DevSecOps의 차이점을 설명하세요.',
  'CSAP 인증의 목적은 무엇인가요?',
];

export default function () {
  const token = __ENV.K6_TEST_TOKEN;
  const prompt = testPrompts[Math.floor(Math.random() * testPrompts.length)];

  concurrentAiRequests.add(1);

  const startTime = Date.now();
  let firstTokenReceived = false;
  let tokenCount = 0;

  // SSE 스트리밍 응답 처리
  const response = http.post(
    `${__ENV.K6_AI_URL}/ai/chat`,
    JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      // N2SF 데이터 등급 명시 (O 등급 — AI 전송 허용)
      dataGrade: 'O',
    }),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      tags: { name: 'ai_chat' },
      timeout: '60s',  // AI 응답 최대 60초 대기
    },
  );

  // 첫 번째 토큰까지의 레이턴시 측정
  if (response.status === 200 && !firstTokenReceived) {
    firstTokenLatency.add(Date.now() - startTime);
    firstTokenReceived = true;
  }

  const totalDuration = Date.now() - startTime;
  totalResponseDuration.add(totalDuration);

  const ok = check(response, {
    'AI API 200': (r) => r.status === 200,
    'AI 응답 있음': (r) => r.body && r.body.length > 0,
    'AI 첫 토큰 2초 이내': () => !firstTokenReceived || firstTokenLatency.values !== undefined,
  });

  aiErrorRate.add(!ok);
  concurrentAiRequests.add(-1);

  // AI 응답 후 충분한 대기 (실제 사용 패턴: 응답 읽고 다음 질문)
  sleep(Math.random() * 5 + 2); // 2 ~ 7초 대기
}
```

### 4.3 토큰 사용량 vs 레이턴시 관계 분석

```javascript
// 토큰 수에 따른 레이턴시 변화 분석 스크립트
// scripts/ai-token-latency.js

import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const shortPromptLatency = new Trend('ai_short_prompt_ms', true);   // < 100 토큰
const mediumPromptLatency = new Trend('ai_medium_prompt_ms', true); // 100-500 토큰
const longPromptLatency = new Trend('ai_long_prompt_ms', true);     // > 500 토큰

export const options = {
  scenarios: {
    short_prompts: {
      executor: 'constant-vus',
      vus: 5,
      duration: '3m',
      exec: 'shortPromptTest',
    },
    medium_prompts: {
      executor: 'constant-vus',
      vus: 5,
      duration: '3m',
      exec: 'mediumPromptTest',
    },
    long_prompts: {
      executor: 'constant-vus',
      vus: 3,      // 긴 프롬프트는 VU 적게
      duration: '3m',
      exec: 'longPromptTest',
    },
  },
};

export function shortPromptTest() {
  const start = Date.now();
  const res = http.post(
    `${__ENV.K6_AI_URL}/ai/chat`,
    JSON.stringify({ messages: [{ role: 'user', content: '안녕하세요.' }], dataGrade: 'O' }),
    { headers: { Authorization: `Bearer ${__ENV.K6_TEST_TOKEN}`, 'Content-Type': 'application/json' }, timeout: '30s' },
  );
  shortPromptLatency.add(Date.now() - start);
  check(res, { 'short prompt ok': (r) => r.status === 200 });
}

export function mediumPromptTest() {
  const start = Date.now();
  const res = http.post(
    `${__ENV.K6_AI_URL}/ai/chat`,
    JSON.stringify({
      messages: [{ role: 'user', content: '클라우드 컴퓨팅의 역사와 현재 동향, 그리고 공공기관에서의 활용 사례를 상세하게 설명해주세요.' }],
      dataGrade: 'O',
    }),
    { headers: { Authorization: `Bearer ${__ENV.K6_TEST_TOKEN}`, 'Content-Type': 'application/json' }, timeout: '45s' },
  );
  mediumPromptLatency.add(Date.now() - start);
  check(res, { 'medium prompt ok': (r) => r.status === 200 });
}

export function longPromptTest() {
  const start = Date.now();
  const res = http.post(
    `${__ENV.K6_AI_URL}/ai/chat`,
    JSON.stringify({
      messages: [{
        role: 'user',
        content: '공공기관 정보화 사업에서 SaaS 도입 시 고려해야 할 보안 요건, 기술 요건, 법적 요건, 운영 요건을 각각 상세히 설명하고, CSAP 중등급 인증을 취득하기 위한 단계별 절차와 각 단계에서 필요한 산출물을 목록으로 작성해주세요.',
      }],
      dataGrade: 'O',
    }),
    { headers: { Authorization: `Bearer ${__ENV.K6_TEST_TOKEN}`, 'Content-Type': 'application/json' }, timeout: '60s' },
  );
  longPromptLatency.add(Date.now() - start);
  check(res, { 'long prompt ok': (r) => r.status === 200 });
}
```

### 4.4 동시 요청 한계 탐지 + SLO 위반 흐름

```mermaid
graph TD
    A["부하 증가 시작<br/>VU = 5"] --> B["레이턴시 측정<br/>p95 < 2초 (정상)"]
    B --> C["VU = 10<br/>p95 = 1.8초 (정상)"]
    C --> D["VU = 20<br/>p95 = 3.2초 ⚠️"]

    D --> E{SLO 위반?}
    E -->|p95 > 2초| F["SLO 위반 감지!<br/>VU = 20 = 임계점"]

    F --> G["원인 분석"]
    G --> H{병목 위치}

    H -->|"외부 AI API 레이트 리밋"| I["AI Gateway 큐잉 도입<br/>동시 요청 수 제한"]
    H -->|"컨텍스트 메모리 부족"| J["인스턴스 메모리 증설<br/>또는 스트리밍 청크 축소"]
    H -->|"DB 병목 (히스토리 저장)"| K["히스토리 비동기 저장<br/>Redis 임시 버퍼 사용"]

    I & J & K --> L["최적화 적용"]
    L --> M["재테스트<br/>VU = 20"]
    M --> N["p95 = 1.5초 (개선 확인)"]
    N --> O["VU = 30으로 재도전"]

    style F fill:#ffe8e8
    style N fill:#e8ffe8
```

---

## 5. 실습 3: 데이터베이스 병목 분석

### 5.1 목표

- PostgreSQL 동시 쿼리 분석
- Connection Pool 고갈 패턴 탐지
- 인덱스 부재 쿼리 식별 및 최적화

### 5.2 pg_stat_activity 동시 쿼리 분석

부하 테스트 중에 PostgreSQL에서 다음 쿼리를 실행하면 동시 접속 현황을 볼 수 있습니다.

```sql
-- 부하 테스트 중 실시간 모니터링

-- 1. 현재 실행 중인 쿼리 목록
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '1 second'
  AND state != 'idle'
ORDER BY duration DESC
LIMIT 20;

-- 2. 상태별 연결 수 집계
SELECT
  state,
  COUNT(*) AS connection_count,
  MAX(now() - query_start) AS max_duration
FROM pg_stat_activity
WHERE datname = 'public_saas_db'
GROUP BY state;

-- 3. 테이블별 락 대기 상황
SELECT
  blocked.pid AS blocked_pid,
  blocked.query AS blocked_query,
  blocking.pid AS blocking_pid,
  blocking.query AS blocking_query
FROM pg_stat_activity AS blocked
JOIN pg_stat_activity AS blocking
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE cardinality(pg_blocking_pids(blocked.pid)) > 0;
```

### 5.3 Connection Pool 고갈 패턴 탐지

Prisma(이 프로젝트의 ORM)의 Connection Pool이 고갈되면 새 요청이 대기합니다. 이는 레이턴시 급증의 주요 원인입니다.

```bash
# 부하 테스트 중 PostgreSQL 연결 수 모니터링
watch -n 2 'psql -U postgres -d public_saas_db -c "
SELECT
  MAX(numbackends) AS total_connections,
  current_setting('"'"'max_connections'"'"')::int AS max_allowed,
  (MAX(numbackends)::float / current_setting('"'"'max_connections'"'"')::int * 100)::int AS usage_pct
FROM pg_stat_database
WHERE datname = '"'"'public_saas_db'"'"';
"'
```

Connection Pool 고갈 신호:
- `pg_stat_activity`에서 `state = 'idle in transaction'`이 쌓임
- Prisma 로그에 `Can't reach database server` 또는 `Connection pool timeout` 오류
- k6에서 DB 관련 API의 레이턴시가 갑자기 수 초로 증가

```typescript
// Prisma Connection Pool 설정 최적화
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // connection_limit: 서비스당 최대 연결 수
  // pool_timeout: 연결 대기 최대 시간 (초)
}

// 환경 변수로 Pool 설정
// DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=30"
// 기본값: connection_limit=5 (너무 낮음)
// 권장: 서비스별 (CPU 코어 수 × 2 + 1) ~ (CPU 코어 수 × 10)
```

k6 스크립트로 Connection Pool 고갈 재현:

```javascript
// scripts/db-pool-exhaustion.js
// Connection Pool 고갈 패턴 재현

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  // 급격한 VU 증가로 Connection Pool 고갈 재현
  stages: [
    { duration: '10s', target: 10 },
    { duration: '10s', target: 100 },  // 급격히 증가
    { duration: '10s', target: 500 },  // Pool 고갈 유발
    { duration: '30s', target: 500 },  // 유지
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'],
    'http_req_failed': ['rate<0.1'],
  },
};

export default function () {
  const token = __ENV.K6_TEST_TOKEN;

  // DB 집약적 쿼리 (여러 테이블 JOIN)
  const res = http.get(
    `${__ENV.K6_BASE_URL}/billing/invoices?includeSubscription=true&includeTenant=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  check(res, {
    '인보이스 조회 성공': (r) => r.status === 200,
    'DB 응답 1초 이내': (r) => r.timings.duration < 1000,
  });

  sleep(0.1); // 짧은 대기 = 높은 동시성
}
```

### 5.4 인덱스 부재 쿼리 식별

느린 쿼리는 대부분 인덱스가 없는 컬럼을 WHERE 절에서 사용하기 때문입니다.

```sql
-- 1. 느린 쿼리 상위 10개 (pg_stat_statements 필요)
SELECT
  query,
  calls,
  total_exec_time / calls AS avg_ms,
  rows / calls AS avg_rows,
  100.0 * total_exec_time / SUM(total_exec_time) OVER () AS pct_total
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC
LIMIT 10;

-- 2. Sequential Scan (인덱스 미사용) 테이블 목록
SELECT
  schemaname,
  tablename,
  seq_scan AS sequential_scans,
  idx_scan AS index_scans,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan
  AND n_live_tup > 1000  -- 1000행 이상 테이블만
ORDER BY seq_scan DESC;

-- 3. EXPLAIN ANALYZE로 특정 쿼리 분석
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM "Invoice"
WHERE "subscriptionId" = 'sub-test-001'
  AND status = 'issued'
ORDER BY "createdAt" DESC
LIMIT 20;
-- Seq Scan이 나오면 인덱스 필요
-- Index Scan이 나오면 인덱스 적용됨
```

발견된 인덱스 추가:

```sql
-- 자주 조회되는 패턴에 인덱스 추가
-- (billing-service: tenantId로 인보이스 조회)
CREATE INDEX CONCURRENTLY idx_invoice_subscription_status
  ON "Invoice" ("subscriptionId", status)
  WHERE status != 'paid';  -- 부분 인덱스: 미납 인보이스만

-- (subscription-service: tenantId + status 조합)
CREATE INDEX CONCURRENTLY idx_subscription_tenant_status
  ON "Subscription" ("tenantId", status);

-- (audit-service: 시간 범위 쿼리)
CREATE INDEX CONCURRENTLY idx_auditlog_tenant_time
  ON "AuditLog" ("tenantId", "createdAt" DESC);

-- CONCURRENTLY: 운영 중 락 없이 인덱스 생성 (권장)
```

인덱스 추가 전후 성능 비교:

```bash
# 인덱스 추가 전 쿼리 성능
EXPLAIN ANALYZE SELECT * FROM "Invoice" WHERE "subscriptionId" = 'sub-001' AND status = 'issued';
# -> Seq Scan on Invoice  (cost=0.00..1543.20 rows=3 width=234) (actual time=15.432..285.123 rows=3 loops=1)
# 실제 시간: 285ms — 느림

# 인덱스 추가 후
# -> Index Scan using idx_invoice_subscription_status on Invoice
#    (cost=0.43..12.20 rows=3 width=234) (actual time=0.121..0.234 rows=3 loops=1)
# 실제 시간: 0.23ms — 1200배 개선
```

---

## 6. 성능 개선 사이클

### 6.1 병목 발견 → 코드 수정 → 재테스트

성능 개선은 한 번의 최적화로 끝나지 않습니다. 반복적인 사이클로 개선합니다.

**사이클 1: 초기 베이스라인 측정**

```bash
# 1단계: 베이스라인 부하 테스트 실행
mkdir -p reports/before
K6_OUT=json=reports/before/result.json k6 run \
  --env K6_BASE_URL=http://localhost:3000 \
  --env K6_TEST_TOKEN=${TEST_TOKEN} \
  scripts/auth-load-test.js

# 결과 요약
cat reports/before/result.json | jq '{
  p95: .metrics.http_req_duration.values["p(95)"],
  p99: .metrics.http_req_duration.values["p(99)"],
  rps: .metrics.http_reqs.values.rate,
  error_rate: .metrics.http_req_failed.values.rate
}'
```

베이스라인 결과 (예시):
```json
{
  "p95": 520,
  "p99": 1240,
  "rps": 187.4,
  "error_rate": 0.003
}
```

SLO 위반: p95 520ms > 목표 500ms

**사이클 2: 병목 분석**

```bash
# PostgreSQL 느린 쿼리 확인
psql -U postgres -d public_saas_db -c "
SELECT query, calls, total_exec_time/calls AS avg_ms
FROM pg_stat_statements
WHERE total_exec_time/calls > 100
ORDER BY avg_ms DESC LIMIT 5;"
```

발견: `SELECT * FROM AuditLog WHERE tenantId = $1 ORDER BY createdAt DESC`
→ 인덱스 없이 Sequential Scan (285ms)

**사이클 3: 최적화 적용**

```bash
# 인덱스 추가
psql -U postgres -d public_saas_db -c "
CREATE INDEX CONCURRENTLY idx_auditlog_tenant_time
ON \"AuditLog\" (\"tenantId\", \"createdAt\" DESC);"

# 완료 대기
psql -U postgres -d public_saas_db -c "
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE indexname = 'idx_auditlog_tenant_time';"
```

**사이클 4: 재테스트 및 비교**

```bash
# 최적화 후 재테스트
mkdir -p reports/after
K6_OUT=json=reports/after/result.json k6 run \
  --env K6_BASE_URL=http://localhost:3000 \
  --env K6_TEST_TOKEN=${TEST_TOKEN} \
  scripts/auth-load-test.js

# Before/After 비교
node scripts/compare-reports.js reports/before/result.json reports/after/result.json
```

### 6.2 Before/After 비교 보고서

```javascript
// scripts/compare-reports.js
// Before/After 성능 비교 리포트 생성

const [beforeFile, afterFile] = process.argv.slice(2);
const before = JSON.parse(require('fs').readFileSync(beforeFile, 'utf8'));
const after = JSON.parse(require('fs').readFileSync(afterFile, 'utf8'));

function getMetric(data, metric, stat) {
  return data.metrics[metric]?.values[stat] ?? 0;
}

const comparison = {
  'p95 레이턴시 (ms)': {
    before: getMetric(before, 'http_req_duration', 'p(95)').toFixed(0),
    after: getMetric(after, 'http_req_duration', 'p(95)').toFixed(0),
    improved: getMetric(before, 'http_req_duration', 'p(95)') > getMetric(after, 'http_req_duration', 'p(95)'),
  },
  'p99 레이턴시 (ms)': {
    before: getMetric(before, 'http_req_duration', 'p(99)').toFixed(0),
    after: getMetric(after, 'http_req_duration', 'p(99)').toFixed(0),
    improved: getMetric(before, 'http_req_duration', 'p(99)') > getMetric(after, 'http_req_duration', 'p(99)'),
  },
  '처리량 (RPS)': {
    before: getMetric(before, 'http_reqs', 'rate').toFixed(1),
    after: getMetric(after, 'http_reqs', 'rate').toFixed(1),
    improved: getMetric(before, 'http_reqs', 'rate') < getMetric(after, 'http_reqs', 'rate'),
  },
  '에러율 (%)': {
    before: (getMetric(before, 'http_req_failed', 'rate') * 100).toFixed(2),
    after: (getMetric(after, 'http_req_failed', 'rate') * 100).toFixed(2),
    improved: getMetric(before, 'http_req_failed', 'rate') > getMetric(after, 'http_req_failed', 'rate'),
  },
};

console.log('\n=== 성능 개선 비교 보고서 ===\n');
console.log('지표'.padEnd(20) + 'Before'.padEnd(12) + 'After'.padEnd(12) + '개선');
console.log('-'.repeat(50));
for (const [metric, data] of Object.entries(comparison)) {
  console.log(
    metric.padEnd(20) +
    data.before.padEnd(12) +
    data.after.padEnd(12) +
    (data.improved ? '✓ 개선됨' : '✗ 개선 필요'),
  );
}
```

예상 출력:
```
=== 성능 개선 비교 보고서 ===

지표                Before      After       개선
--------------------------------------------------
p95 레이턴시 (ms)  520         198         ✓ 개선됨
p99 레이턴시 (ms)  1240        412         ✓ 개선됨
처리량 (RPS)       187.4       423.8       ✓ 개선됨
에러율 (%)         0.30        0.05        ✓ 개선됨
```

### 6.3 DORA Change Lead Time과 성능 개선 연계

DORA(DevOps Research and Assessment) 메트릭 중 "변경 리드 타임(Change Lead Time)"은 코드 커밋부터 프로덕션 배포까지 걸리는 시간입니다. 성능 개선 작업도 이 메트릭으로 추적합니다.

```bash
# 성능 개선 작업의 Change Lead Time 측정
echo "병목 발견 시각: $(date -Iseconds)" > reports/timeline.txt

# 최적화 코드 커밋
git commit -m "perf(billing): 감사 로그 tenantId+createdAt 복합 인덱스 추가 (p95 520ms → 198ms)"
echo "커밋 시각: $(date -Iseconds)" >> reports/timeline.txt

# CI 통과 후 배포
# (자동화된 CI/CD 파이프라인)
echo "배포 완료 시각: $(date -Iseconds)" >> reports/timeline.txt

# Change Lead Time 계산
python3 -c "
from datetime import datetime
with open('reports/timeline.txt') as f:
    lines = f.readlines()
# 파싱 및 계산
print('Change Lead Time: (발견 → 배포) = X분 Y초')
"
```

엘리트 DORA 등급: Change Lead Time 1시간 이내
이 실습 목표: 병목 발견 → 커밋 → 재테스트 전체 과정 1시간 이내 완료

---

## 7. 채점 기준

### 7.1 채점 영역 및 배점

| 영역 | 배점 | 평가 방법 |
|---|---|---|
| 실습 1: auth-service 부하 테스트 | 30점 | k6 리포트 + Grafana 스크린샷 |
| 실습 2: AI API 한계 탐지 | 25점 | 임계점 VU 수 + 병목 원인 분석 |
| 실습 3: DB 병목 분석 + 최적화 | 30점 | Before/After 성능 비교 보고서 |
| 보고서 완성도 | 15점 | 분석 보고서 품질 |

### 7.2 실습 1 세부 채점 (30점)

| 항목 | 배점 | 합격 기준 |
|---|---|---|
| k6 스크립트 작성 완료 | 10점 | stages, thresholds, metrics 모두 포함 |
| 1000 VU 테스트 실행 성공 | 5점 | 오류 없이 테스트 완료 |
| p95 레이턴시 측정 | 5점 | 구체적 수치 기록 |
| Redis 병목 여부 확인 | 5점 | redis-cli 명령 실행 결과 첨부 |
| Grafana 스크린샷 | 5점 | k6 대시보드 화면 캡처 |

### 7.3 실습 2 세부 채점 (25점)

| 항목 | 배점 | 합격 기준 |
|---|---|---|
| AI API 스크립트 작성 | 8점 | 스트리밍 응답 처리 포함 |
| 동시 요청 임계점 VU 수 확인 | 7점 | SLO 위반 시작 지점 특정 |
| 병목 원인 분석 | 5점 | 레이트 리밋/메모리/DB 중 하나 특정 |
| N2SF 데이터 등급 준수 | 5점 | O 등급 데이터만 사용 확인 |

### 7.4 실습 3 세부 채점 (30점)

| 항목 | 배점 | 합격 기준 |
|---|---|---|
| Sequential Scan 쿼리 식별 | 10점 | pg_stat_statements 결과 첨부 |
| 인덱스 추가 구현 | 10점 | DDL 실행 결과 첨부 |
| Before/After 비교 | 10점 | p95 레이턴시 30% 이상 개선 |

### 7.5 채점 흐름 다이어그램

```mermaid
flowchart TD
    Submit["실습 결과물 제출"] --> Check1["실습 1 확인<br/>k6 리포트 + 스크린샷"]
    Check1 --> Score1{합격 기준?}
    Score1 -->|p95 측정 + 1000VU 완료| S1_Pass["30점 만점"]
    Score1 -->|부분 완료| S1_Partial["15-29점"]
    Score1 -->|미제출| S1_Fail["0점"]

    S1_Pass & S1_Partial & S1_Fail --> Check2["실습 2 확인<br/>임계점 VU + 병목 원인"]
    Check2 --> Score2{합격 기준?}
    Score2 -->|임계점 특정 + 원인 분석| S2_Pass["25점 만점"]
    Score2 -->|부분 완료| S2_Partial["10-24점"]
    Score2 -->|미제출| S2_Fail["0점"]

    S2_Pass & S2_Partial & S2_Fail --> Check3["실습 3 확인<br/>Before/After 비교"]
    Check3 --> Score3{합격 기준?}
    Score3 -->|p95 30% 이상 개선| S3_Pass["30점 만점"]
    Score3 -->|인덱스만 추가| S3_Partial["15-29점"]
    Score3 -->|미완료| S3_Fail["0점"]

    S3_Pass & S3_Partial & S3_Fail --> Check4["보고서 평가"]
    Check4 --> Score4["0-15점"]

    Score4 --> Total["총점 계산<br/>합격: 80점 이상"]
    Total --> Result{최종 결과}
    Result -->|"80점 이상"| Pass["합격<br/>다음 실습 진행"]
    Result -->|"60-79점"| Retry["재제출 기회 1회<br/>미흡 영역 보완"]
    Result -->|"60점 미만"| Retake["실습 재수강"]

    style Pass fill:#e8ffe8
    style Retry fill:#fff3e0
    style Retake fill:#ffe8e8
```

### 7.6 제출 방법 및 보고서 형식

제출할 파일 목록:

```
reports/
├── 01-auth-load-test/
│   ├── result.json          # k6 JSON 출력
│   ├── grafana-screenshot.png   # 대시보드 캡처
│   └── analysis.md          # 분석 보고서
├── 02-ai-load-test/
│   ├── result.json
│   ├── threshold-breach.png # SLO 위반 순간 캡처
│   └── analysis.md
├── 03-db-bottleneck/
│   ├── before-explain.txt   # 인덱스 추가 전 EXPLAIN 출력
│   ├── after-explain.txt    # 인덱스 추가 후 EXPLAIN 출력
│   ├── before-k6.json       # 개선 전 k6 결과
│   ├── after-k6.json        # 개선 후 k6 결과
│   └── analysis.md          # 분석 + 개선 보고서
└── summary.md               # 전체 요약 (1-2페이지)
```

`analysis.md` 필수 포함 항목:
1. 테스트 환경 (서버 스펙, k6 버전, 실행 날짜)
2. 테스트 결과 수치 (p50, p95, p99, RPS, 에러율)
3. 발견된 병목 지점과 근거
4. 적용한 최적화 방법
5. 개선 효과 (Before/After 비교)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|---|---|---|---|
| 1.0.0 | 2026-04-13 | 최초 작성 — 고급 부하 테스트 실습 가이드 | Implementer Agent |
