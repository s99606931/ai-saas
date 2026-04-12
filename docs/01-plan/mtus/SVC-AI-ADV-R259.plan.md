# SVC-AI-ADV-R259 — AI 모델 버전 게이트웨이

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: PM Lead (자율 생성)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | AI 모델 블루/그린 배포 + 트래픽 분할 + 버전 롤백 + 호출 라우팅 + 통계 |
| 품질 | 결정론적 라우팅(해시 기반), 테스트 10개+ |
| 보안 | C/S 차단, 호출 주체 마스킹, CSAP D-06 감사 로그 |
| 비용 | 로컬 라우터, 외부 호출 없음 |

## Context Anchor

- **WHY**: 공공 AI 모델 업그레이드 시 무중단 점진 배포 필요
- **WHO**: AI 운영팀, 시스템 운영자, 모델 품질팀
- **RISK**: 잘못된 모델 버전 사용 시 공공서비스 품질 저하
- **SUCCESS**: 모델 등록 → 트래픽 분할 → 라우팅 → 통계 + 롤백
- **SCOPE**: In — 버전 관리·라우팅. Out — 실제 모델 추론

## 요구사항

- **FR-R259.1**: 모델 버전 등록 (modelId·version·status·metadata)
- **FR-R259.2**: 트래픽 분할 설정 (blue/green 비율, 합 100 필수)
- **FR-R259.3**: 호출 라우팅 (requestKey 해시 → 블루/그린 결정)
- **FR-R259.4**: 롤백 (green → blue 강제 전환, 트래픽 100:0)
- **FR-R259.5**: 통계 조회 (버전별 호출 수, 오류 수)
- **FR-R259.6**: 호출 기록 (recordCall: modelId·version·success·latency)
- **FR-R259.7**: C/S 차단, caller 마스킹, CSAP D-06 감사 로그, getAuditLog()
- **NFR-R259.1**: TypeScript strict, 테스트 10개+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R259.1~7 | ai-model-versioning-gateway.ts | .test.ts | D-06, D-12 |
