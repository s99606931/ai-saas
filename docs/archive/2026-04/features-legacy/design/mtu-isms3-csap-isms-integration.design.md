# MTU-ISMS3 — CSAP-ISMS-P 중복 매핑 통합 증적 설계

> **문서 ID**: MTU-ISMS3-DESIGN
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan SC**: FR-ISMS3.1~FR-ISMS3.5
> **참조**: docs/01-plan/features/mtu-isms3-csap-isms-integration.plan.md

---

## 1. 아키텍처 선택

**선택안**: Pragmatic Balance
- 기존 csap-isms-mapping.md를 기반으로 통합 증적 상세화
- 디렉토리 기반 증적 패키지 구성 표준 정의
- 심사원 관점에서 증적 접근성 최적화

## 2. 산출물 설계

### 2.1 통합 증적 상세 매핑 (FR-ISMS3.1, FR-ISMS3.2)

```
docs/framework/03-isms-p/integrated-evidence/detailed-mapping.md
├── 1. 완전 중복 36항목 상세 매핑
│   ├── 항목별: CSAP ID | ISMS-P ID | 증적명 | 증적 경로 | 제출 형태 | 비고
│   └── 증적 경로: 실제 프레임워크 파일/문서 경로 명시
├── 2. 부분 중복 9항목 보완 계획
│   ├── 항목별: CSAP 증적 | 추가 필요 증적 | 보완 작업 | 담당 | 기한
│   └── 보완 우선순위: 심사 빈출 항목 우선
├── 3. ISMS-P 고유 56항목 증적 로드맵
│   ├── 관리체계 8항목: 증적 유형 + 생성 계획
│   ├── 보호대책 36항목: 프레임워크 자동 생성 가능 여부
│   └── 개인정보 17항목: 수집/이용/파기 절차 증적
└── 4. 증적 버전 관리 규칙 (FR-ISMS3.4)
    ├── 버전 체계: v{CSAP버전}.{ISMS보완버전}
    ├── 동시 업데이트 절차
    └── 변경 시 양쪽 추적성 갱신 규칙
```

### 2.2 통합 증적 패키지 가이드 (FR-ISMS3.3, FR-ISMS3.5)

```
docs/framework/03-isms-p/integrated-evidence/package-guide.md
├── 1. 증적 패키지 디렉토리 구조
│   evidence-package/
│   ├── 01-management-system/    (관리체계 16항목)
│   ├── 02-protection-measures/  (보호대책 64항목)
│   ├── 03-personal-data/        (개인정보 21항목)
│   ├── csap-shared/             (CSAP 공유 증적 36항목)
│   └── INDEX.md                 (전체 색인)
├── 2. 심사원별 증적 뷰
│   ├── CSAP 심사용: csap-shared/ + CSAP 고유 증적
│   ├── ISMS-P 심사용: 전체 디렉토리
│   └── 통합 뷰: 매핑표 기반 교차 참조
├── 3. 증적 제출 형태별 가이드
│   ├── 문서형: PDF 변환 + 서명
│   ├── 시스템형: 스크린샷 + 로그 덤프
│   └── 프로세스형: 절차 시연 준비
└── 4. 갱신 시 패키지 업데이트 절차
```

### 2.3 부분 중복 보완 계획서 (FR-ISMS3.2)

```
docs/framework/03-isms-p/integrated-evidence/partial-supplement-plan.md
├── 9항목 개별 보완 계획
│   ├── 항목 1: 위험 평가 (CSAP D04-02 + ISMS-P 상세 위험분석)
│   ├── 항목 2: 외부자 계약 (CSAP D05-01 + ISMS-P 계약서 세부조항)
│   └── ... (9항목)
├── 보완 일정 (2026 Q4 ~ 2027 Q1)
└── 담당자 배정표
```

## 3. 추적성 매트릭스

| FR ID | 설계 섹션 | 산출물 | 검증 |
|-------|---------|--------|------|
| FR-ISMS3.1 | 2.1 1절 | detailed-mapping.md | 36항목 전수 |
| FR-ISMS3.2 | 2.1 2절, 2.3 | partial-supplement-plan.md | 9항목 전수 |
| FR-ISMS3.3 | 2.2 | package-guide.md | 디렉토리 구조 정의 |
| FR-ISMS3.4 | 2.1 4절 | detailed-mapping.md 내 | 버전 관리 규칙 |
| FR-ISMS3.5 | 2.2 2절 | package-guide.md 내 | 분리 제출 매핑 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
