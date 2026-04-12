# Design: MTU-N27 Cosign 이미지 서명 실전 적용

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N27 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 선택 옵션 | Option B: Pragmatic Balance |

---

## Design Anchor

- **결정**: 로컬 키 쌍 모드 (Fulcio/Rekor 불필요) — 폐쇄망 호환
- **근거**: 공공기관 폐쇄망 환경에서 외부 인증 서버 의존 불가
- **영향**: Kyverno ClusterPolicy에 공개키 직접 임베드

---

## 아키텍처 옵션

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A | Keyless (Fulcio+Rekor) | 키 관리 불필요 | 외부 의존, 폐쇄망 불가 |
| **B** | **로컬 키 쌍** | **폐쇄망 호환, 단순** | **키 관리 필요** |
| C | Notary v2 | Harbor 네이티브 | 아직 초기 단계 |

**선택: Option B** — 폐쇄망 운영 + 단순 구현 + CSAP 증적 확보

---

## 구현 설계

### 1. 디렉토리 구조

```
infra/cosign/
  cosign.pub           # 공개키 (커밋 가능)
  README.md            # 키 관리 가이드
infra/kyverno/
  verify-image-signature.yaml  # ClusterPolicy
docs/08-infra/
  cosign-signing-guide.md      # 실전 가이드
```

### 2. 서명 워크플로우

```
Build → Push to Harbor → Cosign Sign → Kyverno Verify → Deploy
```

### 3. Kyverno 정책 설계

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: Audit   # 초기 Audit, 검증 후 Enforce
  rules:
    - name: verify-cosign-signature
      match:
        resources:
          kinds: [Pod]
          namespaces: [saas-platform]
      verifyImages:
        - imageReferences: ["localhost:8080/public-saas/*"]
          attestors:
            - entries:
                - keys:
                    publicKeys: |-
                      -----BEGIN PUBLIC KEY-----
                      {cosign.pub 내용}
                      -----END PUBLIC KEY-----
```

### 4. CI/CD 자동화

Gitea Actions 워크플로우에서 빌드 후 자동 서명:
```yaml
- name: Sign Image
  run: |
    cosign sign --key env://COSIGN_KEY \
      --tlog-upload=false \
      localhost:8080/public-saas/$IMAGE:$TAG
```

---

## Session Guide

| 단계 | 작업 | 예상 시간 |
|------|------|---------|
| S1 | Cosign 설치 + 키 생성 | 5분 |
| S2 | Harbor 이미지 서명 실행 | 10분 |
| S3 | 서명 검증 실행 | 5분 |
| S4 | Kyverno 정책 YAML 생성 | 10분 |
| S5 | CI/CD 워크플로우 + 가이드 문서 | 15분 |
