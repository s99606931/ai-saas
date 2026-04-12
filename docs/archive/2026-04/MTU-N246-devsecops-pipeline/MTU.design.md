# Design: MTU-N246 DevSecOps 파이프라인 통합

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead (security-architect)

---

## Design Anchor

| 항목 | 값 |
|------|---|
| 패턴 | Shift-Left Security — CI 파이프라인 내 보안 게이트 |
| 도구 | Trivy (IaC + Image), Semgrep (SAST), Kyverno (Policy) |
| 기준 | CRITICAL: 0개 필수, HIGH: 보고 (임계값 조정 가능) |
| CSAP | D-05 (공급망), D-08 (접근 통제), D-12 (개발 보안) |

---

## S3. 상세 설계

### S3.1 Trivy IaC 스캔 (FR-N246.1)

```bash
# Helm 차트 + k8s YAML 보안 검사
trivy config --severity HIGH,CRITICAL \
  --exit-code 1 \
  --format table \
  infra/ deploy/ helm/
```

검사 항목: 권한 상승, 루트 실행, 리소스 제한 미설정, 호스트 네트워크 사용 등

### S3.2 Trivy 이미지 스캔 (FR-N246.2)

CI/CD 파이프라인의 이미지 빌드 후 자동 실행:
```bash
trivy image --severity HIGH,CRITICAL \
  --exit-code 0 \  # HIGH는 경고만
  --format sarif \
  --output trivy-report.sarif \
  ${IMAGE}:${TAG}
```

### S3.3 Semgrep SAST (FR-N246.3)

```bash
semgrep scan \
  --config auto \
  --config p/owasp-top-ten \
  --config p/typescript \
  --error \
  --sarif -o semgrep-report.sarif \
  platform/
```

### S3.4 Kyverno 사전 검증 (FR-N246.4)

배포 전 Kyverno 정책 위반 사전 검사:
```bash
kyverno apply infra/kyverno/ \
  --resource deploy/envs/${ENV}/ \
  --policy-report
```

### S3.5 파이프라인 흐름

```
   ┌─ Trivy IaC (병렬) ──────────────┐
   ├─ Semgrep SAST (병렬) ───────────┤
   ├─ Dependency Audit (병렬) ────────┤
   └─ Secret Scan (병렬) ────────────┘
                    │
              [결과 집계]
                    │
         ┌──── OK ────┐── FAIL ──→ 차단 + 알림
         ↓            ↓
   [이미지 빌드]  [보고서 저장]
         ↓
   Trivy Image Scan
         ↓
   Kyverno Dry-Run
         ↓
   [배포 승인]
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 최초 설계 | PM Lead (security-architect) |
