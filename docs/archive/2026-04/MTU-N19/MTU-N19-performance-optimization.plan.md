# MTU-N19: 성능 최적화 Plan

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N19 |
| Phase | Phase 7 New (성능) |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Opus) |
| 복잡도 | MED |
| 의존 MTU | MTU-N07 (벤치마크), MTU-N16 (모니터링) |
| PRD | docs/00-pm/MTU-N19-performance-optimization.prd.md |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 제한된 WSL2 리소스(8~16GB RAM)에서 17개 서비스 안정 운영 보장 |
| 기술 | DB 인덱스 최적화, k8s 리소스 튜닝, Docker 이미지 경량화, 연결 풀 설정 |
| 보안 | CSAP D-07 가용성 요건 충족 (OOM Kill 방지, 리소스 고갈 방어) |
| 감리 | NFR-02 성능 기준 충족 증빙 (P95 < 200ms, 가용성 99.9%) |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | v1.0.0 릴리스 전 성능 병목 식별 및 최적화 권고. k3s WSL2 환경의 제한된 리소스에서 안정적 운영을 위한 튜닝 가이드 필요 |
| **WHO** | 운영 담당자, 개발자, 감리 위원 |
| **RISK** | 인덱스 과다 시 쓰기 성능 저하, 리소스 과소 설정 시 OOM Kill |
| **SUCCESS** | 5개 산출물 완성, 각 가이드에 구체적 권장값 포함 |
| **SCOPE** | 성능 최적화 가이드 문서 5종 (docs/performance/) |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 산출물 |
|-------|---------|---------|--------|
| FR-N19.1 | Prisma 스키마 인덱스 분석: 현재 인덱스 목록, 쿼리 패턴 분석, 누락/과잉 인덱스 식별, 복합 인덱스 권고 | P0 | docs/performance/db-index-optimization.md |
| FR-N19.2 | k8s 리소스 requests/limits 최적값: 서비스별 메모리/CPU 프로파일링 기반 권장값, k3s disable 옵션 | P0 | docs/performance/k8s-resource-tuning.md |
| FR-N19.3 | WSL2 .wslconfig 권장 설정: RAM/CPU/swap/디스크 최적 분배, 호스트 예약 4GB | P1 | docs/performance/wsl2-config-guide.md |
| FR-N19.4 | Dockerfile 이미지 크기 최적화: 멀티스테이지 빌드 분석, Alpine 기반 경량화, .dockerignore 점검 | P1 | docs/performance/docker-image-optimization.md |
| FR-N19.5 | 연결 풀(DB/Redis) 최적화: connection_limit 설정, pool_timeout, idle 연결 관리 | P1 | docs/performance/connection-pool-tuning.md |

---

## 추적성 매트릭스

| FR ID | PRD 항목 | Design 섹션 | 산출물 | 테스트 | CSAP |
|-------|---------|------------|--------|--------|------|
| FR-N19.1 | FR-N19.1 | D-N19.1 | db-index-optimization.md | 인덱스 분석 결과 검증 | D-07 |
| FR-N19.2 | FR-N19.2 | D-N19.2 | k8s-resource-tuning.md | 리소스 설정 적용 확인 | D-07, D-11 |
| FR-N19.3 | FR-N19.3 | D-N19.3 | wsl2-config-guide.md | .wslconfig 적용 확인 | D-07 |
| FR-N19.4 | FR-N19.4 | D-N19.4 | docker-image-optimization.md | 이미지 크기 측정 | D-11 |
| FR-N19.5 | FR-N19.5 | D-N19.5 | connection-pool-tuning.md | 연결 풀 설정 검증 | D-07 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent (Opus) |
