# MTU-N237: Hotfix 파이프라인 자동화 -- Plan

> **버전**: 1.0 | **작성일**: 2026-04-10

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 긴급 보안 패치/버그 수정을 안전하게 빠르게 배포 (MTTR 감소) |
| 기술 | Gitea Actions 기반 hotfix 브랜치 자동 파이프라인 |
| 보안 | 핫픽스에도 CSAP 보안 검증 자동 적용, 감사 추적 |
| 운영 | 핫픽스 배포 자동 알림, 롤백 자동 트리거 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-HF.1 | hotfix/* 브랜치 자동 감지 Gitea Actions 워크플로우 | P0 |
| FR-HF.2 | 핫픽스 빌드-테스트-보안스캔 가속 파이프라인 | P0 |
| FR-HF.3 | 핫픽스 배포 후 자동 검증 (smoke test) | P0 |
| FR-HF.4 | 실패 시 자동 롤백 트리거 | P1 |
| FR-HF.5 | 핫픽스 배포 알림 (ChatOps) | P1 |
| FR-HF.6 | 핫픽스 감사 로그 + 변경 이력 자동 기록 | P1 |

## 산출물

| 산출물 | 경로 |
|--------|------|
| Gitea Actions | .gitea/workflows/hotfix-pipeline.yaml |
| 배포 스크립트 | scripts/hotfix-deploy.sh |
| 롤백 스크립트 | scripts/hotfix-rollback.sh |
| 테스트 | scripts/test-hotfix-pipeline.sh |
