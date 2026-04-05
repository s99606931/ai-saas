# MTU-I2: Gitea CI/CD 파이프라인

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-I2 |
| Phase | Phase 3 Infrastructure |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-5.2, FR-5.3 |
| 의존 MTU | MTU-I1 (k3s+WSL2) |
| 예상 세션 | 1 세션 |
| 중요도 | P0 |

---

## 목적

k3s 클러스터 내부에 Gitea와 Gitea Actions를 설치하여, 외부 클라우드 서비스에 의존하지 않는 완전 자립형 CI/CD 파이프라인을 구성합니다. 빌드 → 테스트 → SBOM 생성 → 이미지 서명 → 배포의 전 과정을 단일 Gitea Actions 워크플로우로 자동화하며, CSAP-D12 배포 보안 요건과 감사 로그 자동 기록을 충족합니다.

**시장조사 반영**:
- 폐쇄망 요건: GitHub Actions, GitLab CI 등 외부 SaaS 사용 불가 → Gitea Acts 선택
- Gitea v1.21+: Actions 기능 GA 진입, GitHub Actions YAML 구문 99% 호환
- SBOM 의무화 추세: NTIA SBOM 가이드라인 + 국정원 공급망 보안 지침 대응 (MTU-C8 연동)
- Harbor v2.9+: Cosign 네이티브 서명 검증 정책 지원 강화

---

## 산출물 파일 (4개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `05-infra/gitea-cicd-guide.md` | 구현가이드형 | Gitea 설치 + Actions 러너 구성 절차 |
| `05-infra/gitea-actions-templates/build-test.yml` | 액션 템플릿 | 빌드 및 단위 테스트 워크플로우 |
| `05-infra/gitea-actions-templates/security-scan.yml` | 액션 템플릿 | SBOM 생성 + Trivy 취약점 스캔 + Cosign 서명 |
| `05-infra/gitea-actions-templates/deploy-k3s.yml` | 액션 템플릿 | k3s 배포 및 감사 로그 기록 워크플로우 |

---

## 아키텍처 개요

```
[개발자 로컬] ──push──▶ [Gitea (k3s 내부)]
                              │
                    ┌─────────▼──────────┐
                    │  Gitea Actions     │
                    │  ┌─────────────┐   │
                    │  │ 1. Build    │   │
                    │  │ 2. Test     │   │
                    │  │ 3. SBOM 생성│   │  ◀── MTU-C8 연동
                    │  │ 4. 이미지 서명│  │  ◀── Cosign/Sigstore
                    │  │ 5. Harbor push│ │
                    │  │ 6. k3s 배포 │   │
                    │  │ 7. audit 기록│  │  ◀── CSAP-D06
                    │  └─────────────┘   │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Harbor 레지스트리  │  ◀── MTU-I3 연동
                    │  (k3s 내부)        │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  k3s 클러스터 배포  │
                    └────────────────────┘
```

---

## 핵심 설계 내용

### 1. Gitea 설치 (k3s 내부, Helm 차트)

```yaml
# Gitea Helm values 핵심 설정
gitea:
  admin:
    username: gitea-admin
    # password: 환경 변수에서 주입 (하드코딩 금지, CSAP-D09)
  config:
    server:
      DOMAIN: gitea.internal.svc.cluster.local
      HTTP_PORT: 3000
      PROTOCOL: https           # TLS 1.3+ 필수 (CSAP-D09)
    actions:
      ENABLED: true
      DEFAULT_ACTIONS_URL: local  # 외부 GitHub Actions URL 참조 금지
    security:
      INSTALL_LOCK: true
      SECRET_KEY:   # 환경 변수 주입
      INTERNAL_TOKEN: # 환경 변수 주입
```

### 2. Actions 러너 구성 (k3s DaemonSet)

```yaml
# gitea-runner DaemonSet 핵심 설정
spec:
  containers:
  - name: gitea-runner
    image: gitea/act_runner:latest
    env:
    - name: GITEA_INSTANCE_URL
      value: "https://gitea.internal.svc.cluster.local:3000"
    - name: GITEA_RUNNER_REGISTRATION_TOKEN
      valueFrom:
        secretKeyRef:
          name: gitea-runner-secret
          key: token
    securityContext:
      runAsNonRoot: true         # CSAP-D11 요건
      readOnlyRootFilesystem: true
```

### 3. CI/CD 파이프라인 단계 정의

| 단계 | 도구 | 산출물 | CSAP 항목 |
|------|------|--------|---------|
| 1. 빌드 | Docker Buildx | 컨테이너 이미지 | D-12 |
| 2. 단위 테스트 | Jest/pytest | 테스트 결과 XML | D-12 |
| 3. SBOM 생성 | Syft | sbom.spdx.json | D-05 공급망 |
| 4. 취약점 스캔 | Trivy | trivy-report.json | D-12 |
| 5. 이미지 서명 | Cosign | OCI 서명 레이어 | D-12 |
| 6. Harbor push | docker push | 서명된 이미지 | D-09 |
| 7. k3s 배포 | kubectl apply | 배포 결과 | D-08 |
| 8. 감사 기록 | auditLog() | audit.jsonl | D-06 |

### 4. CSAP-D12 배포 보안 체크리스트

| 항목 ID | 요건 | 구현 방법 |
|---------|------|---------|
| D12-01 | 배포 전 취약점 스캔 | Trivy → 고위험(HIGH) 이상 시 파이프라인 중단 |
| D12-02 | 이미지 무결성 검증 | Cosign 서명 + Harbor 정책으로 미서명 이미지 배포 차단 |
| D12-03 | 비밀 정보 하드코딩 금지 | gitleaks를 Actions에서 자동 실행 |
| D12-04 | 배포 승인 워크플로우 | main 브랜치 배포 시 리뷰어 승인 필수 |
| D12-05 | 롤백 절차 | Flux GitOps와 연계한 자동 롤백 (MTU-I3) |

### 5. 감사 로그 자동 기록 (CSAP-D06)

```yaml
# deploy-k3s.yml 감사 로그 단계
- name: 배포 감사 로그 기록
  run: |
    cat >> /shared/audit.jsonl << EOF
    {
      "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
      "actor": "${{ gitea.actor }}",
      "action": "DEPLOY",
      "target": "${{ gitea.repository }}@${{ gitea.sha }}",
      "pipeline_run_id": "${{ gitea.run_id }}",
      "environment": "production",
      "result": "success"
    }
    EOF
```

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-5.2 | CI/CD 파이프라인 자동화 | commit push 후 5분 이내 전체 파이프라인 완료 |
| FR-5.3 | 배포 보안 요건 충족 | D12-01~D12-05 체크리스트 전 항목 통과 |

---

## 합격 기준

1. Gitea 설치 및 k3s 내부 접근 확인 (`https://gitea.internal.svc.cluster.local:3000` 응답)
2. Actions 파이프라인 빌드→테스트→배포 전체 동작 (파이프라인 성공 스크린샷)
3. SBOM 자동 생성 확인 (MTU-C8 연동, `sbom.spdx.json` 아티팩트 존재)
4. Harbor 이미지 push/pull 확인 (Harbor UI에서 서명된 이미지 태그 확인)
5. CSAP-D12 배포 보안 체크리스트 D12-01~D12-05 전 항목 통과

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 | Claude Code |
| 0.2.0 | 2026-04-05 | P0-06: FR-5.1 중복 해소 — CI/CD 요건을 FR-5.2로 재부번 | CTO 팀 검토 |
