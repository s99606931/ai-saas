# MTU-N84: CSAP 증거 자동 수집 파이프라인 — Design

> **MTU ID**: MTU-N84
> **Plan 참조**: docs/01-plan/mtus/MTU-N84-csap-evidence-collection.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 수집 주기 | 일일 (03:00 UTC) + 온디맨드 |
| 증거 저장 | PV + MinIO 아카이브 |
| 무결성 | SHA-256 해시 체인 |
| 보고서 | JSON + HTML 형식 |

## 아키텍처

```
┌─ CronJob: csap-evidence-collector (일일) ──┐
│                                           │
│  수집 대상:                                │
│  ├── K8s 리소스 (kubectl get)              │
│  ├── Kyverno 정책 결과                      │
│  ├── Falco 보안 이벤트                      │
│  ├── NetworkPolicy 설정                    │
│  ├── RBAC 설정                             │
│  ├── 암호화 설정 (TLS/인증서)               │
│  ├── 감사 로그                              │
│  └── CI/CD 파이프라인 결과                  │
│                                           │
│  출력:                                     │
│  ├── evidence/{date}/{control-id}/         │
│  ├── evidence/{date}/manifest.json         │
│  └── evidence/{date}/integrity.sha256      │
└───────────────────────────────────────────┘
```

## CSAP 통제항목 → 증거 매핑 (주요 영역)

| 통제 영역 | 항목 수 | 증거 유형 |
|----------|---------|----------|
| D-01~D-04 관리 체계 | 15 | 정책 문서, 조직도, 교육 기록 |
| D-05~D-07 물리/환경 | 12 | 인프라 설정, 로그 |
| D-08 접근 통제 | 12 | RBAC 설정, 세션 정책, API 검사 |
| D-09 암호화 | 4 | TLS 인증서, 암호화 설정 |
| D-10~D-11 운영 보안 | 16 | 모니터링 설정, 백업 정책 |
| D-12 개발 보안 | 10 | CI/CD 설정, SBOM, 코드 스캔 |
| D-13 재해 복구 | 10 | DR 계획, 백업 검증 |
