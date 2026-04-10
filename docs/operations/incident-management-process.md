# 인시던트 관리 프로세스

> Design Ref: MTU-N95 Design §1, §2
> Plan SC: FR-N95.5
> CSAP: D-06(침해사고 관리 절차)
> 작성일: 2026-04-10 | 작성자: PM Lead

---

## 1. 인시던트 분류 체계

### 1.1 카테고리

| 카테고리 | 알림 패턴 | 담당 팀 | Runbook |
|---------|----------|--------|---------|
| 보안 | `Falco*`, `PolicyViolation*`, `Gatekeeper*`, `Kyverno*` | 보안팀 | 10-보안-이벤트-대응.md |
| 가용성 | `ServiceDown*`, `SLO*`, `ErrorBudget*` | SRE팀 | 01-pod-crashloop-대응.md |
| 성능 | `HighLatency*`, `Anomaly*` | 개발팀 + SRE | 02-고지연-대응.md |
| 인프라 | `NodeDown*`, `DiskFull*`, `OOM*` | 인프라팀 | 04-디스크-대응.md, 06-oom-대응.md |
| 배포 | `Flux*`, `Deployment*` | DevOps팀 | 09-flux-drift-대응.md |
| 데이터 | `PostgreSQL*`, `Database*` | DBA팀 | 08-db-연결-대응.md |

### 1.2 우선순위 매트릭스

| | 보안 영향 | 가용성 영향 | 성능 영향 | 데이터 영향 |
|---|----------|-----------|----------|-----------|
| **전체 서비스** | P1 | P1 | P2 | P1 |
| **단일 서비스** | P1 | P2 | P3 | P2 |
| **비 프로덕션** | P2 | P3 | P4 | P3 |

---

## 2. 에스컬레이션 정책

### 2.1 시간 기반 에스컬레이션

| 우선순위 | 초기 응답 | 1차 에스컬레이션 | 2차 에스컬레이션 | 최종 |
|---------|---------|---------------|---------------|------|
| P1 (긴급) | 즉시 | 15분 -> 팀 리더 | 30분 -> CTO | 1시간 -> 전체 공지 |
| P2 (높음) | 5분 | 30분 -> 팀 리더 | 2시간 -> CTO | - |
| P3 (보통) | 30분 | 2시간 -> 팀 리더 | - | - |
| P4 (낮음) | 2시간 | 다음 업무일 | - | - |

### 2.2 조건 기반 에스컬레이션

```
보안 인시던트 → 무조건 P1 + 보안팀 즉시 에스컬레이션
SLO 위반 → P1 + 자동 롤백 후보 플래그
에러 예산 50% 소진 → P2 + SRE 팀 알림
```

---

## 3. 인시던트 대응 절차

### 3.1 감지 (Detection)

1. Prometheus 알림 → AlertManager 라우팅
2. 인시던트 자동 분류 (카테고리 + 우선순위)
3. 담당 팀 자동 알림

### 3.2 진단 (Diagnosis)

1. 자동 Runbook 실행 (scripts/runbook-auto-*.sh)
2. 진단 결과 JSON 수집
3. 근본 원인 1차 판별

### 3.3 조치 (Response)

1. 안전 조치 자동 실행 (dry_run 모드)
2. 위험 조치는 수동 승인 후 실행
3. 조치 결과 감사 로그 기록

### 3.4 복구 (Recovery)

1. 서비스 정상 확인 (SLI 메트릭)
2. 알림 resolved 확인
3. 인시던트 종료 기록

### 3.5 사후 분석 (Post-mortem)

1. 근본 원인 분석 (RCA) 문서 작성
2. 재발 방지 대책 수립
3. Runbook 업데이트

---

## 4. SLO 위반 자동 롤백

### 4.1 트리거 조건

| 조건 | 임계값 | 지속 시간 |
|------|--------|---------|
| 에러 예산 소진율 | > 200% (30분 burn rate) | 5분 |
| 가용성 SLI | < 99% | 5분 |
| P99 지연 | > SLO 목표 3배 | 5분 |

### 4.2 롤백 절차

```bash
# 1. Flux를 통한 자동 롤백
flux suspend helmrelease <service> -n <namespace>
helm rollback <service> <previous-revision> -n <namespace>
flux resume helmrelease <service> -n <namespace>

# 2. 롤백 후 검증
# - SLI 메트릭 정상 확인
# - 알림 resolved 확인
# - 감사 로그 기록
```

---

## 5. 감사 로그 요건 (CSAP D-06)

모든 인시던트 대응 활동은 감사 로그에 기록합니다:

```json
{
  "timestamp": "2026-04-10T15:30:00Z",
  "actor": "sre-team",
  "action": "INCIDENT_RESPONSE",
  "incident_id": "INC-2026-0410-001",
  "category": "availability",
  "priority": "P1",
  "description": "서비스 api-gateway 다운 — Pod 재시작 실행"
}
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
