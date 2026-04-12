# SVC-AI-ADV-R105 — Multi-Tenant Model Fine-tuner

> 작성일: 2026-04-12 | 버전: 2.0.0 (재작성)
> 세션: #139 (11차 PM 세션 k)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 테넌트별 파인튜닝 작업 제출·버전 관리·활성 버전 전환 |
| 품질 | 테넌트 격리 보장 + 버전 롤백 + 데이터셋 무결성 해시 |
| 보안 | 학습 데이터 N2SF O등급만 허용, 테넌트 크로스 접근 차단 |
| 비용 | 메타데이터 관리 + executor 주입 (실제 학습 외부) |

## Context Anchor

- **WHY**: 멀티테넌트 공공 SaaS에서 기관별 업무 용어에 맞춘 모델 필요
- **WHO**: 테넌트 관리자, 플랫폼 AI 팀
- **RISK**: 테넌트 간 데이터 유출. 잘못된 버전 활성화로 서비스 장애.
- **SUCCESS**: submitJob → trackStatus → promote → rollback 사이클 완결
- **SCOPE**: 메타데이터·버전 관리 엔진. 실제 학습 실행은 외부 executor.

## 요구사항

- **FR-R105.1**: `submitFineTuneJob(tenantId, baseModel, datasetHash, dataGrade)`
- **FR-R105.2**: `updateJobStatus(jobId, status, modelVersionTag?)`
- **FR-R105.3**: `promoteVersion(tenantId, modelVersionTag)` — 활성 버전 전환
- **FR-R105.4**: `rollback(tenantId)` — 이전 활성 버전으로 복구
- **FR-R105.5**: `listVersions(tenantId)` — 테넌트별 버전 히스토리
- **NFR-R105.1**: 테스트 8개+, 테넌트 격리 테스트 필수
- **CSAP D-06**: `getAuditLog()` 필수
- **N2SF N-05**: C/S 등급 데이터셋 차단
