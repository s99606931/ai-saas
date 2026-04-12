# MTU-N45: Falco 런타임 보안 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead (Opus)
> **Plan 참조**: docs/01-plan/mtus/MTU-N45.plan.md

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 옵션 | A: eBPF 드라이버 (선택), B: 커널 모듈, C: userspace |
| 선택 근거 | eBPF는 커널 크래시 불가, WSL2 커널 6.6+ 호환, 성능 최적 |
| 알림 채널 | Falcosidekick → Prometheus → Grafana → AlertManager |
| 규칙 전략 | 기본 규칙 + 공공 SaaS 전용 커스텀 규칙 오버레이 |

---

## 아키텍처

```
[Container] → [syscall] → [eBPF Probe] → [Falco Engine]
                                              ↓
                                    [Rule Matching]
                                         ↓
                              [Falcosidekick] → Prometheus
                                              → Webhook
                                              → Grafana Alert
```

### 컴포넌트 구성

| 컴포넌트 | 버전 | 역할 |
|---------|------|------|
| Falco | 0.39.x | eBPF 기반 syscall 모니터링 |
| Falcosidekick | 2.29.x | 다중 출력 포워더 |
| ServiceMonitor | - | Prometheus 스크래핑 |
| ConfigMap | - | 커스텀 규칙 관리 |

---

## 커스텀 규칙 설계 (공공 SaaS 특화)

| # | 규칙명 | 심각도 | 탐지 내용 | CSAP |
|---|--------|--------|---------|------|
| 1 | sensitive-file-access | WARNING | /etc/shadow, /etc/passwd 읽기 | D-08 |
| 2 | container-shell-spawn | WARNING | 컨테이너 내 셸 실행 | D-12 |
| 3 | privilege-escalation | CRITICAL | setuid/setgid 호출 | D-08 |
| 4 | unexpected-network-connection | WARNING | 허용 외 외부 연결 | D-09 |
| 5 | sensitive-mount-detected | CRITICAL | 호스트 경로 마운트 | D-12 |
| 6 | crypto-mining-detected | CRITICAL | 암호화폐 채굴 프로세스 | D-12 |
| 7 | k8s-secret-access | WARNING | 비정상 시크릿 접근 | D-08 |
| 8 | log-tampering-detected | CRITICAL | 감사 로그 삭제/수정 시도 | D-06 |
| 9 | unauthorized-process | WARNING | 허용 외 프로세스 실행 | D-12 |
| 10 | data-exfiltration-attempt | CRITICAL | 대량 데이터 외부 전송 | D-09 |

---

## Grafana 대시보드 패널 설계

| 패널 | 쿼리 | 유형 |
|------|------|------|
| 이벤트 추이 (시간별) | `sum(rate(falco_events[5m])) by (rule)` | 시계열 |
| 심각도별 분포 | `sum(falco_events) by (priority)` | 파이 차트 |
| Top 10 규칙 | `topk(10, sum(falco_events) by (rule))` | 바 차트 |
| 네임스페이스별 | `sum(falco_events) by (k8s_ns_name)` | 테이블 |
| Critical 알림 | `falco_events{priority="Critical"}` | Stat |

---

## Session Guide

```
1. Falco Helm values 작성 (eBPF 드라이버, JSON 출력, k8s 메타데이터)
2. Falcosidekick values 작성 (Prometheus + Webhook)
3. 커스텀 규칙 ConfigMap 작성
4. Prometheus ServiceMonitor + 알림 규칙
5. Grafana 대시보드 JSON
6. 설치 스크립트 (Helm 기반)
7. 테스트 스크립트 (위협 시뮬레이션)
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
