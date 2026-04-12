# SVC-CRYPTO-R37 DESIGN: Crypto Utility

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead

## 암호화 포맷

```
encrypted := base64(iv || ciphertext || authTag)
  iv: 12 bytes (GCM 권장)
  authTag: 16 bytes
```

## API

- `encrypt(plaintext: string, key: Buffer): string` — AES-256-GCM
- `decrypt(encrypted: string, key: Buffer): string` — 인증 실패 시 throw
- `hmacSign(data: string, key: Buffer): string` — HMAC-SHA256 hex
- `hmacVerify(data: string, signature: string, key: Buffer): boolean`
- `deriveKey(password: string, salt: Buffer, iterations=100000): Buffer` — PBKDF2
- `generateToken(bytes=32): string` — base64url
- `timingSafeCompare(a: string, b: string): boolean`

## Session Guide
- `src/crypto-util.ts` → `src/index.ts` → `tests/crypto-util.test.ts`
- Design Ref: `// Design Ref: SVC-CRYPTO-R37 DESIGN`
