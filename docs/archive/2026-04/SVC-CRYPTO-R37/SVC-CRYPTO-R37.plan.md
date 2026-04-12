# SVC-CRYPTO-R37 Plan: Crypto Utility

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead

## WHY
CSAP D-09 요구에 따라 민감 데이터 암호화(AES-256-GCM) 및 HMAC-SHA256 무결성 검증 표준 라이브러리 제공.

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-CR.1 | AES-256-GCM 암호화 (IV 자동 생성) | P0 |
| FR-CR.2 | AES-256-GCM 복호화 (인증 태그 검증) | P0 |
| FR-CR.3 | HMAC-SHA256 서명/검증 | P0 |
| FR-CR.4 | 키 파생(PBKDF2, scrypt) | P0 |
| FR-CR.5 | 안전한 랜덤 토큰 생성 | P1 |
| FR-CR.6 | 타이밍 안전 비교 (timingSafeEqual) | P1 |

## CSAP/N2SF
- CSAP D-09: 암호화 (AES-256, SHA-256)
- N2SF N-02: 데이터 기밀성
