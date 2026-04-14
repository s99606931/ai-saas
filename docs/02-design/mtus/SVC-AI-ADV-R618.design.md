# SVC-AI-ADV-R618 Design — AI기반 양자내성 암호화 자문 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R618.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/ |

## 설계 결정
- 알고리즘 분류:
  - 양자 취약: RSA/ECDSA/ECDH/DH/DSA → 우선순위 HIGH
  - 대칭 키 짧음: AES-128 → MEDIUM (Grover에 의해 128→64비트 실효)
  - 양자 안전: AES-256, SHA-384+, ML-KEM, ML-DSA, SLH-DSA
- 권장 맵:
  - RSA/ECDH → ML-KEM (키 교환)
  - ECDSA/RSA-sig → ML-DSA (디지털 서명)
  - AES-128 → AES-256
- 마이그레이션 위험 점수: HIGH=100, MEDIUM=50, SAFE=0, 평균

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
