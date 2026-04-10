# MTU-N62: cert-manager TLS 인증서 자동화

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 SaaS 전체 서비스 TLS 인증서 자동 발급/갱신으로 CSAP D-09 암호화 요건 완전 충족 |
| 기술 | cert-manager v1.17 Helm + 자체 서명 Root CA + ClusterIssuer 2종 + Certificate 템플릿 |
| 보안 | CSAP D-09 전송 암호화, 인증서 자동 갱신 (만료 30일 전), ECDSA P-256 기본 |
| 운영 | Prometheus 메트릭 인증서 만료 모니터링, Flux GitOps 자동 배포 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N62.1 | cert-manager Helm values.yaml (CRD, Prometheus) | P0 |
| FR-N62.2 | Self-Signed Root CA ClusterIssuer | P0 |
| FR-N62.3 | CA ClusterIssuer (Root CA 서명) | P0 |
| FR-N62.4 | 서비스별 Certificate 리소스 6종 | P0 |
| FR-N62.5 | Prometheus 인증서 만료 알림 규칙 | P1 |
| FR-N62.6 | Flux GitOps Kustomization 연동 | P1 |
| FR-N62.7 | 설치 가이드 문서 | P1 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
