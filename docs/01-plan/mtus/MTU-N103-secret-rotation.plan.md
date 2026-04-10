# MTU-N103: GitOps 시크릿 회전 자동화 -- Plan

> **MTU ID**: MTU-N103
> **Phase**: CI/CD 8라운드
> **작성일**: 2026-04-10
> **복잡도**: MED

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP D-09 암호화 키 주기적 교체 요건 충족 |
| 기술 | External Secrets Operator + HashiCorp Vault + 자동 회전 |
| 보안 | 시크릿 30~90일 자동 교체, 감사 로그 기록 |
| 운영 | 무중단 시크릿 교체, 롤백 지원 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | CSAP D-09 암호키 교체 주기 준수, 보안 성숙도 강화 |
| WHO | 보안 팀, 플랫폼 운영자 |
| RISK | 시크릿 교체 중 서비스 중단 |
| SUCCESS | 자동 교체 정책 5개+, 무중단 검증, 감사 로그 기록 |
| SCOPE | ESO SecretStore, ExternalSecret, 회전 정책, Vault dev mode |

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|----------|
| FR-N103.1 | Vault dev mode 설치 | Helm values 포함 |
| FR-N103.2 | ESO SecretStore + Vault 연동 | 연결 검증 |
| FR-N103.3 | ExternalSecret 회전 정책 | 5개+ 시크릿 타입 |
| FR-N103.4 | 무중단 교체 메커니즘 | Dual Secret + 롤링 업데이트 |
| FR-N103.5 | 감사 로그 연동 | 교체 이벤트 기록 |
| FR-N103.6 | E2E 테스트 작성 | 10건+ ALL PASS |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Agent |
