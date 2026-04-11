# SVC-SECRETMGR-R24 DESIGN: 시크릿 관리자

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-SECRETMGR-R24.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## 아키텍처 옵션 분석

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. HashiCorp Vault | 외부 Vault 서비스 연동 | 엔터프라이즈급 | 외부 서비스 의존, 인프라 복잡도 |
| **B. 인메모리 AES-256-GCM** | Node.js crypto 기반 자체 구현 | 무의존, CSAP D-09 준수, 즉시 사용 | 프로세스 재시작 시 휘발 |
| C. Sealed Secrets | Kubernetes Sealed Secrets | K8s 네이티브 | k3s 의존, 런타임 조회 복잡 |

**선택: 옵션 B (Pragmatic Balance)** -- 외부 서비스 금지 제약 준수, CSAP D-09 암호화 요건 충족

---

## 1. 핵심 클래스: SecretManager

### 설계 원칙
- AES-256-GCM (NIST SP 800-38D) 암호화
- scrypt 키 파생 (마스터 키 -> 32바이트 파생 키)
- 각 시크릿별 고유 IV (12바이트 랜덤)
- GCM 인증 태그로 무결성 보장
- TTL 기반 자동 만료
- 감사 로그 전수 기록

### 암호화 흐름
```
set(name, value, ttl):
  1. randomBytes(12) -> IV
  2. createCipheriv('aes-256-gcm', derivedKey, iv)
  3. cipher.update(value) + cipher.final() -> encrypted (hex)
  4. cipher.getAuthTag() -> authTag (hex)
  5. Map.set(name, { encrypted, iv, authTag, expiresAt })
  6. auditLog({ action: 'set', name })

get(name):
  1. Map.get(name) -> entry
  2. 만료 확인 (expiresAt > 0 && now >= expiresAt -> 삭제)
  3. createDecipheriv + setAuthTag + update + final -> value
  4. 실패 시 환경 변수 폴백 (enableEnvFallback)
  5. auditLog({ action: 'get', name, source })
```

### 주요 인터페이스
```typescript
SecretManagerOptions { masterKey, enableEnvFallback?, maxAuditEntries?, expirationCheckIntervalMs? }
SecretAuditEntry { action, name, success, timestamp, source? }
SecretManagerStats { secretCount, auditLogCount, envFallbackEnabled }
```

---

## 2. Fastify 플러그인: secretPlugin

### 설계 원칙
- fastify-plugin 기반 `secrets` 데코레이터 등록
- `/secrets/stats` -- 통계 엔드포인트 (값 미노출, 수량만)
- onClose 훅: destroy() 호출하여 리소스 정리
- 엔드포인트 노출 on/off 설정 가능

---

## 3. 보안 설계 (CSAP D-09)

### 암호화 사양
- 알고리즘: AES-256-GCM (인증된 암호화)
- 키 파생: scrypt(masterKey, salt, 32바이트)
- IV: 12바이트 랜덤 (시크릿별 고유)
- 인증 태그: 16바이트 (GCM 기본)

### 접근 통제 (CSAP D-08)
- 시크릿 값은 메모리에서만 복호화, 응답에 포함 불가
- listNames()는 키 이름만 반환, 값 미노출
- 모든 접근(get/set/delete) 감사 로깅

---

## Session Guide

### 구현 순서
1. `src/secret-manager.ts` -- AES-256-GCM 암복호화 + TTL + 감사 로그
2. `src/secret-plugin.ts` -- Fastify 플러그인
3. `src/index.ts` -- 패키지 엔트리포인트
4. `tests/secret-manager.test.ts` -- 암복호화 + CRUD + TTL + 감사 테스트
5. `tests/secret-plugin.test.ts` -- Fastify 통합 테스트

### Design Anchor
- 모든 구현 파일 상단: `// Design Ref: SVC-SECRETMGR-R24`
- 모든 함수: `// Plan SC: FR-SM.{번호}`
