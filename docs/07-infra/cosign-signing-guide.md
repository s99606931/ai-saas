# Cosign 이미지 서명 실전 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | INFRA-COSIGN-002 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-08 |
| MTU 매핑 | MTU-N27 |
| CSAP 매핑 | D-05-03, D-09-01, D-12-08 |
| 관련 문서 | [Sigstore 가이드](supply-chain/sigstore-signing.md), [Harbor 가이드](harbor-registry-guide.md) |

<!-- Design Ref: MTU-N27 Design -->
<!-- Plan SC: FR-N27.1~FR-N27.5 -->

---

## 1. 개요

이 문서는 Cosign v3.0.6을 사용하여 Harbor 레지스트리의 컨테이너 이미지에 서명하고 검증하는
실전 가이드입니다. 폐쇄망 환경에서 로컬 키 쌍 모드로 운영합니다.

### 검증 완료 환경

| 구성 요소 | 버전 | 상태 |
|---------|------|------|
| Cosign | v3.0.6 | 설치 완료 |
| Harbor | v2.11.2 | http://localhost:8080 |
| k3s | v1.31+ | 36 pods Running |
| 서명 모드 | 로컬 키 쌍 | Fulcio/Rekor 불필요 |

---

## 2. Cosign 설치

```bash
# 최신 Cosign 바이너리 다운로드
curl -sSfL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 \
  -o /usr/local/bin/cosign
chmod +x /usr/local/bin/cosign

# 버전 확인
cosign version
# → v3.0.6
```

---

## 3. 키 쌍 생성

```bash
# 비밀번호 없이 키 쌍 생성 (개발 환경)
cd infra/cosign/
COSIGN_PASSWORD="" cosign generate-key-pair

# 결과:
# - cosign.key (개인키 — 절대 커밋 금지)
# - cosign.pub (공개키 — 커밋 가능)
```

### 키 관리 규칙

| 파일 | 보관 위치 | .gitignore |
|------|---------|-----------|
| cosign.key | Kubernetes Secret 또는 Vault | *.key 패턴으로 자동 제외 |
| cosign.pub | Git 저장소 + Kyverno 정책 | 커밋 가능 |
| signing-config.json | Git 저장소 | 커밋 가능 |

---

## 4. 서명 설정 (v3.x 전용)

Cosign v3.0.6에서 `--tlog-upload=false`가 제거되었습니다.
대신 signing-config 파일을 사용합니다.

```bash
# 투명성 로그 없는 서명 설정 생성
cosign signing-config create > signing-config.json

# 내용: {"mediaType":"...","rekorTlogConfig":{},"tsaConfig":{}}
```

---

## 5. 이미지 서명

```bash
# Harbor 이미지 서명
COSIGN_PASSWORD="" cosign sign \
  --key infra/cosign/cosign.key \
  --signing-config infra/cosign/signing-config.json \
  --allow-insecure-registry \
  localhost:8080/public-saas/test-app:latest

# 출력: "Signing artifact..." (성공)
```

### 주의사항

- `--allow-insecure-registry`: HTTP 레지스트리 허용 (개발 환경)
- 운영 환경에서는 TLS 적용 후 이 플래그 제거
- 태그 대신 digest 사용 권장: `@sha256:...`

---

## 6. 서명 검증

```bash
# 공개키로 서명 검증
cosign verify \
  --key infra/cosign/cosign.pub \
  --insecure-ignore-tlog \
  --allow-insecure-registry \
  localhost:8080/public-saas/test-app:latest

# 출력:
# Verification for localhost:8080/public-saas/test-app:latest --
# The following checks were performed on each of these signatures:
#   - The cosign claims were validated
#   - The signatures were verified against the specified public key
```

---

## 7. Kyverno 정책 적용

`infra/kyverno/verify-image-signature.yaml` 정책을 적용하면
saas-platform 네임스페이스에서 미서명 이미지 배포를 감사(Audit)합니다.

```bash
# Kyverno가 설치된 경우
kubectl apply -f infra/kyverno/verify-image-signature.yaml

# 정책 상태 확인
kubectl get clusterpolicy verify-image-signature

# Audit → Enforce 전환 (검증 완료 후)
kubectl patch clusterpolicy verify-image-signature \
  --type merge -p '{"spec":{"validationFailureAction":"Enforce"}}'
```

---

## 8. CI/CD 자동화

`.gitea/workflows/sign-image.yml` 워크플로우가 CI 빌드 완료 후
자동으로 이미지를 서명합니다.

### 필요한 Gitea Secrets

| Secret 이름 | 설명 |
|------------|------|
| HARBOR_USERNAME | Harbor 관리자 계정 |
| HARBOR_PASSWORD | Harbor 관리자 비밀번호 |
| COSIGN_PASSWORD | Cosign 키 비밀번호 (빈 문자열 가능) |

---

## 9. 트러블슈팅

### 9.1 `--tlog-upload=false` 오류 (v3.x)

```
Error: --tlog-upload=false is not supported with --signing-config
```

**해결**: `cosign signing-config create > signing-config.json` 후 `--signing-config` 사용

### 9.2 Harbor 인증 실패

```
Error: pushing signature: UNAUTHORIZED
```

**해결**: `cosign login localhost:8080 -u admin -p <password>` 실행

### 9.3 서명 검증 실패

```
Error: no matching signatures
```

**해결**: 서명 시 사용한 키 쌍의 공개키로 검증하는지 확인

---

## 10. CSAP 증적 체크리스트

| 항목 | CSAP 통제 | 증적 | 상태 |
|------|---------|------|------|
| 키 쌍 생성 | D-09-01 | cosign.pub 파일 | 완료 |
| 이미지 서명 | D-05-03 | cosign sign 실행 로그 | 완료 |
| 서명 검증 | D-12-08 | cosign verify 출력 | 완료 |
| 배포 정책 | D-08 | Kyverno YAML | 완료 |
| 자동화 | D-12-01 | Gitea Actions YAML | 완료 |
