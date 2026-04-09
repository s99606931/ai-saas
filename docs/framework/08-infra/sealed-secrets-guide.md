# Sealed Secrets GitOps 시크릿 관리 운영 가이드

> **버전**: 1.0.0 | **작성일**: 2026-04-09
> **Design Ref**: MTU-N39 Design
> **CSAP 참조**: D-09(암호화), D-08(접근 통제)

---

## 1. 개요

Bitnami Sealed Secrets를 사용하여 Kubernetes 시크릿을 안전하게 Git에 저장하고 Flux GitOps로 자동 배포합니다.

### 1.1 아키텍처

```
개발자 → kubeseal 암호화 → SealedSecret YAML → Git 커밋
                                                    ↓
                                              Flux 감지
                                                    ↓
                                         SealedSecret 적용
                                                    ↓
                                    컨트롤러가 Secret 복호화
                                                    ↓
                                         Pod에서 Secret 사용
```

### 1.2 보안 원칙

- **공개키 암호화**: 누구나 암호화 가능, 클러스터만 복호화 가능
- **Git 안전 저장**: 암호화된 SealedSecret만 Git에 저장
- **strict scope**: namespace 고정 (CVE-2026-22728 대응)
- **키 로테이션**: 30일 주기 자동 갱신

---

## 2. 설치

### 2.1 컨트롤러 설치

```bash
# Helm 저장소 추가
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm repo update

# 컨트롤러 설치
helm install sealed-secrets sealed-secrets/sealed-secrets \
  --namespace kube-system \
  -f infra/sealed-secrets/values.yaml \
  --wait
```

### 2.2 kubeseal CLI 설치

```bash
# Linux/WSL2
KUBESEAL_VERSION="0.27.3"
curl -sSfL "https://github.com/bitnami-labs/sealed-secrets/releases/download/v${KUBESEAL_VERSION}/kubeseal-${KUBESEAL_VERSION}-linux-amd64.tar.gz" | \
  tar -xzf - kubeseal
sudo mv kubeseal /usr/local/bin/
kubeseal --version
```

---

## 3. 시크릿 생성 절차

### 3.1 새 시크릿 생성

```bash
# 1. 일반 시크릿 생성 (YAML, --dry-run)
kubectl create secret generic my-secret \
  --from-literal=KEY1=value1 \
  --from-literal=KEY2=value2 \
  --namespace saas-platform \
  --dry-run=client -o yaml > /tmp/secret.yaml

# 2. kubeseal로 암호화 (반드시 --scope strict)
kubeseal --format yaml \
  --scope strict \
  --controller-namespace kube-system \
  --controller-name sealed-secrets \
  < /tmp/secret.yaml > infra/sealed-secrets/templates/my-secret.yaml

# 3. 임시 파일 즉시 삭제 (평문 보호)
rm -f /tmp/secret.yaml

# 4. Git 커밋
git add infra/sealed-secrets/templates/my-secret.yaml
git commit -m "feat(secrets): my-secret SealedSecret 추가"
```

### 3.2 시크릿 업데이트

기존 SealedSecret을 업데이트하려면 동일 절차로 새로 생성하여 덮어씁니다.

### 3.3 시크릿 삭제

```bash
# Git에서 파일 삭제 -> Flux가 자동으로 클러스터에서도 제거
git rm infra/sealed-secrets/templates/my-secret.yaml
git commit -m "feat(secrets): my-secret 삭제"
```

---

## 4. 키 로테이션

### 4.1 자동 로테이션

`values.yaml`의 `--key-renew-period=720h` 설정으로 30일마다 자동 갱신됩니다.
이전 키는 유지되어 기존 SealedSecret 복호화에 문제 없습니다.

### 4.2 수동 로테이션 (긴급)

```bash
# 현재 키 백업
kubectl get secret -n kube-system -l sealedsecrets.bitnami.com/sealed-secrets-key -o yaml > /secure/sealed-secrets-keys-backup.yaml

# 컨트롤러 재시작 (새 키 생성)
kubectl rollout restart deployment sealed-secrets -n kube-system

# 기존 SealedSecret 재암호화 (새 키로)
for f in infra/sealed-secrets/templates/*.yaml; do
  # 각 SealedSecret을 새 키로 재생성 필요
  echo "[TODO] ${f} 재암호화 필요"
done
```

### 4.3 키 백업

```bash
# 암호화 키 백업 (안전한 오프라인 저장소에 보관)
kubectl get secret -n kube-system \
  -l sealedsecrets.bitnami.com/sealed-secrets-key \
  -o yaml > /secure/sealed-secrets-master-key.yaml

# 주의: 이 파일은 절대 Git에 커밋하지 않습니다!
```

---

## 5. CVE-2026-22728 대응

### 5.1 취약점 설명

Sealed Secrets의 키 로테이션 메커니즘에서 메타데이터 조작으로 namespace-scoped 시크릿을 cluster-wide로 확장 가능.

### 5.2 대응 조치

1. **strict scope 강제**: 모든 kubeseal 명령에 `--scope strict` 사용
2. **Kyverno 정책**: cluster-wide SealedSecret 생성 차단
   - `infra/sealed-secrets/templates/sealed-secret-policy.yaml`
3. **버전 업데이트**: v0.27.3+ 사용 (패치 포함)

---

## 6. CSAP D-09 매핑

| CSAP 항목 | 구현 | 증적 |
|----------|------|------|
| D-09-01 암호화 키 관리 | Sealed Secrets 자동 키 관리 + 30일 로테이션 | values.yaml |
| D-09-02 데이터 암호화 | SealedSecret 비대칭 암호화 (RSA-OAEP) | SealedSecret YAML |
| D-09-03 암호 알고리즘 | RSA-4096 공개키 암호화 | 컨트롤러 기본 설정 |
| D-09-04 키 보관 | 클러스터 내 Secret으로 보관, 백업 절차 | 키 백업 가이드 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
