# Report: MTU-N246 DevSecOps 파이프라인 통합

> **작성일**: 2026-04-11 | **matchRate**: 94%

## Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | 보안 스캔 자동화 | 5종 스캔 병렬 실행 파이프라인 |
| 기술 | Trivy+Semgrep+Kyverno 통합 | 단일 워크플로우로 통합 |
| 보안 | OWASP Top10, 공급망 | SAST + IaC + Secret + Dependency |
| 운영 | 365일 보고서 보관 | 아티팩트 보관 정책 적용 |

## 산출물

| FR ID | 산출물 | 상태 |
|-------|--------|------|
| FR-N246.1 | Trivy IaC 스캔 | 완료 |
| FR-N246.2 | Trivy 이미지 스캔 (ci-cd-pipeline 내) | 기존 적용 |
| FR-N246.3 | Semgrep SAST | 완료 |
| FR-N246.4 | Kyverno dry-run | 완료 |
| FR-N246.5 | 보안 보고서 365일 보관 | 완료 |
| FR-N246.6 | 통합 워크플로우 | 완료 |
