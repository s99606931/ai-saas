# Sigstore (Cosign) 이미지 서명 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | SC-SIGSTORE-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 독자 | DevOps 엔지니어, 보안 담당자, CSAP 심사 대응 팀 |
| FR 매핑 | FR-10.2 (이미지 서명 검증) |
| MTU 매핑 | MTU-C8 |
| 관련 문서 | [SBOM 가이드](sbom-guide.md), [Harbor 레지스트리](../harbor-registry-guide.md), [Flux GitOps](../flux-gitops-guide.md) |

<!-- Design Ref: MTU-C8 Plan -- Sigstore Cosign -->
<!-- Plan SC: Cosign 서명/검증, 미서명 이미지 배포 차단 -->

---

## 1. 개요

Sigstore 프로젝트의 Cosign 도구를 사용하여 컨테이너 이미지 서명 및 검증을 구현합니다. CI/CD 파이프라인에서 빌드된 이미지를 자동으로 서명하고, 배포 시 서명을 검증하여 무결성을 보장합니다.

### Sigstore 에코시스템 구성

| 구성 요소 | 역할 | 폐쇄망 대안 |
|---------|------|-----------|
| **Cosign** | 이미지 서명/검증 도구 | 로컬 키 쌍 사용 (Fulcio 불필요) |
| **Fulcio** | 인증서 발급 CA | 폐쇄망: 비활성 (로컬 키 사용) |
| **Rekor** | 투명성 로그 서버 | 폐쇄망: 로컬 Rekor 또는 비활성 |
| **cosign-policy-controller** | k8s 정책 강제 | Kyverno 또는 Harbor 정책 대체 |

### 폐쇄망 운영 모드

```
온라인 환경: Cosign + Fulcio (OIDC) + Rekor (공개 투명성 로그)
폐쇄망:     Cosign + 로컬 키 쌍 (Fulcio/Rekor 불필요)
```

**폐쇄망 선택**: 로컬 키 쌍 모드 (외부 인프라 의존 0)

---

## 2. Cosign 설치 및 키 관리

### 2.1 Cosign 설치

```bash
# 온라인 설치
curl -sSfL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 \
  -o /usr/local/bin/cosign
chmod +x /usr/local/bin/cosign

# 폐쇄망: 바이너리 직접 다운로드 후 USB 이동
# https://github.com/sigstore/cosign/releases

# 버전 확인
cosign version
```

### 2.2 키 쌍 생성

```bash
# Cosign 키 쌍 생성
# 비밀번호 설정 필수 (CSAP-D09 암호화 요건)
cosign generate-key-pair

# 생성 파일:
# cosign.key  — 비밀 키 (CI/CD 환경에서만 사용, Git 커밋 절대 금지)
# cosign.pub  — 공개 키 (검증용, 배포 가능)
```

### 2.3 키 관리 정책

| 키 유형 | 저장 위치 | 접근 권한 | 교체 주기 |
|--------|---------|---------|---------|
| 비밀 키 (cosign.key) | Gitea Actions 시크릿 | CI/CD 파이프라인만 | 연 1회 |
| 공개 키 (cosign.pub) | Kubernetes Secret | Harbor, Flux, Kyverno | 비밀 키와 동시 |
| 비밀 키 패스프레이즈 | Gitea Actions 시크릿 | CI/CD 파이프라인만 | 비밀 키와 동시 |

```bash
# Gitea Actions 시크릿에 비밀 키 등록
# Gitea UI: Settings > Secrets > COSIGN_KEY, COSIGN_PASSWORD

# Kubernetes Secret에 공개 키 등록
kubectl -n flux-system create secret generic cosign-public-key \
  --from-file=cosign.pub=cosign.pub

# Harbor 네임스페이스에도 공개 키 등록
kubectl -n harbor-system create secret generic cosign-public-key \
  --from-file=cosign.pub=cosign.pub
```

---

## 3. 이미지 서명 (CI/CD 파이프라인)

### 3.1 서명 명령어

```bash
# 이미지 서명 (비밀 키 사용)
COSIGN_PASSWORD="${COSIGN_PASSWORD}" \
  cosign sign --key cosign.key \
  harbor.internal/saas-org/saas-app:v1.0.0

# 서명 확인 (공개 키 사용)
cosign verify --key cosign.pub \
  harbor.internal/saas-org/saas-app:v1.0.0

# SBOM 첨부 + 서명
cosign attach sbom --sbom sbom.spdx.json \
  harbor.internal/saas-org/saas-app:v1.0.0
cosign sign --key cosign.key \
  --attachment sbom \
  harbor.internal/saas-org/saas-app:v1.0.0
```

### 3.2 Gitea Actions 서명 워크플로우

```yaml
# .gitea/workflows/ci.yaml
name: Build, Sign, Deploy
on:
  push:
    branches: [main]

jobs:
  build-and-sign:
    runs-on: ubuntu-latest
    steps:
      - name: 소스 체크아웃
        uses: actions/checkout@v4

      - name: 이미지 빌드
        run: |
          docker build -t harbor.internal/saas-org/saas-app:${{ gitea.sha }} .

      - name: Harbor 로그인 + 이미지 push
        run: |
          echo "${{ secrets.HARBOR_PASSWORD }}" | docker login harbor.internal -u ${{ secrets.HARBOR_USERNAME }} --password-stdin
          docker push harbor.internal/saas-org/saas-app:${{ gitea.sha }}

      - name: SBOM 생성 (Syft)
        run: |
          syft harbor.internal/saas-org/saas-app:${{ gitea.sha }} \
            -o spdx-json > sbom.spdx.json

      - name: 이미지 서명 (Cosign)
        env:
          COSIGN_PASSWORD: ${{ secrets.COSIGN_PASSWORD }}
        run: |
          echo "${{ secrets.COSIGN_KEY }}" > cosign.key
          cosign sign --key cosign.key \
            harbor.internal/saas-org/saas-app:${{ gitea.sha }}
          # 키 파일 즉시 삭제
          rm -f cosign.key

      - name: SBOM 첨부
        env:
          COSIGN_PASSWORD: ${{ secrets.COSIGN_PASSWORD }}
        run: |
          echo "${{ secrets.COSIGN_KEY }}" > cosign.key
          cosign attach sbom --sbom sbom.spdx.json \
            harbor.internal/saas-org/saas-app:${{ gitea.sha }}
          rm -f cosign.key

      - name: 감사 기록
        run: |
          echo '{"action":"IMAGE_SIGNED","image":"saas-app:${{ gitea.sha }}","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","actor":"ci-pipeline"}' \
            >> /var/log/audit/audit.jsonl
```

---

## 4. 서명 검증 (배포 시)

### 4.1 수동 검증

```bash
# 공개 키로 서명 검증
cosign verify --key cosign.pub \
  harbor.internal/saas-org/saas-app:v1.0.0

# 출력 예시 (성공)
# Verification for harbor.internal/saas-org/saas-app:v1.0.0 --
# The following checks were performed on each of these signatures:
#   - The cosign claims were validated
#   - The signatures were verified against the specified public key

# 출력 예시 (실패 — 미서명 이미지)
# Error: no matching signatures: failed to verify
```

### 4.2 Harbor 프로젝트 레벨 검증 (CSAP-D05-03)

```bash
# Harbor 프로젝트 보안 정책: Cosign 서명 필수
curl -X PUT "https://harbor.internal/api/v2.0/projects/saas-org" \
  -H "Authorization: Basic ${HARBOR_AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "enable_content_trust": "true",
      "enable_content_trust_cosign": "true"
    }
  }'

# 미서명 이미지 pull 시도 → 거부됨
# docker pull harbor.internal/saas-org/unsigned-image:latest
# Error: image is not signed
```

### 4.3 Kyverno 클러스터 정책 (MTU-C7 연동)

```yaml
# kyverno-verify-images.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signatures
  annotations:
    policies.kyverno.io/title: "컨테이너 이미지 서명 검증"
    policies.kyverno.io/description: "Cosign 서명 필수 (CSAP-D05-03, N2SF-N04)"
    policies.kyverno.io/severity: high
spec:
  validationFailureAction: Enforce         # 위반 시 배포 차단
  background: false
  rules:
    - name: verify-cosign-signature
      match:
        any:
          - resources:
              kinds:
                - Pod
              namespaces:
                - production
                - grade-s
                - grade-o
      verifyImages:
        - imageReferences:
            - "harbor.internal/*"
          attestors:
            - entries:
                - keys:
                    publicKeys: |-
                      -----BEGIN PUBLIC KEY-----
                      # cosign.pub 내용
                      -----END PUBLIC KEY-----
          mutateDigest: true               # 태그 → 다이제스트 변환 (태그 변조 방지)
          verifyDigest: true               # 다이제스트 검증
```

### 4.4 Flux 소스 검증

```yaml
# Flux GitRepository에서 커밋 서명 검증
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: saas-app
  namespace: flux-system
spec:
  verify:
    provider: cosign
    secretRef:
      name: cosign-public-key
```

---

## 5. 서명 키 교체 절차

### 5.1 연간 키 교체 프로세스

```bash
# 1. 새 키 쌍 생성
cosign generate-key-pair --output-key-prefix cosign-2027

# 2. 새 공개 키를 Kubernetes Secret에 추가
kubectl -n flux-system create secret generic cosign-public-key-2027 \
  --from-file=cosign.pub=cosign-2027.pub

# 3. Kyverno 정책 업데이트 (이전+새 키 모두 허용, 전환 기간)
# attestors에 새 공개 키 추가

# 4. Gitea Actions 시크릿 업데이트 (새 비밀 키)

# 5. 전환 기간 (30일): 이전 키로 서명된 이미지도 허용

# 6. 전환 완료 후: 이전 키 공개 키 정책에서 제거

# 7. 감사 기록
echo '{"action":"KEY_ROTATION","keyId":"cosign-2027","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' \
  >> /var/log/audit/audit.jsonl
```

---

## 6. SLSA 공급망 보안 성숙도 매핑

| SLSA 레벨 | 요건 | 현재 구현 상태 |
|---------|------|------------|
| SLSA L1 | 빌드 프로세스 문서화 | Gitea Actions YAML (MTU-I2) |
| SLSA L2 | 빌드 서비스 격리 | Gitea Runner 전용 Pod (MTU-I2) |
| SLSA L2 | 빌드 출처 증명 (provenance) | Cosign 서명 + SBOM 첨부 |
| SLSA L3 | 빌드 환경 격리 + 비결정적 빌드 방지 | 향후 과제 (Phase 5) |

---

## 7. CSAP·N2SF 준수 매핑

| 규제 항목 | 요건 | 구현 방법 | 검증 방법 |
|---------|------|---------|---------|
| CSAP-D05-03 | 소프트웨어 무결성 검증 | Cosign 이미지 서명 + 검증 | `cosign verify` 성공 |
| CSAP-D09-01 | 암호 키 관리 | 키 쌍 관리 정책 + 연간 교체 | 키 교체 감사 로그 확인 |
| CSAP-D12-02 | 배포 무결성 | Kyverno 정책 + Harbor 정책 | 미서명 이미지 배포 차단 확인 |
| N2SF-N04 | 저장 데이터 무결성 | 이미지 다이제스트 + 서명 | OCI 다이제스트 일치 확인 |
| N2SF-N05 | 데이터 영역 무결성 | SBOM + 서명 + 투명성 기록 | SBOM 아티팩트 존재 확인 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — Cosign 서명/검증 + 키 관리 + Kyverno 정책 + SLSA 매핑 | Claude Code |
