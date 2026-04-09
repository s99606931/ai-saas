# SLO/SLI 운영 가이드

> **버전**: 1.0.0 | **작성일**: 2026-04-09
> **Design Ref**: MTU-N49 Design

---

## 개요

Service Level Objectives (SLO)는 서비스 신뢰성의 정량적 목표입니다.
Sloth를 사용하여 SLO CRD로 정의하면 Prometheus recording rules와
multi-window multi-burn rate 알림이 자동 생성됩니다.

---

## 현재 SLO 정의

| 서비스 | SLO | 목표 | 에러 버짓 (30일) | 등급 |
|--------|-----|------|----------------|------|
| API Gateway | 가용성 | 99.9% | 43.2분 | Critical |
| API Gateway | 지연시간 P95 | 99% (< 500ms) | 432분 | High |
| Auth Service | 인증 성공률 | 99.95% | 21.6분 | Critical |
| Tenant Service | CRUD 성공률 | 99.9% | 43.2분 | High |
| Audit Service | 로그 기록 | 99.99% | 4.3분 | Critical |
| AI Gateway | 응답 성공률 | 99.5% | 216분 | High |

---

## 에러 버짓 정책

### 에러 버짓 잔여율에 따른 대응

| 잔여율 | 상태 | 대응 |
|--------|------|------|
| 75~100% | 정상 | 기능 개발 계속 |
| 50~75% | 주의 | 안정성 작업 우선 |
| 25~50% | 경고 | 기능 배포 동결, 안정성 집중 |
| 0~25% | 위험 | 모든 변경 중단, 장애 대응 전담 |

### Multi-Window Multi-Burn Rate 알림

| 윈도우 | 번레이트 | 알림 유형 |
|--------|---------|----------|
| 1시간 | 14.4x | Page (즉시 대응) |
| 6시간 | 6x | Page (긴급 대응) |
| 1일 | 3x | Ticket (다음 영업일) |
| 3일 | 1x | Ticket (주간 검토) |

---

## Sloth 설치 및 사용

```bash
# Sloth Helm 설치
helm repo add sloth https://slok.github.io/sloth
helm install sloth sloth/sloth -n monitoring

# SLO 적용
kubectl apply -f infra/slo/

# SLO 상태 확인
kubectl get prometheusservicelevels -A

# 생성된 Prometheus rules 확인
kubectl get prometheusrules -n production -l sloth.slok.dev/managed=true
```

---

## CSAP 매핑

| CSAP 항목 | SLO 연관 |
|-----------|---------|
| D-06 침해사고 관리 | Audit Service SLO 99.99% — 감사 로그 유실 방지 |
| D-08 접근 통제 | Auth Service SLO 99.95% — 인증 장애 조기 탐지 |
| D-12 시스템 개발 보안 | API Gateway SLO — 전체 서비스 건전성 모니터링 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
