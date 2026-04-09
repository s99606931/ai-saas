# N04 암호화 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | N2SF-N04-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| N2SF 영역 | N04 암호화 |
| 대상 독자 | 개발자, 인프라 엔지니어, 보안 담당자 |
| FR 매핑 | FR-3.3, FR-3.4, FR-3.5 |
| MTU 매핑 | MTU-C5 |

<!-- Design Ref: MTU-C5 Plan -- N04 암호화 -->
<!-- Plan SC: KCMVP 승인 알고리즘, CSAP D09 전수 역참조 -->

---

## 1. 영역 개요

N04 암호화 영역은 데이터 저장(at-rest) 및 전송(in-transit) 시 암호화 요건을 정의합니다.
CSAP D09(암호화) 4개 항목 전수와 직접 대응되며, 공공기관 특성상 KCMVP(국가암호검증) 승인 알고리즘 사용이 필수입니다.

### 핵심 원칙

- **KCMVP 필수**: 국가/공공기관 암호 모듈은 KCMVP 인증 알고리즘만 사용
- **등급별 강도**: C 등급은 최고 수준 암호화, O 등급은 표준 수준
- **키 수명 주기**: 생성 → 배포 → 사용 → 교체 → 폐기 전 과정 관리

---

## 2. KCMVP 승인 알고리즘 목록

| 용도 | 승인 알고리즘 | 금지 알고리즘 | 비고 |
|------|------------|------------|------|
| 대칭 암호화 | ARIA-128/192/256, AES-128/192/256 | DES, 3DES, RC4, Blowfish | ARIA는 한국 표준 |
| 비대칭 암호화 | RSA-2048+, ECDSA P-256/P-384 | RSA-1024 이하, DSA | 2048비트 미만 금지 |
| 해시 | SHA-256, SHA-384, SHA-512 | MD5, SHA-1 | SHA-1은 서명 금지 |
| 키 교환 | ECDH P-256+, DH-2048+ | DH-1024 이하 | PFS 지원 필수 |
| 메시지 인증 | HMAC-SHA256, GCM (AEAD) | HMAC-MD5, CBC-MAC | AEAD 모드 권장 |

---

## 3. C/S/O 등급별 통제 요건

| 통제 항목 | C 등급 (기밀) | S 등급 (민감) | O 등급 (공개) |
|---------|-------------|-------------|-------------|
| 저장 암호화 | AES-256-GCM + 전용 HSM | AES-256-GCM + 소프트웨어 키 관리 | AES-256-CBC 허용 |
| 전송 암호화 | TLS 1.3 전용 + mTLS 필수 | TLS 1.3 필수 + mTLS 권고 | TLS 1.2+ 허용 |
| 키 관리 | 전용 HSM (FIPS 140-2 Level 3) | Sealed Secrets + 주기적 교체 | 환경 변수 + Vault 권고 |
| 키 교체 주기 | 90일 | 180일 | 365일 |
| 디스크 암호화 | Full Disk Encryption (LUKS + BitLocker) | 파티션 암호화 | 권고 |
| DB 암호화 | TDE + 컬럼 레벨 암호화 | 컬럼 레벨 암호화 | 민감 컬럼만 |
| 비밀번호 해시 | bcrypt (cost=14) + pepper | bcrypt (cost=12) | bcrypt (cost=10) |

---

## 4. CSAP D09 통제항목 역참조 (4항목 전수)

| CSAP ID | 항목명 | N04 구현 요건 | 구현 패턴 |
|---------|--------|------------|---------|
| [CSAP-D09-01](../../02-csap/standard-grade/implementation-guide/D09-encryption.md#csap-d09-01) | 저장 데이터 암호화 | KCMVP 승인 알고리즘으로 민감 데이터 암호화 | AES-256-GCM |
| [CSAP-D09-02](../../02-csap/standard-grade/implementation-guide/D09-encryption.md#csap-d09-02) | 전송 데이터 암호화 | TLS 1.3+, HTTP 직접 통신 금지 | TLS 1.3 + mTLS |
| [CSAP-D09-03](../../02-csap/standard-grade/implementation-guide/D09-encryption.md#csap-d09-03) | 암호 키 관리 | 키 생성·배포·교체·폐기 절차 수립 | HSM / Sealed Secrets |
| [CSAP-D09-04](../../02-csap/standard-grade/implementation-guide/D09-encryption.md#csap-d09-04) | 암호 알고리즘 강도 | KCMVP 승인 알고리즘 사용, 취약 알고리즘 사용 금지 | 알고리즘 화이트리스트 |

---

## 5. 구현 패턴

### 5.1 저장 데이터 암호화 (AES-256-GCM)

```typescript
// N04 + CSAP-D09-01 저장 데이터 암호화 패턴
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'    // KCMVP 승인 알고리즘
const IV_LENGTH = 16               // 초기화 벡터 16바이트
const AUTH_TAG_LENGTH = 16         // GCM 인증 태그 16바이트

interface EncryptedPayload {
  iv: string           // Base64 인코딩
  encryptedData: string // Base64 인코딩
  authTag: string      // GCM 인증 태그 (무결성 검증)
}

// 암호화 (CSAP-D09-01)
function encrypt(plaintext: string, key: Buffer): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  return {
    iv: iv.toString('base64'),
    encryptedData: encrypted,
    authTag: cipher.getAuthTag().toString('base64'),
  }
}

// 복호화
function decrypt(payload: EncryptedPayload, key: Buffer): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'))

  let decrypted = decipher.update(payload.encryptedData, 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// 키는 환경 변수에서 로드 (하드코딩 금지, CSAP-D09-03)
const ENCRYPTION_KEY = Buffer.from(
  process.env.ENCRYPTION_KEY ?? (() => { throw new Error('ENCRYPTION_KEY 미설정') })(),
  'hex'
)
```

### 5.2 TLS 1.3 설정 (k3s Ingress)

```yaml
# N04 + CSAP-D09-02 TLS 1.3 Ingress 설정
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: secure-ingress
  namespace: grade-o
  labels:
    n2sf.area: "N04"
  annotations:
    csap.control: "D09-02"
    # Traefik TLS 1.3 강제
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.tls.options: "strict-tls@file"
spec:
  tls:
    - hosts:
        - app.public-saas.go.kr
      secretName: tls-cert-secret
  rules:
    - host: app.public-saas.go.kr
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app-service
                port:
                  number: 443
---
# Traefik TLS 옵션 (ConfigMap)
apiVersion: v1
kind: ConfigMap
metadata:
  name: traefik-tls-options
  namespace: kube-system
data:
  tls-options.yaml: |
    tls:
      options:
        strict-tls:
          minVersion: VersionTLS13    # TLS 1.3 최소 버전
          cipherSuites:
            - TLS_AES_256_GCM_SHA384
            - TLS_CHACHA20_POLY1305_SHA256
            - TLS_AES_128_GCM_SHA256
```

### 5.3 Sealed Secrets (키 관리, CSAP-D09-03)

```yaml
# Sealed Secrets — Git에 안전하게 Secret 저장
# 평문 Secret을 kubeseal로 암호화 후 커밋
# CSAP-D09-03 키 관리 + N04 암호화
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: db-credentials
  namespace: grade-s
  labels:
    n2sf.area: "N04"
  annotations:
    csap.control: "D09-01, D09-03"
    sealedsecrets.bitnami.com/cluster-wide: "false"
spec:
  encryptedData:
    DB_PASSWORD: AgBy3m...  # kubeseal 도구로 암호화된 값
    DB_HOST: AgCx8k...
  template:
    metadata:
      name: db-credentials
      namespace: grade-s
      labels:
        n2sf.area: "N04"
```

### 5.4 비밀번호 해시 (bcrypt)

```typescript
// N04 + CSAP-D09-04 비밀번호 해시 정책
import bcrypt from 'bcrypt'

// 등급별 bcrypt cost factor
const BCRYPT_COST: Record<DataGrade, number> = {
  C: 14,     // 기밀: 높은 연산 비용 (약 1초)
  S: 12,     // 민감: 중간 (약 250ms)
  O: 10,     // 공개: 표준 (약 65ms)
}

async function hashPassword(
  password: string,
  grade: DataGrade
): Promise<string> {
  // CSAP-D09-04: 취약 알고리즘 사용 금지 (MD5, SHA-1 등)
  return bcrypt.hash(password, BCRYPT_COST[grade])
}

async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}
```

---

## 6. 키 수명 주기 관리

```
키 생성 (Generation)
    │
    ▼
키 배포 (Distribution)
    │ - Sealed Secrets 또는 HSM을 통해 안전하게 배포
    │ - 평문 키 전송 금지
    ▼
키 사용 (Usage)
    │ - 사용 목적별 키 분리 (암호화 키 ≠ 서명 키)
    │ - 키 사용 로그 기록 (CSAP-D09-03)
    ▼
키 교체 (Rotation)
    │ - C등급: 90일 / S등급: 180일 / O등급: 365일
    │ - 이전 키로 암호화된 데이터 재암호화 필수
    ▼
키 폐기 (Destruction)
    │ - 안전한 삭제 (메모리 제로화)
    │ - 폐기 기록 보관 (audit.jsonl)
    ▼
키 폐기 증적 보관
```

---

## 7. 취약 알고리즘 탐지

```bash
#!/bin/bash
# N04 취약 알고리즘 사용 탐지 스크립트
echo "=== N04 취약 알고리즘 탐지 $(date +%Y-%m-%d) ==="

# 1. 소스 코드에서 금지 알고리즘 사용 탐지
echo "--- 소스 코드 금지 알고리즘 탐지 ---"
grep -rn --include="*.ts" --include="*.js" \
  -E "(md5|sha1|des-|rc4|blowfish)" src/ || echo "  [정상] 금지 알고리즘 미발견"

# 2. TLS 1.2 미만 설정 탐지
echo "--- TLS 최소 버전 확인 ---"
grep -rn --include="*.yaml" --include="*.yml" \
  -E "(TLSv1\.0|TLSv1\.1|VersionTLS10|VersionTLS11)" . || \
  echo "  [정상] TLS 1.2 미만 설정 미발견"

# 3. 하드코딩된 키/비밀번호 탐지
echo "--- 하드코딩 시크릿 탐지 ---"
grep -rn --include="*.ts" --include="*.js" \
  -E "(password|secret|api.?key)\s*[:=]\s*['\"][^'\"]{8,}" src/ || \
  echo "  [정상] 하드코딩 시크릿 미발견"

echo "=== 탐지 완료 ==="
```

---

## 8. 증적 자료 체크리스트

| 번호 | 증적 자료 | 보관 주기 | 비고 |
|------|---------|---------|------|
| 1 | 암호화 정책서 | 영구 | KCMVP 승인 알고리즘 목록 포함 |
| 2 | TLS 인증서 목록 | 최신 유지 | 만료일 관리 |
| 3 | 키 교체 이력 | 3년 | 등급별 교체 주기 준수 확인 |
| 4 | Sealed Secrets 배포 이력 | 1년 | Git 커밋 이력 |
| 5 | 취약 알고리즘 탐지 결과 | 1년 | 월 1회 실행 |
| 6 | HSM 인증서 (C 등급) | 영구 | FIPS 140-2 Level 3 |

---

## 9. 관련 문서

- [CSAP x N2SF 전수 매핑 테이블](../csap-n2sf-mapping.md) (MTU-C4)
- [CSAP D09 암호화 구현 가이드](../../02-csap/standard-grade/implementation-guide/D09-encryption.md)
- [N03 격리 구현 가이드](./N03-isolation.md) (암호화 + 격리 연계)
- [N05 데이터 구현 가이드](./N05-data.md) (데이터 암호화 저장)
- [컨테이너 보안 베이스라인](../../08-infra/container-security-baseline.md) (MTU-I1)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — N04 암호화 구현 가이드 (KCMVP 알고리즘 + CSAP D09 역참조) | Claude Code |
