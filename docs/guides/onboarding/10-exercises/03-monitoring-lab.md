# 실습 3: 모니터링 대시보드 만들기

> **문서 ID**: ONBOARD-10-EX03
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **예상 소요 시간**: 60~90분
> **난이도**: 초중급
> **선행 조건**: 가이드북 5장(모니터링) 학습, Grafana 접근 가능

---

## 목차

1. [실습 목표](#1-실습-목표)
2. [배경 지식](#2-배경-지식)
3. [Step 1: Prometheus에서 메트릭 확인](#3-step-1-prometheus에서-메트릭-확인)
4. [Step 2: PromQL 쿼리 작성](#4-step-2-promql-쿼리-작성)
5. [Step 3: Grafana 패널 생성](#5-step-3-grafana-패널-생성)
6. [Step 4: 알림 임계값 설정](#6-step-4-알림-임계값-설정)
7. [Step 5: 알림 발화 테스트](#7-step-5-알림-발화-테스트)
8. [예상 화면 설명](#8-예상-화면-설명)
9. [자주 하는 실수](#9-자주-하는-실수)
10. [변경 이력](#10-변경-이력)

---

## 1. 실습 목표

**과제**: auth-service의 로그인 성공/실패율을 보여주는 Grafana 패널을 만들고, 실패율 임계값 알림을 설정하십시오.

**완료 기준**:
- PromQL 쿼리가 Prometheus에서 데이터를 반환함
- Grafana에 로그인 성공/실패율 패널이 생성됨
- 실패율 30% 초과 시 알림이 발화하도록 설정됨

---

## 2. 배경 지식

### 2.1 이 프로젝트의 모니터링 스택

```
auth-service → Prometheus → Grafana → (알림) → Alertmanager → Slack/이메일
```

| 도구 | 역할 | 접근 주소 |
|------|------|---------|
| Prometheus | 메트릭 수집 및 저장 | http://prometheus.saas.local:9090 |
| Grafana | 대시보드 시각화 | http://grafana.saas.local:3000 |
| Alertmanager | 알림 라우팅 | http://alertmanager.saas.local:9093 |

### 2.2 auth-service가 노출하는 메트릭

auth-service는 OpenTelemetry를 통해 다음 메트릭을 노출합니다.

| 메트릭 이름 | 타입 | 설명 | 레이블 |
|-----------|------|------|--------|
| `auth_login_total` | Counter | 로그인 시도 횟수 | `result` (success/failure) |
| `auth_token_verify_duration_seconds` | Histogram | 토큰 검증 시간 | `status` |
| `auth_session_active_count` | Gauge | 활성 세션 수 | `tenantId` |
| `auth_mfa_attempt_total` | Counter | MFA 시도 횟수 | `result` |

### 2.3 PromQL 기초

PromQL(Prometheus Query Language)의 핵심 함수 3가지입니다.

```promql
# rate(): 초당 변화율 (Counter에서 사용)
rate(auth_login_total[5m])
# → 최근 5분간의 초당 로그인 시도 횟수

# sum(): 합계 (레이블별로 묶을 때)
sum(rate(auth_login_total[5m])) by (result)
# → result 레이블(success/failure)로 나눈 합계

# /: 나누기 (비율 계산)
sum(rate(auth_login_total{result="failure"}[5m]))
/
sum(rate(auth_login_total[5m]))
# → 전체 중 실패 비율 (0.0 ~ 1.0)
```

---

## 3. Step 1: Prometheus에서 메트릭 확인

Grafana 패널을 만들기 전에 Prometheus에서 데이터가 실제로 존재하는지 확인합니다.

### 3.1 Prometheus UI 접속

브라우저에서 Prometheus UI에 접속합니다.

```
http://prometheus.saas.local:9090
```

로컬 환경에서는 포트 포워딩이 필요할 수 있습니다.

```bash
# k8s 포트 포워딩
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# 접속: http://localhost:9090
```

### 3.2 메트릭 존재 확인

Prometheus UI의 검색창에서 다음을 입력합니다.

```promql
auth_login_total
```

**기대 출력**: 테이블 또는 그래프 탭에서 `result="success"`, `result="failure"` 레이블이 달린 데이터가 표시되어야 합니다.

데이터가 없으면 auth-service에 로그인 요청을 몇 번 보내 메트릭을 생성합니다.

```bash
# 성공 로그인 시도 (올바른 자격증명)
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123","tenantSlug":"default"}'

# 실패 로그인 시도 (잘못된 비밀번호)
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"wrong","tenantSlug":"default"}'
```

---

## 4. Step 2: PromQL 쿼리 작성

이 실습에서 만들 패널에 필요한 PromQL 쿼리를 작성합니다.

### 4.1 로그인 성공률 쿼리

```promql
# 로그인 성공률 (0.0 ~ 1.0, 1.0이 100%)
sum(rate(auth_login_total{result="success"}[5m]))
/
sum(rate(auth_login_total[5m]))
```

분모가 0이 될 때 오류를 방지하려면 `or` 절을 추가합니다.

```promql
# 안전한 버전 (분모 0 방지)
(
  sum(rate(auth_login_total{result="success"}[5m]))
  /
  sum(rate(auth_login_total[5m]))
)
or vector(0)
```

### 4.2 로그인 실패율 쿼리

```promql
# 로그인 실패율 (0.0 ~ 1.0)
(
  sum(rate(auth_login_total{result="failure"}[5m]))
  /
  sum(rate(auth_login_total[5m]))
)
or vector(0)
```

### 4.3 절대 수치 쿼리 (분당 로그인 횟수)

```promql
# 분당 로그인 성공 횟수
sum(rate(auth_login_total{result="success"}[1m])) * 60

# 분당 로그인 실패 횟수
sum(rate(auth_login_total{result="failure"}[1m])) * 60
```

### 4.4 Prometheus에서 쿼리 검증

각 쿼리를 Prometheus UI에서 실행하여 결과가 0과 1 사이의 숫자인지 확인합니다.

**기대 출력 예시**:
```
Element                           Value
{} (no labels)                    0.8333...   ← 성공률 83%
```

---

## 5. Step 3: Grafana 패널 생성

### 5.1 Grafana 접속

```bash
# 포트 포워딩 (필요한 경우)
kubectl port-forward -n monitoring svc/grafana 3000:3000
```

브라우저에서 `http://localhost:3000` 접속 후 로그인합니다.

- 기본 계정: `admin` / `admin` (첫 로그인 시 비밀번호 변경 요구)
- 실제 환경: Vault에서 발급된 계정 사용

### 5.2 새 대시보드 생성

1. 왼쪽 사이드바에서 `+` 아이콘 클릭 → `New Dashboard` 선택
2. `Add visualization` 클릭
3. 데이터 소스로 `Prometheus` 선택

### 5.3 패널 1: 로그인 성공/실패율 (시계열 그래프)

**패널 유형**: Time series

**쿼리 A** (성공률):
```promql
(
  sum(rate(auth_login_total{result="success"}[5m]))
  /
  sum(rate(auth_login_total[5m]))
) or vector(0)
```
Legend: `성공률`

**쿼리 B** (실패율):
```promql
(
  sum(rate(auth_login_total{result="failure"}[5m]))
  /
  sum(rate(auth_login_total[5m]))
) or vector(0)
```
Legend: `실패율`

**패널 설정**:
- Title: `로그인 성공/실패율 (5분 이동 평균)`
- Unit: `Percent (0.0-1.0)` 또는 `0-100%`로 변환 시 `* 100` 추가
- Min: `0`, Max: `1`
- Color scheme: 성공률=녹색, 실패율=빨간색

### 5.4 패널 2: 로그인 횟수 (Stat 패널)

**패널 유형**: Stat

**쿼리**:
```promql
sum(increase(auth_login_total[1h]))
```
Legend: `지난 1시간 로그인 시도`

**패널 설정**:
- Title: `지난 1시간 로그인 시도 횟수`
- Unit: `short` (횟수)
- Color mode: `Background`

### 5.5 대시보드 저장

패널 작성 후 우측 상단 `Save dashboard` 클릭 → 이름 입력 후 저장합니다.

- 대시보드 이름: `auth-service 로그인 모니터링`
- 폴더: `서비스 모니터링` (없으면 생성)

---

## 6. Step 4: 알림 임계값 설정

### 6.1 알림 규칙 개념

Grafana에서는 패널의 쿼리 결과가 특정 임계값을 초과하면 알림을 발생시킬 수 있습니다.

이 실습에서의 알림 조건: **로그인 실패율이 30%(0.3) 이상 5분 유지 시 알림 발화**

### 6.2 알림 규칙 생성

1. 만든 시계열 패널 편집 모드에서 `Alert` 탭 클릭
2. `Create alert rule from this panel` 클릭

**알림 조건 설정**:

```
Condition: WHEN last() OF B (실패율 쿼리) IS ABOVE 0.3
For: 5m (5분 이상 지속 시)
```

**알림 이름**: `auth-service 로그인 실패율 과다`

**알림 메시지**:
```
auth-service 로그인 실패율이 30%를 초과했습니다.
현재 실패율: {{ $values.B.Value | humanizePercentage }}
점검이 필요합니다.
```

### 6.3 알림 채널 설정 (Contact Point)

1. 왼쪽 메뉴 → `Alerting` → `Contact points`
2. 기존 채널 확인 또는 새로 추가

**로컬 테스트용 웹훅 설정** (실제 Slack 없이 테스트):
```
Type: Webhook
URL: http://localhost:9999/webhook-test
```

---

## 7. Step 5: 알림 발화 테스트

### 7.1 의도적으로 실패 로그인 생성

스크립트를 실행하여 로그인 실패율을 높입니다.

```bash
# 실패 로그인 30회 연속 발생
for i in {1..30}; do
  curl -s -X POST http://localhost:3001/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrongpassword","tenantSlug":"default"}' \
    > /dev/null
  echo "실패 로그인 $i/30"
done
```

### 7.2 알림 상태 확인

Grafana에서 `Alerting` → `Alert rules` 메뉴로 이동합니다.

알림 상태가 다음 순서로 변해야 합니다:
- `Normal` (정상): 실패율 30% 이하
- `Pending` (대기): 실패율 30% 초과, 5분 카운트 중
- `Firing` (발화): 5분 유지 후 알림 발송

**기대 화면 설명**:

Grafana Alert rules 화면에서 `auth-service 로그인 실패율 과다` 알림이 빨간색 `Firing` 상태로 표시되어야 합니다.

### 7.3 알림 해제

```bash
# 성공 로그인을 다시 보내 정상 상태로 복구
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"correct-password","tenantSlug":"default"}'
```

5분 후 알림 상태가 `Normal`로 돌아오는 것을 확인합니다.

---

## 8. 예상 화면 설명

### 8.1 완성된 대시보드 모습

시계열 패널에는 두 개의 선이 표시됩니다.
- 녹색 선 (성공률): 정상 상태에서는 0.7~1.0 범위를 유지
- 빨간색 선 (실패율): 정상 상태에서는 0~0.3 범위를 유지

실패율이 0.3(30%) 선을 넘으면 배경색이 노란색으로 변하고, 알림 임계선이 점선으로 표시됩니다.

### 8.2 Stat 패널 모습

큰 숫자로 지난 1시간 동안의 총 로그인 시도 횟수가 표시됩니다. 아무 로그인이 없으면 `0`이 표시됩니다.

### 8.3 알림 발화 화면

Grafana 상단에 빨간 배너가 표시되며, `Alerting` 섹션의 알림이 빨간색 `Firing` 상태로 표시됩니다.

---

## 9. 자주 하는 실수

### 실수 1: rate() 시간 범위가 너무 짧음

```promql
# 잘못된 예 — [1m]은 스크레이프 간격(15s)보다 너무 짧아 데이터가 불안정
rate(auth_login_total[1m])

# 올바른 예 — [5m] 이상 권장
rate(auth_login_total[5m])
```

### 실수 2: 분모가 0인 경우 처리 누락

로그인 시도가 없는 시간대에는 분모가 0이 되어 결과가 `NaN`이 됩니다.

```promql
# 잘못된 예 — NaN 발생 가능
sum(rate(auth_login_total{result="success"}[5m]))
/
sum(rate(auth_login_total[5m]))

# 올바른 예
(... 위 쿼리 ...) or vector(0)
```

### 실수 3: 알림 임계값 단위 혼동

`* 100` 없이 비율(0~1)을 사용하는 경우와 퍼센트(0~100)를 사용하는 경우를 혼동하지 마십시오.

```
실패율을 0~1로 계산했다면 → IS ABOVE 0.3 (30%)
실패율을 * 100으로 변환했다면 → IS ABOVE 30 (30%)
```

### 실수 4: 알림 `For` 설정 없음

`For` 설정이 없으면 한 번의 임계값 초과에도 즉시 알림이 발화합니다. 일시적인 스파이크에 의한 오탐을 방지하려면 반드시 `For: 5m` 이상으로 설정하십시오.

---

## 10. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 | Implementer (Sonnet) |
