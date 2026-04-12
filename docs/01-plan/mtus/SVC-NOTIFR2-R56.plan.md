# SVC-NOTIFR2-R56 Plan — Notification Webhook SSRF Hardening

> **MTU ID**: SVC-NOTIFR2-R56
> **라운드**: R56 (3회차 고도화 루프 #7)
> **작성일**: 2026-04-11
> **작성자**: PM Lead
> **상태**: Plan 완료

---

## Executive Summary

| 관점 | 핵심 내용 |
|------|---------|
| 비즈니스 | 고객 웹훅 발송 엔드포인트의 내부망 공격 차단 |
| 기술 | DNS 해석 + CIDR 차단 목록 기반 다단계 방어 (기존: hostname 문자열 매칭) |
| 보안 | CSAP D-12-04 SSRF 방지 강화 — 169.254/16, 100.64/10 (CGN) 등 전체 차단 |
| 감리 | 정부기관 공공망 경계 보호 |

---

## Context Anchor

- **WHY**: 현재 `webhook-sender.ts`의 `isInternalUrl` 은 hostname 문자열 분리(`split('.')`)만 수행. IPv6 사설, DNS 재바인딩, 특수 IPv4 대역(100.64/10 CGN, 192.0.0/24, 198.18/15) 미방어. 우회 가능.
- **WHO**: notification-service 웹훅 발송 경로, 향후 webhook-dispatcher 사용 모든 서비스
- **RISK**: DNS 해석 추가 = latency. 테스트에서 실 DNS 불필요 (mock 주입)
- **SUCCESS**:
  - `@public-saas/cidr` + DNS lookup 통합 `ssrf-guard.ts` 신규 생성
  - IPv4/IPv6 전체 사설 + 루프백 + 링크로컬 + 메타데이터 엔드포인트 차단
  - 기존 webhook-sender 통합, 회귀 0
  - 테스트 20+
- **SCOPE**:
  - 포함: `platform/packages/ssrf-guard` 신규 패키지 + notification webhook-sender 통합
  - 제외: SSRF 밖 모든 HTTP 송신 (audit-service, api-gateway → 별도 라운드)

---

## 요구사항 (FR)

| ID | 설명 | 우선순위 |
|----|------|--------|
| FR-SSRF.1 | `isBlockedHost(hostname)` — 호스트 이름만으로 결정 가능한 차단 판정 (localhost, .local, 직접 IP) | P0 |
| FR-SSRF.2 | `resolveAndCheck(hostname, opts)` — DNS A/AAAA 해석 후 모든 IP가 차단 대역에 속하지 않아야 통과 | P0 |
| FR-SSRF.3 | 기본 차단 CIDR 목록 제공 (IPv4 9개 + IPv6 6개) | P0 |
| FR-SSRF.4 | `assertSafeUrl(url, opts)` — URL 검증 + 해석 통합 엔트리 | P0 |
| FR-SSRF.5 | DNS resolver 주입 가능 (테스트용 mock) | P0 |
| FR-SSRF.6 | 타임아웃 (기본 1초) 초과 시 차단 fail-closed | P0 |
| FR-SSRF.7 | notification-service `webhook-sender.ts` → `assertSafeUrl` 사용 전환 | P0 |
| NFR-SSRF.1 | 의존성: `@public-saas/cidr` + Node `dns/promises` 만 | P0 |
| NFR-SSRF.2 | 테스트 20+ | P0 |

### 차단 CIDR 기본 목록

**IPv4**:
- `0.0.0.0/8` — 현재 네트워크
- `10.0.0.0/8` — 사설 A
- `100.64.0.0/10` — CGN
- `127.0.0.0/8` — 루프백
- `169.254.0.0/16` — 링크로컬, 메타데이터
- `172.16.0.0/12` — 사설 B
- `192.0.0.0/24` — IETF 예약
- `192.168.0.0/16` — 사설 C
- `198.18.0.0/15` — 벤치마킹

**IPv6**:
- `::/128` — 미지정
- `::1/128` — 루프백
- `fc00::/7` — Unique Local
- `fe80::/10` — 링크 로컬
- `ff00::/8` — Multicast
- `::ffff:0:0/96` — IPv4-mapped (별도 처리)

---

## 변경 이력

| 버전 | 일자 | 내용 |
|------|------|------|
| 1.0.0 | 2026-04-11 | 최초 작성 |
