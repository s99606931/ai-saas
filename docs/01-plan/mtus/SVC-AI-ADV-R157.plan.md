# MTU Plan — SVC-AI-ADV-R157 Model Card Generator

> **원 요청 번호**: R157
> **모듈**: `platform/services/ai-service/src/lib/model-card-generator.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | AI 모델 카드 자동 생성 → EU AI Act · 행안부 AI 투명성 요건 대응 |
| 기술 | 메타데이터 입력 → 표준 섹션으로 Markdown/JSON 직렬화 |
| 보안 | 민감 필드 마스킹, C/S 차단 |
| 규제 | EU AI Act Art. 13, 행안부 공공 AI 가이드 |

## Context Anchor

- WHY: 모델 배포 시 투명성 문서(목적, 학습데이터, 편향, 한계) 의무화
- WHO: AI 모델 운영팀, 감리단
- RISK: 미제출 시 행정처분, 신뢰도 저하
- SUCCESS: 필수 섹션 8개 자동 포함, Markdown/JSON 출력
- SCOPE: build(meta) → { markdown, json }

## FR

| ID | 설명 |
|----|------|
| FR-R157.1 | ModelCardMeta 입력: name, version, purpose, owner, trainingData, evaluation, limitations, ethicalConsiderations |
| FR-R157.2 | 필수 필드 누락 시 `missing_field` 오류 |
| FR-R157.3 | toMarkdown(): 한국어 섹션 헤더로 직렬화 |
| FR-R157.4 | toJSON(): 구조화 JSON 반환 (Date → ISO string) |
| FR-R157.5 | 섹션: 개요 / 목적 / 학습 데이터 / 평가 지표 / 한계 / 윤리 / 소유자 / 변경 이력 |
| FR-R157.6 | validateChecklist(): 8개 섹션 충족 여부 boolean |
| FR-R157.7 | 감사 로그, C/S 차단 |
| FR-R157.8 | version 형식 검증 (semver: `x.y.z`) |

## 테스트 케이스

- 필수 필드 모두 있음 → 생성 성공
- name 누락 → missing_field
- version 형식 위반 → invalid_version
- toMarkdown 필수 헤더 포함
- toJSON 구조화 확인
- validateChecklist true
- C/S 차단
- getAuditLog
