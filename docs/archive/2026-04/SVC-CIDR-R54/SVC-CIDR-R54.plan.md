# SVC-CIDR-R54 Plan — CIDR / IP Range 유틸리티

> **MTU ID**: SVC-CIDR-R54
> **라운드**: R54 (3회차 고도화 루프 #5)
> **작성일**: 2026-04-11
> **작성자**: PM Lead
> **상태**: Plan 완료

---

## Executive Summary

| 관점 | 핵심 내용 |
|------|---------|
| 비즈니스 | 공공기관 방화벽/정부넷 IP 허용 리스트를 CIDR 표기법으로 관리 |
| 기술 | `@public-saas/cidr` — 의존성 0, IPv4/IPv6 parser + CIDR contains 검사 |
| 보안 | api-gateway ip-filter / audit-service 접근 제어에 활용 |
| 감리 | 네트워크 경계 정책 코드로 표준화 |

---

## Context Anchor

- **WHY**: 현재 ip-filter.middleware가 개별 IP만 지원. CIDR 기반 대규모 허용망(예: 정부넷 10.0.0.0/8) 미지원
- **WHO**: api-gateway, audit-service, admin 엔드포인트
- **RISK**: IPv6 파싱 복잡성 → 일반 포맷만 지원 (압축 `::` 포함)
- **SUCCESS**: 30 테스트 통과, `matchCidr()` + `parseCidr()` + `IpRangeMatcher` 제공
- **SCOPE**:
  - 포함: IPv4 CIDR, IPv6 CIDR, 다중 CIDR 매칭
  - 제외: DNS 조회, IPv6 zone-id

---

## 요구사항 (FR)

| ID | 설명 | 우선순위 |
|----|------|--------|
| FR-CIDR.1 | `parseCidr(str)` — `1.2.3.0/24` → `{ family, address, prefixLength }` | P0 |
| FR-CIDR.2 | `matchCidr(ip, cidr)` — 단일 CIDR 포함 여부 | P0 |
| FR-CIDR.3 | `IpRangeMatcher` — 다수 CIDR 등록 후 빠른 매칭 (선형 스캔) | P0 |
| FR-CIDR.4 | IPv4 지원 (0~32 prefix) | P0 |
| FR-CIDR.5 | IPv6 완전/압축 표기 지원 (0~128 prefix) | P0 |
| FR-CIDR.6 | 잘못된 입력은 명시적 에러 (TypeError/RangeError) | P0 |
| FR-CIDR.7 | `isIpInRange(ip, cidrs)` — 편의 함수 (boolean 반환) | P1 |
| NFR-CIDR.1 | 의존성 0 | P0 |
| NFR-CIDR.2 | 단일 매칭 O(prefix비트) 이하 | P0 |

---

## 변경 이력

| 버전 | 일자 | 내용 |
|------|------|------|
| 1.0.0 | 2026-04-11 | 최초 작성 |
