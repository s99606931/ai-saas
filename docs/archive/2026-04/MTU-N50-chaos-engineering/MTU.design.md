# MTU-N50: 카오스 엔지니어링 (Litmus) — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **Plan 참조**: MTU-N50.plan.md

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 도구 | LitmusChaos 3.x (CNCF 프로젝트) |
| 실험 범위 | staging 환경만 (prod은 SRE 승인 필요) |
| 실험 유형 | Pod Kill, CPU Stress, Network Latency, Network Loss |
| 안전장치 | 네임스페이스 격리, 실험 시간 제한, 자동 롤백 |

---

## 카오스 실험 시나리오

| # | 실험 | 대상 | 기대 결과 |
|---|------|------|---------|
| 1 | Pod Kill | api-gateway | 자동 재시작, 5초 내 복구 |
| 2 | CPU Stress 80% | auth-service | 응답 지연 증가, SLO 내 유지 |
| 3 | Network Latency 300ms | tenant-service | 타임아웃 처리, 에러 응답 |
| 4 | Network Loss 50% | audit-service | 재시도 메커니즘 검증 |
| 5 | Pod Kill Multiple | api-gateway 2/3 | 서비스 유지, 에러율 5% 이내 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
