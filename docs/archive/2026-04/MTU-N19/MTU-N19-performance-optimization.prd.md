# MTU-N19: 성능 최적화 PRD

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N19 |
| Phase | Phase 7 New (성능) |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Opus) |
| 복잡도 | MED |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 17개 마이크로서비스 + 3개 포털이 k3s WSL2 환경에서 운영됨. 제한된 리소스(RAM 8~16GB)에서 안정적 운영을 위해 DB 인덱스 최적화, k8s 리소스 튜닝, Dockerfile 멀티스테이지 빌드 최적화, 연결 풀 설정이 필요함 |
| **WHO** | 운영 담당자, 개발자, 감리 위원 (NFR-02 성능 기준 충족 확인) |
| **RISK** | (1) 인덱스 과다 생성 시 쓰기 성능 저하, (2) 리소스 제한 과소 설정 시 OOM Kill, (3) WSL2 메모리 공유 충돌 |
| **SUCCESS** | (1) Prisma 스키마 인덱스 분석 및 최적화 권고, (2) k8s 리소스 requests/limits 최적값 문서화, (3) .wslconfig 권장 설정 가이드, (4) Dockerfile 이미지 크기 분석 + 최적화 권고 |
| **SCOPE** | 성능 최적화 가이드 문서 (코드 변경 최소화, 주로 설정/인덱스 권고) |

---

## 시장조사 결과 반영

### k3s 리소스 최적화 (2026)
- Traefik, ServiceLB 비활성화 시 ~70MB RAM 절약 가능
- systemd drop-in: CPUQuota, MemoryMax 설정으로 k3s 자체 리소스 제한
- 출처: [K3s Resource Optimization](https://oneuptime.com/blog/post/2026-02-02-k3s-resource-optimization/view)

### WSL2 메모리 관리 (2026)
- .wslconfig에서 memory=2GB~8GB 설정으로 호스트 보호
- Windows에 최소 4GB 예약 권장
- 50~75% 할당이 최적 (빌드 시 OOM 방지)
- 출처: [WSL2 RAM/CPU Limits](https://ahmetdagtas.medium.com/adjusting-ram-and-cpu-limits-in-windows-11-wsl2-975dbdd4d069)

### Prisma ORM 성능 (2026)
- Prisma v7.4 쿼리 캐싱 + 부분 인덱스 지원
- EXPLAIN ANALYZE로 인덱스 사용 여부 확인
- 미사용 인덱스 제거로 쓰기 성능 향상
- 출처: [Prisma ORM v7.4](https://www.prisma.io/blog/prisma-orm-v7-4-query-caching-partial-indexes-and-major-performance-improvements)

---

## 기능 요구사항

| FR ID | 요구사항 | 산출물 |
|-------|---------|--------|
| FR-N19.1 | Prisma 스키마 인덱스 분석 + 최적화 권고 | docs/performance/db-index-optimization.md |
| FR-N19.2 | k8s 리소스 requests/limits 최적값 분석 | docs/performance/k8s-resource-tuning.md |
| FR-N19.3 | WSL2 .wslconfig 권장 설정 | docs/performance/wsl2-config-guide.md |
| FR-N19.4 | Dockerfile 이미지 크기 최적화 권고 | docs/performance/docker-image-optimization.md |
| FR-N19.5 | 연결 풀(DB/Redis) 최적화 권고 | docs/performance/connection-pool-tuning.md |

---

## 비기능 요구사항

| NFR ID | 요구사항 | 기준 |
|--------|---------|------|
| NFR-N19.1 | API P95 응답시간 | < 200ms (SLO 기준) |
| NFR-N19.2 | k3s WSL2 최소 메모리 | 4GB RAM으로 17 서비스 기동 |
| NFR-N19.3 | Docker 이미지 크기 | 서비스당 < 300MB |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 + 시장조사 반영 | PM Lead Agent (Opus) |
