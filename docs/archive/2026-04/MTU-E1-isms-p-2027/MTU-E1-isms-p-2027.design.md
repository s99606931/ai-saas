# MTU-E1: ISMS-P 2027 의무화 대응 완성 가이드 Design Document

> **Summary**: 2027년 7월 ISMS-P 의무화 시행 대비 심사 단계별 체크리스트 + CSAP 이중 인증 매핑 + 자동 증적 보고서 패턴
>
> **Project**: 공공기관 SaaS 프레임워크
> **Version**: 1.2.0
> **Author**: Implementer Agent
> **Date**: 2026-04-05
> **Status**: Draft
> **Planning Doc**: [MTU-E1-isms-p-2027.plan.md](../01-plan/mtus/MTU-E1-isms-p-2027.plan.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 2027-07 ISMS-P 의무화 시행 대비 — CSAP 인증 보유 공공 SaaS의 이중 인증 취득 절차 완성 |
| **WHO** | 공공기관 SaaS 서비스 운영자, 보안 담당자, ISMS-P 심사 대응 팀 |
| **RISK** | 의무화 미대응 시 서비스 운영 불가, 중복 심사 비용 과다, 증적 누락으로 인증 실패 |
| **SUCCESS** | 4단계 심사 체크리스트 완비, CSAP↔ISMS-P 30개+ 중복 매핑, 자동 보고서 파이프라인 |
| **SCOPE** | 산출물 2개: certification-guide.md + auto-evidence-collection.md |

---

## 1. Overview

### 1.1 Design Goals

1. ISMS-P 101항목 인증 심사 4단계(서류→현장→보완→인증)를 단계별 체크리스트로 구조화
2. CSAP 79항목과 ISMS-P 101항목 간 중복 30개+ 항목의 번호 수준 정밀 매핑
3. MTU-C6b 자동 증적 인프라 기반 ISMS-P 보고서 자동 생성 파이프라인 설계
4. 2026~2027 월별 마일스톤 타임라인 제공

### 1.2 Design Principles

- 의존 MTU 산출물 재활용 극대화 (C6a 체크리스트, C6b 증적 자동화)
- CSAP 증적 → ISMS-P 매핑으로 이중 준비 부담 최소화
- 절차서형 문서 — 실무 담당자가 바로 실행 가능한 수준

---

## 2. Architecture: 산출물 구조 설계

### 2.0 산출물 비교

본 MTU는 코드 구현이 아닌 문서형 산출물이므로, 아키텍처 옵션 대신 산출물 구조 설계를 정의합니다.

| 산출물 | 파일명 | 유형 | 핵심 섹션 |
|--------|--------|------|---------|
| 인증 취득 가이드 | `05-isms-p/certification-guide.md` | 절차서형 | 4단계 체크리스트, 이중 인증 매핑, 타임라인 |
| 자동 증적 보고서 생성 | `05-isms-p/auto-evidence-collection.md` | 구현 가이드형 | 보고서 자동 생성 파이프라인, 심사 패키지 |

> **경로 참고**: Plan 문서에는 `05-isms-p/`로 기재되어 있으나, 기존 프레임워크 구조상
> `docs/framework/03-isms-p/` 하위에 배치합니다 (MTU-C6a/C6b 산출물과 동일 경로).

### 2.1 산출물 간 의존 관계

```
MTU-C6a (관리체계 체크리스트)
    │
    ├── management-controls/  (M01~M16)
    │
MTU-C6b (보호/개인정보 체크리스트 + 증적 자동화)
    │
    ├── protection-controls/  (P01~P64)
    ├── privacy-controls/     (I01~I21)
    ├── evidence-automation-guide.md
    │
    ▼
MTU-E1 (본 MTU: 완성 가이드)
    │
    ├── certification-guide.md      ← 신규 (4단계 심사 체크리스트)
    └── auto-evidence-collection.md ← 신규 (보고서 자동 생성 확장)
```

---

## 3. 산출물 1: certification-guide.md 상세 설계

### 3.1 문서 구조

```
1. 개요
   1.1 ISMS-P 2027 의무화 배경
   1.2 적용 대상 (공공기관 SaaS)
   1.3 CSAP 이중 인증 전략 요약

2. 2026~2027 준비 타임라인
   2.1 월별 마일스톤 (2026-04 ~ 2027-07)
   2.2 단계별 소요 기간 및 담당 역할

3. ISMS-P 심사 4단계 체크리스트
   3.1 1단계: 서류 심사 (예비 심사)
       - 필수 서류 목록 (20개+)
       - 자동 생성 가능 서류 vs 수동 작성 서류
       - 준비 기한: D-90 ~ D-60
   3.2 2단계: 현장 심사 (인터뷰 + 실증)
       - 심사원 인터뷰 대비 Q&A (역할별)
       - 시스템 시연 시나리오 (5개+)
       - 증적 파일 제출 패키지 구성
       - 준비 기한: D-30 ~ D-0
   3.3 3단계: 보완 조치
       - 결함 분류 (경미/보통/중대)
       - 보완 기한: 최대 60일
       - Gitea Issue 자동 생성 연동 (MTU-A7)
   3.4 4단계: 인증서 발급 및 사후 관리
       - 유효기간 3년, 연 1회 사후 심사
       - 갱신 알림 자동화 워크플로우

4. CSAP ↔ ISMS-P 이중 인증 중복 매핑
   4.1 매핑 기준 및 방법론
   4.2 완전 중복 항목 (30개) — 항목 번호 수준
   4.3 부분 중복 항목 (10개) — 보완 필요 사항
   4.4 ISMS-P 전용 항목 (61개) — 신규 대응 필요
   4.5 CSAP 전용 항목 (39개) — ISMS-P 범위 외
   4.6 이중 인증 순서 전략 (CSAP 선행 → ISMS-P 후행)

5. 참조 문서 및 연계 MTU
```

### 3.2 CSAP↔ISMS-P 중복 매핑 상세 (30개 완전 중복)

| # | CSAP 항목 | ISMS-P 항목 | 통제 영역 | 증적 재활용 |
|---|---------|-----------|---------|:--------:|
| 1 | CSAP-D01-01 | ISMS-P-M-01 | 정보보호 정책 수립 | 가능 |
| 2 | CSAP-D01-02 | ISMS-P-M-02 | 정보보호 정책 공표 | 가능 |
| 3 | CSAP-D02-01 | ISMS-P-M-03 | 보안 조직 구성 | 가능 |
| 4 | CSAP-D02-02 | ISMS-P-M-04 | 보안 역할 정의 | 가능 |
| 5 | CSAP-D03-01 | ISMS-P-M-05 | 위험 관리 계획 | 가능 |
| 6 | CSAP-D03-02 | ISMS-P-M-06 | 위험 평가 수행 | 가능 |
| 7 | CSAP-D03-03 | ISMS-P-M-07 | 위험 처리 계획 | 가능 |
| 8 | CSAP-D04-01 | ISMS-P-M-09 | 자산 식별·분류 | 가능 |
| 9 | CSAP-D04-02 | ISMS-P-M-10 | 자산 관리 절차 | 가능 |
| 10 | CSAP-D05-01 | ISMS-P-P-39 | 공급망 보안 관리 | 가능 |
| 11 | CSAP-D06-01 | ISMS-P-P-54 | 침해사고 탐지 | 가능 |
| 12 | CSAP-D06-02 | ISMS-P-P-55 | 침해사고 대응 | 가능 |
| 13 | CSAP-D06-03 | ISMS-P-P-56 | 침해사고 보고 | 가능 |
| 14 | CSAP-D06-04 | ISMS-P-P-57 | 침해사고 복구 | 가능 |
| 15 | CSAP-D06-05 | ISMS-P-P-58 | 재해 복구 (백업) | 가능 |
| 16 | CSAP-D08-01 | ISMS-P-P-01 | 접근 통제 정책 | 가능 |
| 17 | CSAP-D08-02 | ISMS-P-P-02 | 계정 관리 | 가능 |
| 18 | CSAP-D08-03 | ISMS-P-P-03 | 사용자 인증 | 가능 |
| 19 | CSAP-D08-05 | ISMS-P-P-05 | 특권 계정 관리 | 가능 |
| 20 | CSAP-D08-06 | ISMS-P-P-06 | 접근 권한 관리 | 가능 |
| 21 | CSAP-D08-09 | ISMS-P-P-11 | 세션 관리 | 가능 |
| 22 | CSAP-D08-12 | ISMS-P-P-48 | 접근 기록·감사 로그 | 가능 |
| 23 | CSAP-D09-01 | ISMS-P-P-16 | 저장 데이터 암호화 | 가능 |
| 24 | CSAP-D09-02 | ISMS-P-P-17 | 전송 데이터 암호화 | 가능 |
| 25 | CSAP-D09-03 | ISMS-P-P-22 | 암호 키 관리 | 가능 |
| 26 | CSAP-D10-01 | ISMS-P-P-30 | 네트워크 접근 통제 | 가능 |
| 27 | CSAP-D10-03 | ISMS-P-P-33 | 로그 수집·분석 | 가능 |
| 28 | CSAP-D12-01 | ISMS-P-P-35 | 시큐어 코딩 | 가능 |
| 29 | CSAP-D12-02 | ISMS-P-P-36 | 보안 테스트 | 가능 |
| 30 | CSAP-D12-04 | ISMS-P-P-38 | 취약점 점검 (SAST/DAST) | 가능 |

### 3.3 부분 중복 항목 (10개)

| # | CSAP 항목 | ISMS-P 항목 | 차이점 | 보완 사항 |
|---|---------|-----------|--------|---------|
| 1 | CSAP-D03-04 | ISMS-P-M-08 | CSAP: 클라우드 특화 위험 | 범용 위험 관리로 확장 |
| 2 | CSAP-D04-03 | ISMS-P-M-11 | CSAP: 가상 자산 포함 | 물리 자산 추가 관리 |
| 3 | CSAP-D05-02 | ISMS-P-P-40 | CSAP: SLA 관리 중심 | 공급자 보안 점검 추가 |
| 4 | CSAP-D05-03 | ISMS-P-P-41 | CSAP: 서비스 연속성 | 외주 용역 보안 관리 추가 |
| 5 | CSAP-D07-01 | ISMS-P-P-59 | CSAP: RTO/RPO 중심 | 재해 유형별 시나리오 추가 |
| 6 | CSAP-D08-04 | ISMS-P-P-04 | CSAP: 다중 인증 필수 | 인증 강도별 분류 추가 |
| 7 | CSAP-D10-02 | ISMS-P-P-31 | CSAP: DMZ 구조 | 망 분리 세부 기준 추가 |
| 8 | CSAP-D11-01 | ISMS-P-P-42 | CSAP: 컨테이너 보안 | 물리 서버 보안 추가 |
| 9 | CSAP-D12-03 | ISMS-P-P-37 | CSAP: 클라우드 설정 점검 | 오픈소스 취약점 점검 추가 |
| 10 | CSAP-D13-01 | ISMS-P-P-45 | CSAP: 공공기관 특화 | 정보통신 기반시설 추가 |

---

## 4. 산출물 2: auto-evidence-collection.md 상세 설계

### 4.1 문서 구조

```
1. 개요
   1.1 기존 증적 자동화 인프라 (MTU-C6b) 요약
   1.2 본 가이드의 확장 범위

2. ISMS-P 보고서 자동 생성 파이프라인
   2.1 일간 증적 집계 스크립트
   2.2 월간 준수 현황 보고서 자동 생성
   2.3 심사 대응 패키지 자동 생성 (D-30)

3. CSAP 증적 → ISMS-P 자동 매핑 엔진
   3.1 매핑 룰 정의 (JSON 형식)
   3.2 audit.jsonl → ISMS-P 보고서 변환 로직
   3.3 중복 항목 자동 매핑 예시 (30개)

4. 심사 D-30 패키지 구성
   4.1 정책 문서 목록 (PDF 자동 변환)
   4.2 시스템 운영 현황 (자동 캡처)
   4.3 증적 파일 인덱스 (자동 생성)
   4.4 패키지 무결성 검증 (SHA-256)

5. 사후 심사 자동 관리
   5.1 인증 만료 180일 전 알림
   5.2 연간 사후 심사 증적 자동 갱신
   5.3 인증 갱신 워크플로우

6. 참조 문서 및 연계 MTU
```

### 4.2 보고서 자동 생성 파이프라인

```
[일간 스케줄러] (Gitea Actions cron: 0 0 * * *)
    │
    ├── audit.jsonl에서 당일 ISMS-P 관련 이벤트 추출
    ├── CSAP 이벤트 → ISMS-P 매핑 룰 적용
    └── isms-p-evidence-{YYYY-MM-DD}.json 생성
            │
            ▼
[월간 보고서] (Gitea Actions cron: 0 9 1 * *)
    │
    ├── 일간 증적 파일 30건 집계
    ├── ISMS-P 101항목별 준수 현황 산출
    ├── 미준수 항목 알림 (Gitea Issue 자동 생성)
    └── isms-p-monthly-report-{YYYY-MM}.md 생성
            │
            ▼
[심사 대응 패키지] (수동 트리거 또는 D-30 자동)
    │
    ├── 최근 12개월 월간 보고서 번들링
    ├── 정책 문서 최신본 PDF 변환
    ├── 시스템 현황 자동 캡처 (헬스체크, 로그 통계)
    ├── 증적 파일 인덱스 (항목별 → 파일 매핑)
    ├── SHA-256 무결성 해시 생성
    └── isms-p-audit-package-{심사일}.tar.gz 생성
```

### 4.3 CSAP → ISMS-P 매핑 룰 (JSON)

```json
{
  "mappingVersion": "1.0.0",
  "rules": [
    {
      "csapControl": "CSAP-D08-01",
      "ismsPControl": "ISMS-P-P-01",
      "type": "full",
      "evidenceReuse": true,
      "additionalEvidence": []
    },
    {
      "csapControl": "CSAP-D03-04",
      "ismsPControl": "ISMS-P-M-08",
      "type": "partial",
      "evidenceReuse": true,
      "additionalEvidence": ["물리 위험 평가 보고서"]
    }
  ]
}
```

---

## 5. 합격 기준 추적

| # | 합격 기준 | 산출물 위치 | 검증 방법 |
|---|---------|-----------|---------|
| AC-1 | 심사 단계별 체크리스트 완비 (4단계) | certification-guide.md §3 | 서류·현장·보완·인증 4단계 세부 항목 존재 확인 |
| AC-2 | 자동 증적 → 보고서 자동 생성 패턴 | auto-evidence-collection.md §2~4 | Gitea Actions 워크플로우 예시 포함 확인 |
| AC-3 | CSAP+ISMS-P 중복 매핑 30개+ | certification-guide.md §4 | 항목 번호 수준 매핑 테이블 30행 이상 |
| AC-4 | 2027-07 타임라인 (월별) | certification-guide.md §2 | 2026-04 ~ 2027-07 월별 마일스톤 존재 |

---

## 6. Implementation Guide

### 6.1 File Structure

```
docs/framework/03-isms-p/
├── management-controls/          (MTU-C6a 기존)
├── protection-controls/          (MTU-C6b 기존)
├── privacy-controls/             (MTU-C6b 기존)
├── evidence-automation-guide.md  (MTU-C6b 기존)
├── certification-guide.md        ← 신규 (MTU-E1)
└── auto-evidence-collection.md   ← 신규 (MTU-E1)
```

### 6.2 Implementation Order

1. [ ] certification-guide.md 작성 (타임라인 + 4단계 체크리스트 + 이중 인증 매핑)
2. [ ] auto-evidence-collection.md 작성 (보고서 파이프라인 + 매핑 엔진 + 심사 패키지)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-E1 Design 문서 작성 | Implementer Agent |
