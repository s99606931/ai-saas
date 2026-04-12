# SVC-RATELIMIT-R19: 테넌트별 Sliding Window Rate Limiting

> **MTU ID**: SVC-RATELIMIT-R19
> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead
> **상태**: Plan 완료

---

## Executive Summary (4관점 테이블)

| 관점 | 항목 | 상세 |
|------|------|------|
| 비즈니스 | 요금제별 API 사용 제한 | Free=100/min, Standard=1000/min, Enterprise=무제한 |
| 기술 | Sliding Window Counter | 정밀한 분당 요청 제한, 기존 Fixed Window 보완 |
| 보안/규제 | CSAP D-10 접근 제어 | DoS/DDoS 방어, 테넌트별 차등 제한 |
| 운영 | 버스트 허용 + 큐잉 | 순간 트래픽 스파이크 허용, 큐잉으로 우아한 처리 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 현재 rate-limit 패키지는 단순 고정 윈도우 기반. 테넌트/요금제별 차등 미적용. API 게이트웨이에서만 사용 중. |
| WHO | SaaS 테넌트 관리자, 플랫폼 운영팀 |
| RISK | Free 테넌트의 과도한 API 호출로 전체 시스템 성능 저하, 공정 사용 정책 미적용 |
| SUCCESS | 테넌트별 요금제 기반 Rate Limit 적용 + Sliding Window 정밀도 + 버스트 허용 |
| SCOPE | platform/packages/rate-limit-advanced/ 신규 패키지 |

---

## 기능 요구사항

### FR-RL.1: Sliding Window Counter 알고리즘
- 현재 윈도우 + 이전 윈도우 비율 기반 카운트
- 정밀도: Fixed Window 대비 2배 향상
- 메모리 기반 스토리지 (Redis 없이 동작)

### FR-RL.2: 테넌트별 요금제 기반 한도 설정
- Plan 레벨: `free`, `standard`, `enterprise`, `custom`
- 기본 한도:
  - Free: 100 req/min
  - Standard: 1,000 req/min
  - Enterprise: 10,000 req/min (사실상 무제한)
  - Custom: 동적 설정
- 테넌트별 커스텀 오버라이드 지원

### FR-RL.3: 버스트 허용 (Token Bucket 하이브리드)
- 버스트 배율: 기본 한도의 150% (설정 가능)
- 토큰 리필 주기: 1초
- 버스트 초과 시 큐잉 (최대 큐 크기 설정 가능)

### FR-RL.4: 응답 헤더 표준
- `X-RateLimit-Limit`: 전체 한도
- `X-RateLimit-Remaining`: 잔여 요청 수
- `X-RateLimit-Reset`: 리셋 시각 (Unix timestamp)
- `Retry-After`: 초과 시 대기 시간 (초)

### FR-RL.5: Fastify 플러그인 통합
- `rateLimitAdvancedPlugin` Fastify 플러그인
- 키 생성 전략: IP, 테넌트 ID, 사용자 ID (설정 가능)
- 제외 경로 설정 (예: /health, /metadata)
- 한도 초과 시 429 Too Many Requests + Retry-After

### FR-RL.6: 통계 및 모니터링
- 테넌트별 사용량 통계 API
- `/rate-limit/stats` 관리 엔드포인트
- 한도 근접 알림 (80%, 90% 임계값)

---

## CSAP 매핑

| CSAP 항목 | FR ID | 설명 |
|-----------|-------|------|
| D-10 접근 제어 | FR-RL.1~5 | API 과부하 방지, 공정 사용 정책 |
| D-07 가용성 | FR-RL.3 | 버스트 허용으로 서비스 가용성 유지 |

---

## 산출물

| 산출물 | 경로 | 상태 |
|--------|------|------|
| Plan 문서 | docs/01-plan/mtus/SVC-RATELIMIT-R19.plan.md | 완료 |
| 패키지 코드 | platform/packages/rate-limit-advanced/ | 구현 예정 |
| 테스트 | platform/packages/rate-limit-advanced/tests/ | 구현 예정 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
