# MTU-N94: Runbook 자동화 — Design

> **Phase**: 모니터링 Round 7
> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | `docs/01-plan/mtus/MTU-N94-runbook-automation.plan.md` |
| 기존 Runbook | `docs/operations/runbooks/` (10개 수동 Runbook) |

---

## 1. 자동화 아키텍처

```
Alert 발생 → AlertManager → webhook → 자동 진단 스크립트
                                           │
                                     ┌─────┴──────┐
                                     │ 진단 결과   │
                                     │ (JSON 출력) │
                                     └─────┬──────┘
                                           │
                                     ┌─────┴──────┐
                                     │ 안전 조치?  │
                                     │ (Pod 재시작)│
                                     └─────┬──────┘
                                           │
                                     ┌─────┴──────┐
                                     │ 로그 기록   │
                                     │ audit.jsonl │
                                     └────────────┘
```

---

## 2. 상세 설계

### 2.1 공통 프레임워크 (FR-N94.6)

```bash
# scripts/runbook-lib.sh — 자동 Runbook 공통 라이브러리
# 표준 출력 형식, 로깅, 결과 포맷팅
```

### 2.2 자동 진단 스크립트 목록

| Runbook | 트리거 알림 | 진단 내용 | 자동 조치 |
|---------|-----------|----------|----------|
| Pod CrashLoop | KubePodCrashLooping | 로그 분석, 리소스 상태 | 이전 버전 Deployment 확인 |
| 고지연 | HighLatency | DB 연결 풀, 외부 호출 체크 | 없음 (진단만) |
| 디스크 부족 | DiskSpaceRunningLow | 대용량 파일 탐색 | 로그 로테이션 |
| OOM | OOMKilled | 메모리 사용 분석 | VPA 권장 출력 |

### 2.3 출력 형식 (FR-N94.5)

```json
{
  "runbook": "pod-crashloop-diag",
  "timestamp": "2026-04-10T15:30:00Z",
  "alert": "KubePodCrashLooping",
  "namespace": "production",
  "pod": "api-gateway-abc123",
  "diagnosis": {
    "root_cause": "OOM Killed",
    "evidence": ["container memory limit 256Mi exceeded"],
    "recommendation": "메모리 limit 512Mi로 증가 권장"
  },
  "auto_action": {
    "type": "none",
    "reason": "수동 승인 필요"
  }
}
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
