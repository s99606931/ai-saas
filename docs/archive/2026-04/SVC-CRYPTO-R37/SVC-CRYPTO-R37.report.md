# SVC-CRYPTO-R37 REPORT: Crypto Utility

> 완료일: 2026-04-12 | matchRate: 100% | 테스트: 22/22 passed

## Executive Summary

| 관점 | 결과 |
|------|------|
| 기능 | AES-256-GCM + HMAC-SHA256 + PBKDF2 + 안전 랜덤 |
| 품질 | 22개 테스트 통과 |
| 보안 | CSAP D-09 (AES-256, SHA-256) 준수, N2SF N-02 |

## Success Criteria
| FR ID | 요구사항 | 상태 |
|-------|---------|------|
| FR-CR.1 | AES-256-GCM 암호화 | 완료 |
| FR-CR.2 | AES-256-GCM 복호화 + 인증 태그 | 완료 |
| FR-CR.3 | HMAC-SHA256 서명/검증 | 완료 |
| FR-CR.4 | PBKDF2 키 파생 (100k+ iter) | 완료 |
| FR-CR.5 | 랜덤 토큰 (base64url) | 완료 |
| FR-CR.6 | 타이밍 안전 비교 | 완료 |

## Key Decisions
- IV 12바이트 (GCM 권장), AuthTag 16바이트
- 암호문 포맷: `base64(iv || ciphertext || authTag)` — 단일 문자열
- PBKDF2: 최소 10k 반복 강제, 기본 100k
- 위변조 암호문은 `AUTH_FAILED` 에러로 명확히 구분
