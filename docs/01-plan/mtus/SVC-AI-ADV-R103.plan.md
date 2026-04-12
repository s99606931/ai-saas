# SVC-AI-ADV-R103 — Knowledge Distillation Engine

> 작성일: 2026-04-12 | 버전: 2.0.0 (재작성)
> 세션: #139 (11차 PM 세션 k)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 대형 LLM(Teacher) → 소형 모델(Student) 지식 증류 오프라인 파이프라인 |
| 품질 | Teacher 정답 대비 Student 일치율 추적 + 저하도 모니터 |
| 보안 | 입력 데이터 N2SF O등급만 허용 + 중요도 마스킹 |
| 비용 | Student 호출 대체로 Teacher 호출 90%+ 절감 예상 |

## Context Anchor

- **WHY**: 대형 LLM 호출 비용·지연 절감을 위해 공공 업무 도메인 특화 소형 모델 필요
- **WHO**: 플랫폼 AI 운영팀, 테넌트 AI 관리자
- **RISK**: 지식 손실로 답변 품질 저하. 개인정보 포함된 예시 증류.
- **SUCCESS**: Teacher-Student 쌍 기록 + 합치도 메트릭 + 증류 후보 선정 API
- **SCOPE**: 증류 메타데이터 관리(데이터셋 구성·평가) 오프라인 엔진. 실제 학습 실행은 외부 ML 파이프라인.

## 요구사항

- **FR-R103.1**: `registerDistillationJob(jobId, teacherModel, studentModel)` — 증류 작업 등록
- **FR-R103.2**: `addSample(jobId, prompt, teacherOutput, studentOutput, dataGrade)` — C/S 등급 차단
- **FR-R103.3**: `computeAgreement(jobId)` — 일치율 (토큰 교집합/합집합 Jaccard)
- **FR-R103.4**: `selectHighValueSamples(jobId, topN)` — 불일치 높은 샘플 우선 정렬
- **FR-R103.5**: `exportTrainingSet(jobId)` — JSONL 형태 학습셋 출력 (PII 마스킹 필수)
- **NFR-R103.1**: 테스트 6개+
- **CSAP D-06**: `getAuditLog()` 필수
- **N2SF N-05**: C/S 등급 입력 차단

## 추적성

| FR | Design 섹션 | 구현 | 테스트 |
|----|-----------|-----|-------|
| FR-R103.1 | §2.1 | knowledge-distillation-engine.ts | registerDistillationJob |
| FR-R103.2 | §2.2 | 동일 | addSample + guardDataGrade |
| FR-R103.3 | §2.3 | 동일 | computeAgreement |
| FR-R103.4 | §2.4 | 동일 | selectHighValueSamples |
| FR-R103.5 | §2.5 | 동일 | exportTrainingSet |
