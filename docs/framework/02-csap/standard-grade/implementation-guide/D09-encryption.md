# D09 암호화 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | CSAP-IMPL-D09 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| CSAP 분야 | D09 암호화 |
| 항목 수 | 4개 (CSAP-D09-01 ~ D09-04) |
| 통제 유형 | 기술적 통제 |
| 심사 방법 | 설정 확인 + 기술 검증 |
| 마스터 체크리스트 | [checklist-master.md#csap-d09-01](../checklist-master.md#csap-d09-01) |
| FR 매핑 | FR-2.3-D09 |

<!-- Design Ref: MTU-C3 Plan -- D09 암호화 -->
<!-- Plan SC: AES-256 코드 예시 + TLS 1.3 설정 방법 완비 -->

---

## 분야 개요

암호화는 데이터의 **기밀성을 보장**하는 핵심 기술 통제입니다. 저장 데이터(at rest)와 전송 데이터(in transit) 모두 적절한 암호화를 적용해야 하며, 암호화 키의 안전한 관리가 필수입니다.

**핵심 키워드**: AES-256-GCM, TLS 1.3, bcrypt, 키 관리, KCMVP

---

## CSAP-D09-01: 데이터 전송 암호화

> **중요도**: 상 | **구분**: 필수

### 구현 목표

TLS 1.3+(최소 1.2)을 적용하고 HTTP 평문 통신을 완전 차단한다.

### 구현 방법

**Caddy (권장) TLS 설정**

```
# Caddyfile: 자동 TLS 1.3 (기본 설정)
your-domain.go.kr {
    reverse_proxy localhost:3000
    tls {
        protocols tls1.3
    }
    header Strict-Transport-Security "max-age=31536000; includeSubDomains"
}

# HTTP -> HTTPS 자동 리디렉션 (Caddy 기본)
```

**Nginx TLS 설정**

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.go.kr;

    ssl_protocols TLSv1.3;
    ssl_ciphers TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256;
    ssl_prefer_server_ciphers on;

    # HSTS (1년)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # HTTP 평문 통신 완전 차단
    # 별도 server 블록에서 301 리디렉션
}

server {
    listen 80;
    server_name your-domain.go.kr;
    return 301 https://$host$request_uri;
}
```

**내부 서비스 간 mTLS (k3s)**

```yaml
# k3s 서비스 간 mTLS: Traefik IngressRoute
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: api-route
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`api.internal`)
      kind: Rule
      services:
        - name: api-server
          port: 3000
  tls:
    secretName: internal-tls-cert
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| SSL/TLS 인증서 | 인증서 파일 | 시크릿 관리 (Sealed Secrets) |
| 서버 TLS 설정 | 설정 파일 | Git 저장소 |
| SSL Labs 테스트 결과 (A+ 등급) | 스크린샷/보고서 | 문서관리시스템 |

---

## CSAP-D09-02: 데이터 저장 암호화

> **중요도**: 상 | **구분**: 필수

### 구현 목표

민감 데이터를 AES-256 이상으로 암호화 저장하고, 비밀번호는 bcrypt(12+)로 해시한다.

### 구현 방법

```typescript
// AES-256-GCM 저장 암호화 (CSAP-D09-02)
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // IV:AuthTag:Ciphertext 형식으로 저장
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(encryptedData: string, key: Buffer): string {
  const [ivHex, authTagHex, ciphertextHex] = encryptedData.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

// 사용 예시
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')  // 32바이트
if (ENCRYPTION_KEY.length !== 32) throw new Error('ENCRYPTION_KEY 길이 오류: 32바이트 필수')

const encrypted = encrypt('민감 데이터', ENCRYPTION_KEY)
const decrypted = decrypt(encrypted, ENCRYPTION_KEY)
```

```typescript
// bcrypt 비밀번호 해시 (CSAP-D09-02, D09-04)
import bcrypt from 'bcrypt'

const BCRYPT_COST = 12  // cost factor 12 이상 필수

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// 평문 저장 절대 금지 (BLOCKED)
// const user = await db.create({ password: plainPassword })
```

**DB 레벨 암호화 (PostgreSQL)**

```sql
-- PostgreSQL Transparent Data Encryption (TDE)
-- 또는 컬럼 레벨 암호화
-- pgcrypto 확장 사용
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 민감 데이터 컬럼 암호화 저장
INSERT INTO users (name, email_encrypted)
VALUES (
  '홍길동',
  pgp_sym_encrypt('hong@example.go.kr', current_setting('app.encryption_key'))
);
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 암호화 설정 (코드/설정) | 소스코드 | Git 저장소 |
| DB 스키마 (암호화 컬럼 확인) | DDL/스키마 | Git 저장소 |
| 코드 리뷰 결과 (평문 저장 없음) | 리뷰 기록 | Git PR |

---

## CSAP-D09-03: 암호 키 관리

> **중요도**: 상 | **구분**: 필수

### 구현 목표

암호화 키의 생성/보관/교체/폐기 수명 주기를 관리한다.

### 구현 방법

**키 수명 주기**

```
생성 (Generation)
    │  안전한 난수 생성기 (crypto.randomBytes)
    ▼
보관 (Storage)
    │  환경 변수 또는 Sealed Secrets (k3s)
    │  절대 소스코드/Git 커밋 금지
    ▼
사용 (Usage)
    │  메모리에서만 복호화, 디스크 캐시 금지
    ▼
교체 (Rotation)
    │  연 1회 이상 정기 교체
    │  교체 시 기존 데이터 재암호화
    ▼
폐기 (Destruction)
    │  안전 삭제 (메모리 제로화)
    │  교체 후 이전 키 90일 유지 후 폐기
```

**키 관리 정책**

| 항목 | 정책 |
|------|------|
| 키 길이 | AES-256: 32바이트, RSA: 2048비트 이상 |
| 키 저장 | 환경 변수 (`.env`는 Git 미포함) 또는 Sealed Secrets |
| 키 접근 | 시스템 계정만 접근, 개인 직접 접근 금지 |
| 키 교체 | 연 1회 이상 (긴급: 키 유출 의심 시 즉시) |
| 키 백업 | 별도 안전 저장소에 암호화 백업 |
| 키 폐기 | 이전 키 90일 유지(재암호화 기간) 후 안전 삭제 |

```bash
# 안전한 키 생성 (32바이트 = 256비트)
openssl rand -hex 32
# 결과 예: a1b2c3d4e5f6...  (64자 hex 문자열)

# k3s Sealed Secrets로 키 관리
echo -n "a1b2c3d4e5f6..." | kubectl create secret generic encryption-key \
  --from-file=ENCRYPTION_KEY=/dev/stdin \
  --namespace=production \
  --dry-run=client -o yaml | kubeseal -o yaml > sealed-encryption-key.yaml
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 키 관리 절차서 | PDF/문서 | 문서관리시스템 |
| KMS/Sealed Secrets 설정 | 설정 파일 | 인프라 관리 |
| 키 교체 이력 | 기록 | audit.jsonl |

---

## CSAP-D09-04: 암호화 알고리즘 적정성

> **중요도**: 중 | **구분**: 필수

### 구현 목표

국정원 검증 또는 국제 표준 암호 알고리즘만 사용하고 취약 알고리즘을 차단한다.

### 구현 방법

**허용 알고리즘 목록**

| 용도 | 허용 알고리즘 | 금지 알고리즘 |
|------|------------|------------|
| 대칭 암호 | AES-256-GCM, AES-256-CBC | DES, 3DES, RC4, Blowfish |
| 해시 | SHA-256, SHA-384, SHA-512 | MD5, SHA-1 |
| 비밀번호 | bcrypt (cost 12+), Argon2id | MD5, SHA-1, 평문 |
| 비대칭 암호 | RSA-2048+, ECDSA P-256+ | RSA-1024, DSA |
| TLS | TLS 1.3, TLS 1.2 (제한적) | SSL 3.0, TLS 1.0, TLS 1.1 |
| 키 교환 | ECDHE, DHE (2048+) | DH-1024, RSA 키 교환 |

**코드 리뷰 시 점검 항목**

```typescript
// 금지 패턴 탐지 (ESLint 보안 규칙 또는 코드 리뷰)
// 아래 패턴이 발견되면 즉시 수정 필요

// MD5 사용 금지
// import { createHash } from 'crypto'
// createHash('md5')  // BLOCKED

// SHA-1 사용 금지
// createHash('sha1')  // BLOCKED

// DES/3DES 사용 금지
// createCipheriv('des-ecb', ...)  // BLOCKED

// 허용 패턴만 사용
import { createHash, createCipheriv } from 'crypto'
const hash = createHash('sha256').update(data).digest('hex')      // OK
const cipher = createCipheriv('aes-256-gcm', key, iv)             // OK
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 사용 암호 알고리즘 목록 | 표 | 문서관리시스템 |
| 코드 리뷰 결과 (취약 알고리즘 없음) | 리뷰 기록 | Git PR |
| 취약점 점검 결과 | 보고서 | 보안 점검 시스템 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 -- CSAP-D09 4항목 전수 구현 가이드. AES-256-GCM + TLS 1.3 + bcrypt + 키 관리 | Claude Code |
