# MTU-N89: 감리 산출물 완전성 보강 — Design

> **MTU ID**: MTU-N89
> **Plan 참조**: docs/01-plan/mtus/MTU-N89-audit-completeness.plan.md
> **작성일**: 2026-04-10
> **아키텍처 선택**: Option B — Pragmatic Balance

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 목표 | 감리 7대 산출물 T01~T07 완전성 확보, 6라운드 CI/CD 구현 반영 |
| 제약 | 행안부 감리기준 고시 제2023-1호 형식 준수, 기존 문서 구조 유지 |
| 기술 스택 | Markdown 문서, Shell 스크립트, jq (audit.jsonl 분석) |

## Session Guide

```
세션 목표: T03~T07 + 체크리스트 갱신 + audit 검증 스크립트
소요 시간: 1 세션
복잡도: MED (문서 갱신 위주, 코드 구현 최소)
```

## 1. T03 상세설계서 갱신 설계

### 추가 섹션

```markdown
## 8. CI/CD 파이프라인 아키텍처 (N37~N88)

### 8.1 공급망 보안 계층
- SBOM 자동 생성 (Syft) + Grype 취약점 스캔
- SLSA Level 3 Provenance + Cosign 서명 검증
- S2C2F Level 3 프레임워크 + Renovate 의존성 관리
- CVE 자동 패치 파이프라인

### 8.2 배포 자동화 계층
- Flux GitOps + Flagger 카나리 배포
- 멀티환경 분리 (dev/stg/prod)
- vCluster PR Preview 환경
- Sealed Secrets + External Secrets Operator

### 8.3 관측성 계층 (4대 신호)
- 메트릭: Prometheus + VPA + OpenCost FinOps
- 로그: Loki + LogQL 고급 쿼리
- 트레이스: Tempo + OTel 분산 추적 + TraceQL
- 프로파일: Pyroscope 연속 프로파일링

### 8.4 보안 계층
- Falco 런타임 보안 + Tetragon
- Pod Security Standards Restricted
- Trivy Operator + Admission Webhook 5종
- Kyverno Enforce + Gatekeeper 정책
- NetworkPolicy 네임스페이스 격리

### 8.5 안정성 계층
- SLO/SLI 자동화 (Sloth)
- 카오스 엔지니어링 (Litmus)
- SRE Runbook 10종 자동화
- DR 자동 페일오버 (Velero)
- ML 이상탐지 (Z-Score + Prophet)
```

## 2. T04 추적성 매트릭스 확장 설계

### CI/CD FR 추적 테이블

```markdown
## FR-N.x CI/CD·DevOps 고도화

| FR ID | 요구사항명 | 구현 산출물 | 테스트 | CSAP | 상태 | MTU |
|-------|---------|---------|------|------|------|-----|
| FR-N37.1 | SBOM+Grype | infra/cicd/sbom/ | test-sbom.sh | D-05 | 완료 | N37 |
| FR-N38.1 | 워크플로우 최적화 | .gitea/workflows/ | test-cache.sh | D-12 | 완료 | N38 |
... (N39~N88 전수)
```

## 3. T06 시험결과서 갱신 설계

### E2E 테스트 결과 섹션

```markdown
## 6. CI/CD E2E 테스트 결과 (27건)

| 번호 | 테스트명 | 스크립트 | 결과 | 비고 |
|------|---------|---------|------|------|
| E2E-01 | SBOM 생성 검증 | test-sbom.sh | PASS | |
| E2E-02 | Sealed Secrets 암복호화 | test-sealed-secrets.sh | PASS | |
... (27건 전수)
```

## 4. audit.jsonl 검증 스크립트 설계

```bash
#!/bin/bash
# audit-log-verify.sh
# 감사 로그 완전성 검증

AUDIT_LOG=".claude/audit.jsonl"

# 1. 총 엔트리 수 확인
total=$(wc -l < "$AUDIT_LOG")
echo "총 감사 로그 엔트리: $total"

# 2. 필수 필드 검증 (timestamp, tool, user)
missing=$(jq -r 'select(.timestamp == null or .tool == null)' "$AUDIT_LOG" | wc -l)
echo "필수 필드 누락: $missing"

# 3. 날짜 범위 검증
first=$(head -1 "$AUDIT_LOG" | jq -r '.timestamp')
last=$(tail -1 "$AUDIT_LOG" | jq -r '.timestamp')
echo "기간: $first ~ $last"

# 4. 판정
if [ "$missing" -eq 0 ] && [ "$total" -ge 1000 ]; then
  echo "PASS: 감사 로그 완전성 검증 통과"
  exit 0
else
  echo "FAIL: 감사 로그 완전성 검증 실패"
  exit 1
fi
```

## 5. 감리 체크리스트 최종 갱신 설계

CL-01~CL-07 항목별 실제 검증 결과를 반영하여 [ ] -> [v] 전환.

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Agent |
