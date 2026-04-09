# ISMS-P 보호 분야: P-15~P-29 암호화 및 키 관리

> MTU-C6b | FR-2.4-P | 적용 기준일: 2026-04-05
> 참조: MTU-C6a (관리체계), CSAP D-09 (암호화 4항목)

---

## 개요

ISMS-P 보호대책 요구사항 중 암호화 분야 15개 항목의 구현 가이드입니다.
저장·전송 데이터 암호화, 키 생명주기 관리, PKI 인증서 운영을 다룹니다.

---

## 항목별 구현 가이드

### ISMS-P-P-15: 암호 정책 수립

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-15 |
| 요구사항 | 암호화 정책 및 적용 기준 수립 |
| 핵심 요건 | 암호 알고리즘 선정 기준, 키 길이 최소 요건, 암호화 적용 대상 정의 |
| CSAP 중첩 | CSAP-D09-01 (암호화 정책) |
| 구현 패턴 | AES-256-GCM (저장), TLS 1.3 (전송), bcrypt cost 12 (비밀번호) |

**승인 알고리즘 목록**:
| 용도 | 알고리즘 | 키 길이 | 비고 |
|------|---------|--------|------|
| 대칭 암호화 (저장) | AES-256-GCM | 256비트 | NIST FIPS 197 |
| 해시 (무결성) | SHA-256/384/512 | — | NIST FIPS 180-4 |
| 비밀번호 해싱 | bcrypt | cost 12 | OWASP 권장 |
| 전송 암호화 | TLS 1.3 | — | RFC 8446 |
| 비대칭 암호화 | RSA 2048+ / ECDSA P-256 | 2048비트+ | 인증서·전자서명 |
| 키 교환 | ECDHE | P-256 이상 | PFS 보장 |

---

### ISMS-P-P-16: 저장 데이터 암호화

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-16 |
| 요구사항 | 민감 데이터 저장 시 암호화 |
| 핵심 요건 | 개인정보·비밀번호·금융정보 암호화 저장, 암호화 키와 데이터 분리 보관 |
| CSAP 중첩 | CSAP-D09-02 (저장 암호화) |

**구현 예시**:
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

export function encrypt(plaintext: string, key: Buffer): EncryptedData {
  const iv = randomBytes(12) // GCM 권장 96비트 IV
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  return { ciphertext: encrypted, iv: iv.toString('hex'), authTag: authTag.toString('hex') }
}

export function decrypt(data: EncryptedData, key: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(data.iv, 'hex'))
  decipher.setAuthTag(Buffer.from(data.authTag, 'hex'))
  let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
```

---

### ISMS-P-P-17: 전송 데이터 암호화

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-17 |
| 요구사항 | 네트워크 전송 시 암호화 |
| 핵심 요건 | TLS 1.3+ 필수, HTTP 평문 전송 금지, 내부 서비스 간 mTLS 권장 |
| CSAP 중첩 | CSAP-D09-03 (전송 암호화) |

---

### ISMS-P-P-18: 암호 키 생성

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-18 |
| 요구사항 | 안전한 암호 키 생성 절차 |
| 핵심 요건 | CSPRNG 기반 키 생성, 키 생성 이력 기록, 키 강도 검증 |
| CSAP 중첩 | CSAP-D09-04 (키 관리) |

---

### ISMS-P-P-19: 암호 키 배포

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-19 |
| 요구사항 | 암호 키 안전한 배포 |
| 핵심 요건 | 키 배포 시 암호화된 채널 사용, Kubernetes Secret + 외부 Vault 연동 |
| CSAP 중첩 | CSAP-D09-04 (키 관리) |

**k3s 환경 패턴**:
```yaml
# Sealed Secrets로 키 암호화 배포
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: encryption-key
  namespace: app
spec:
  encryptedData:
    ENCRYPTION_KEY: AgBy3i4OJSWK+PiTySYZZA9...
```

---

### ISMS-P-P-20: 암호 키 저장

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-20 |
| 요구사항 | 암호 키 안전한 저장 |
| 핵심 요건 | 키와 암호화 데이터 물리적 분리, HSM 또는 소프트웨어 키스토어 사용 |
| CSAP 중첩 | CSAP-D09-04 (키 관리) |

---

### ISMS-P-P-21: 암호 키 사용

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-21 |
| 요구사항 | 암호 키 사용 기록 및 통제 |
| 핵심 요건 | 키 사용 이력 audit.jsonl 기록, 키 접근 권한 최소화 |
| CSAP 중첩 | CSAP-D09-04 (키 관리) |

---

### ISMS-P-P-22: 암호 키 갱신

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-22 |
| 요구사항 | 암호 키 정기 갱신 |
| 핵심 요건 | 대칭키: 연 1회, TLS 인증서: 만료 30일 전, 갱신 시 이전 키 안전 폐기 |
| CSAP 중첩 | CSAP-D09-04 (키 관리) |

---

### ISMS-P-P-23: 암호 키 폐기

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-23 |
| 요구사항 | 불필요 암호 키 안전 폐기 |
| 핵심 요건 | 키 폐기 시 복구 불가 처리, 폐기 이력 3년 보관 |
| CSAP 중첩 | CSAP-D09-04 (키 관리) |

---

### ISMS-P-P-24: 인증서 관리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-24 |
| 요구사항 | TLS/SSL 인증서 생명주기 관리 |
| 핵심 요건 | 인증서 목록 관리, 만료 30일 전 알림, 자동 갱신 설정 |
| CSAP 중첩 | 해당 없음 (ISMS-P 고유) |

**k3s 환경 패턴**: cert-manager + Let's Encrypt 자동 갱신

---

### ISMS-P-P-25: 전자서명 관리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-25 |
| 요구사항 | 전자서명 적용 및 검증 |
| 핵심 요건 | 코드 서명 (Sigstore Cosign), 문서 전자서명, 서명 검증 절차 |
| CSAP 중첩 | 해당 없음 (ISMS-P 고유), MTU-C8 Supply Chain 연계 |

---

### ISMS-P-P-26: 암호 알고리즘 적합성 검토

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-26 |
| 요구사항 | 사용 중인 암호 알고리즘 주기적 적합성 검토 |
| 핵심 요건 | 연 1회 알고리즘 강도 검토, 취약 알고리즘 사용 중지, KCMVP 인증 제품 권장 |
| CSAP 중첩 | 해당 없음 (ISMS-P 고유) |

---

### ISMS-P-P-27: 난수 생성기 관리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-27 |
| 요구사항 | 안전한 난수 생성기 사용 |
| 핵심 요건 | CSPRNG (crypto.randomBytes) 사용 필수, Math.random() 보안 용도 사용 금지 |
| CSAP 중첩 | 해당 없음 (ISMS-P 고유) |

---

### ISMS-P-P-28: 암호화 모듈 관리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-28 |
| 요구사항 | 암호화 라이브러리·모듈 버전 관리 |
| 핵심 요건 | OpenSSL/BoringSSL 버전 관리, 취약점 패치 즉시 적용, SBOM에 암호 모듈 포함 |
| CSAP 중첩 | 해당 없음 (ISMS-P 고유), MTU-C8 SBOM 연계 |

---

### ISMS-P-P-29: 암호화 예외 관리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-29 |
| 요구사항 | 암호화 미적용 예외 사항 관리 |
| 핵심 요건 | 암호화 예외 승인 절차, 예외 사유·기간·보완 조치 문서화, 연 1회 예외 재검토 |
| CSAP 중첩 | 해당 없음 (ISMS-P 고유) |

---

## CSAP 교차 참조 요약

| ISMS-P 항목 | CSAP 매핑 | 비고 |
|-------------|----------|------|
| ISMS-P-P-15 | CSAP-D09-01 | 완전 중복 |
| ISMS-P-P-16 | CSAP-D09-02 | 완전 중복 |
| ISMS-P-P-17 | CSAP-D09-03 | 완전 중복 |
| ISMS-P-P-18~23 | CSAP-D09-04 | 부분 중복 (키 생명주기 세분화) |
| ISMS-P-P-24~29 | — | ISMS-P 고유 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-C6b Do — 암호화 15항목 전수 작성 | Implementer Agent |
