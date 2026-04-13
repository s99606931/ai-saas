# SVC-AI-ADV-R551~R560 Plan — 공공 AI 모듈 10종 (R551~R560)

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 도시·재난·교통·재정·복지·문화·보훈·에너지·농업·체육 10개 영역의 AI 의사결정 지원 모듈 추가 |
| WHO | 환경부, 보건복지부, 교육부, 기획재정부, 고용노동부, 문화체육관광부, 국가보훈부, 산업통상자원부, 농림축산식품부, 지자체 |
| WHAT | 열섬탐지 ~ 체육시설 배분까지 10개 도메인 클래스 |
| HOW | 순수 TypeScript 로직 + N2SF 차단 가드 + append-only 감사 로그 |

## Context Anchor
- WHY: 공공 SaaS 프레임워크 lib/ 1198 → 1208, R550 이후 후속 라운드
- WHO: 공공기관 정책·운영 담당자
- RISK: C/S 등급 데이터 AI 전송 차단 강제 (N2SF N-05)
- SUCCESS: 10개 모듈 + 60 unit test + tsc 0 errors
- SCOPE: `platform/services/ai-service/src/lib/{10 files}.ts` + `__tests__/`

## 요구사항

### FR-R551 AI Urban Heat Island Detector
- FR-R551.1: 격자 셀 등록 (토지용도·표면/대기 온도·녹지·불투수·인구밀도)
- FR-R551.2: 열섬 강도 계산 (surfaceTemp - ambientTemp)
- FR-R551.3: low/medium/high/critical 4단계 위험도 + 맞춤 권고
- FR-R551.4: 상위 N개 핫스팟 랭킹
- FR-R551.5: 토지용도 필터링 / FR-R551.6: 감사 로그

### FR-R552 Public Grief Support AI
- FR-R552.1: 재난 케이스 등록 (익명화된 severity, 가족지원 여부)
- FR-R552.2: routine/priority/urgent/critical 4단계 트리아지
- FR-R552.3: counseling/hotline/medication 등 맞춤 지원 매칭
- FR-R552.4: 재난 유형별 통계 / FR-R552.5: 지역별 조회 / FR-R552.6: 감사

### FR-R553 AI School Bus Route Optimizer
- FR-R553.1: 학생·정류장 등록 (좌표 검증)
- FR-R553.2: Haversine 기반 최근접 정류장 배정
- FR-R553.3: Nearest-neighbor 휴리스틱 노선 최적화
- FR-R553.4: 총 거리·소요 시간 추정 / FR-R553.5: 정류장 조회 / FR-R553.6: 감사

### FR-R554 Government Lease Contract AI
- FR-R554.1: 계약 등록 (면적·월세·보증금·시세)
- FR-R554.2: 공정성 점수 + low/medium/high 위험 + approve/review/reject
- FR-R554.3: 연간 총 임대료 합산
- FR-R554.4~6: 목록/단건/감사 조회

### FR-R555 AI Foreign Worker Management
- FR-R555.1: 근로자 등록 (E7/E9/H2/F4/F5/D2 비자)
- FR-R555.2: 비자 만료 30일/90일 경보 + 보험 미가입 경보
- FR-R555.3: 비자 종류별 카운트
- FR-R555.4: 고용주별 조회 / FR-R555.5: 보험 가입률 / FR-R555.6: 감사

### FR-R556 Public Art Funding Evaluator AI
- FR-R556.1: 지원 신청 접수 (예술성 35% + 공공성 25% + 실현가능성 25% + 지역영향 15%)
- FR-R556.2: full/partial/reject 3단계 결정 + 다양성 감점
- FR-R556.3: 장르별 상위 N 랭킹
- FR-R556.4: 예산 한도 내 우선순위 배분
- FR-R556.5~6: 조회/감사

### FR-R557 AI Veteran Benefit Advisor
- FR-R557.1: 보훈대상자 등록 (5종 카테고리, 상이등급 1~7)
- FR-R557.2: 혜택 정의 (자격 카테고리·최소복무·소득·상이등급)
- FR-R557.3: 자격 매칭 + 월 총 수당 합산
- FR-R557.4~6: 카테고리 필터/통계/감사

### FR-R558 Smart Streetlight Controller AI
- FR-R558.1: 가로등 등록 (5종 구역, 정격 전력)
- FR-R558.2: 조도·보행자·차량 센서 데이터 수집
- FR-R558.3: 동적 디밍 제어 (주간 off, 학교/고속도로 가중, 고밀도 +15)
- FR-R558.4: 총 소비 전력 합산
- FR-R558.5: 1년 초과 유지보수 대상 식별 / FR-R558.6: 감사

### FR-R559 AI Agriculture Subsidy Optimizer
- FR-R559.1: 농가 신청 (6종 작물: 벼/채소/과일/곡물/축산/유기농)
- FR-R559.2: 기본 보조 (ha당 차등) + 지속가능성 가산 + 저소득 보전 + 장기 운영 가산
- FR-R559.3: 예산 한도 내 비례 조정
- FR-R559.4~6: 작물별 면적/조회/감사

### FR-R560 Public Sports Facility Allocator AI
- FR-R560.1: 시설 등록 (6종, 운영 시간대)
- FR-R560.2: 예약 요청 (우선순위 4단계: senior/disability/youth/general)
- FR-R560.3: 공정성 스코어링 + 시간대 배정 (granted/waitlist/denied)
- FR-R560.4: 이용률 계산
- FR-R560.5~6: 조회/감사

## 검증 기준
- tsc --noEmit 0 errors (noUnusedLocals, noUncheckedIndexedAccess 포함)
- vitest 60/60 passed
- 모든 public 메서드 ≤ 80줄
- N2SF C/S 등급 입력 시 모든 write 메서드에서 차단
- getAuditLog() append-only 불변 복사본 반환

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | R551~R560 신규 작성 | PM Lead |
