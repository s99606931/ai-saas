# MTU-N73: vCluster PR Preview 환경 자동 생성

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 개발자 경험 혁신, PR별 격리된 프리뷰 환경으로 품질 향상 |
| 기술 | vCluster 가상 클러스터, Gitea Webhook 연동, 자동 생성/삭제 |
| 보안 | 테넌트 격리 (vCluster), 리소스 제한, 자동 만료 정책 |
| 운영 | PR 오픈 시 자동 생성, PR 머지/닫힘 시 자동 삭제, TTL 3일 |

---

## 기능 요구사항

| FR ID | 요구사항 | 수용 기준 |
|-------|---------|----------|
| FR-N73.1 | vCluster Helm values | vCluster OSS 설치 설정 완비 |
| FR-N73.2 | PR Preview 워크플로우 | Gitea Actions 워크플로우 (생성/삭제) |
| FR-N73.3 | 리소스 제한 정책 | ResourceQuota, LimitRange 자동 적용 |
| FR-N73.4 | TTL 자동 만료 | 3일 미사용 시 자동 삭제 CronJob |
| FR-N73.5 | 검증 테스트 | 10건 이상 ALL PASS |

---

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | vCluster Helm values | `infra/vcluster/values.yaml` |
| 2 | PR Preview 워크플로우 | `infra/vcluster/pr-preview-workflow.yaml` |
| 3 | 리소스 정책 템플릿 | `infra/vcluster/resource-policies.yaml` |
| 4 | TTL CronJob | `infra/vcluster/ttl-cleanup.yaml` |
| 5 | 테스트 스크립트 | `scripts/test-vcluster-preview.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
