# 카오스 엔지니어링 Runbook

> **버전**: 1.0.0 | **작성일**: 2026-04-09
> **Design Ref**: MTU-N50 Design

---

## 개요

이 Runbook은 LitmusChaos를 사용한 정기적 복원력 테스트 절차를 정의합니다.
모든 실험은 staging 환경에서만 수행하며, production 실행은 SRE 팀장 승인이 필요합니다.

---

## 사전 조건

- LitmusChaos 3.x 설치 (`helm install litmus litmuschaos/litmus -n litmus`)
- staging 네임스페이스에 서비스 배포 완료
- Prometheus + Grafana 모니터링 정상 작동
- SLO 대시보드 확인 가능

---

## 실험 카탈로그

### 실험 1: Pod Kill — API Gateway

| 항목 | 값 |
|------|---|
| 파일 | `infra/chaos/experiments/pod-kill.yaml` |
| 대상 | api-gateway (staging) |
| 지속 시간 | 30초 |
| 기대 결과 | 5초 내 자동 재시작, 가용성 99.9% 유지 |
| SLO 영향 | API Gateway 가용성 에러 버짓 내 |

```bash
kubectl apply -f infra/chaos/experiments/pod-kill.yaml
```

### 실험 2: CPU Stress — Auth Service

| 항목 | 값 |
|------|---|
| 파일 | `infra/chaos/experiments/cpu-stress.yaml` |
| 대상 | auth-service (staging) |
| CPU 부하 | 80% |
| 지속 시간 | 60초 |
| 기대 결과 | 응답 지연 증가, 인증 성공률 99.95% 유지 |

```bash
kubectl apply -f infra/chaos/experiments/cpu-stress.yaml
```

### 실험 3: Network Latency — Tenant Service

| 항목 | 값 |
|------|---|
| 파일 | `infra/chaos/experiments/network-chaos.yaml` |
| 대상 | tenant-service (staging) |
| 지연 | 300ms (+/- 50ms 지터) |
| 지속 시간 | 60초 |
| 기대 결과 | 타임아웃 처리 정상, 에러 응답 적절 |

### 실험 4: Network Loss — Audit Service

| 항목 | 값 |
|------|---|
| 파일 | `infra/chaos/experiments/network-chaos.yaml` |
| 대상 | audit-service (staging) |
| 패킷 손실 | 50% |
| 지속 시간 | 60초 |
| 기대 결과 | 재시도 메커니즘 작동, 로그 유실 0건 |

---

## 실험 실행 절차

1. **사전 점검**: SLO 대시보드에서 현재 에러 버짓 잔여율 확인
2. **알림 설정**: 실험 시작 전 팀 채널에 공지
3. **실험 실행**: `kubectl apply -f <experiment.yaml>`
4. **모니터링**: Grafana 대시보드에서 실시간 관측
5. **결과 기록**: 실험 결과를 감사 로그에 기록
6. **정리**: `kubectl delete -f <experiment.yaml>`
7. **분석**: SLO 영향 분석 → 개선 사항 도출

---

## 안전장치

| 안전장치 | 설명 |
|---------|------|
| 네임스페이스 격리 | staging/chaos-test만 허용 |
| 시간 제한 | 최대 5분 (자동 종료) |
| RBAC | litmus-admin ServiceAccount만 실험 실행 가능 |
| 프로브 | 서비스 헬스체크 연속 실패 시 실험 자동 중단 |
| 승인 필요 | production 실험은 SRE 팀장 승인 필수 |

---

## 정기 실행 일정

| 빈도 | 실험 | 환경 |
|------|------|------|
| 주 1회 | Pod Kill (전 서비스) | staging |
| 격주 | CPU Stress + Network Chaos | staging |
| 월 1회 | 전체 실험 (Gameday) | staging |
| 분기 1회 | 주요 실험 | production (승인 후) |

---

## CSAP 매핑

| CSAP 항목 | 카오스 실험 연관 |
|-----------|---------------|
| D-06 침해사고 관리 | 장애 대응 절차 검증 |
| D-08 접근 통제 | 장애 시 접근 통제 유지 확인 |
| D-12 시스템 개발 보안 | 복원력 테스트를 통한 보안 강화 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
