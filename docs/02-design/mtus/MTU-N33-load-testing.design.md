# Design: MTU-N33 부하 테스트

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N33 |
| 작성일 | 2026-04-08 |
| 복잡도 | MED |
| 버전 | 1.0 |

## Design Anchor

- **Plan 참조**: docs/01-plan/mtus/MTU-N33-load-testing.plan.md
- **PRD 참조**: docs/00-pm/MTU-N33-load-testing.prd.md
- **API Gateway**: http://localhost:32276 (NodePort)

## 아키텍처 옵션 분석

### Option A: k6 (Grafana)

- Go 기반, JavaScript 스크립트
- 장점: 강력한 메트릭, Grafana 연동
- 단점: 별도 바이너리 설치 필요

### Option B: autocannon (npm)

- Node.js 기반, npx로 즉시 실행
- 장점: 설치 불필요, 간단한 HTTP 벤치마크
- 단점: 복잡한 시나리오 제한

### Option C: Pragmatic Balance (선택) - autocannon 기본 + 스크립트

- autocannon을 npx로 실행 (설치 불필요)
- JavaScript API 사용하여 다중 엔드포인트 테스트
- 장점: 즉시 실행, 충분한 메트릭, 스크립트 자유도
- 단점: k6 대비 시각화 약함

## 선택: Option C (autocannon 스크립트)

npm 생태계 내에서 추가 설치 없이 즉시 실행 가능. WSL2 리소스 절약.

## 상세 설계

### 테스트 시나리오

| 시나리오 | 엔드포인트 | 설정 | 목표 |
|---------|----------|------|------|
| S1: Health Check | GET /health | 10 conn, 30s | 기준선 측정 |
| S2: 서비스 라우팅 | GET /api/auth/health | 10 conn, 30s | 라우팅 성능 |
| S3: 동시 접속 | GET /health | 50 conn, 15s | 동시성 한계 |

### 테스트 스크립트 구조

```javascript
// scripts/load-test.js
// Design Ref: MTU-N33 Design -- 부하 테스트 설계
// Plan SC: FR-N33.2

const autocannon = require('autocannon');

const scenarios = [
  { title: 'Health Check', url: 'http://localhost:32276/health', connections: 10, duration: 30 },
  { title: 'Auth Routing', url: 'http://localhost:32276/api/auth/health', connections: 10, duration: 30 },
  { title: 'Concurrency', url: 'http://localhost:32276/health', connections: 50, duration: 15 },
];
```

### 결과 메트릭

- **TPS** (Requests per second)
- **P50/P95/P99 응답시간** (ms)
- **에러율** (non-2xx / total)
- **처리량** (bytes/sec)

### WSL2 리소스 보호

- 최대 50 connections (과부하 방지)
- 최대 30초 duration
- 시나리오 간 5초 쿨다운

## Session Guide

1. npx autocannon --version 확인
2. scripts/load-test.js 작성
3. 시나리오별 순차 실행
4. 결과 수집 및 보고서 작성
5. 가이드 문서 작성
