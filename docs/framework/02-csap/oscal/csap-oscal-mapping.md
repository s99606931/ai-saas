# CSAP ID -- OSCAL control.id 매핑 테이블

> **문서 ID**: CSAP-OSCAL-MAPPING
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan SC**: FR-CSAP3.4 | **Design Ref**: MTU-CSAP3 Design 2.2
> **참조**: checklist-master.md, component-definition.json

---

## 1. 매핑 규칙

| 항목 | 규칙 |
|------|------|
| CSAP ID 형식 | `CSAP-DXX-YY` (XX: 분야 번호, YY: 항목 순번) |
| OSCAL control-id | CSAP ID와 동일 (직접 매핑) |
| 구현 상태 코드 | `implemented` / `template` / `guide` / `organizational` / `not-applicable` |

---

## 2. 전체 매핑 테이블 (79항목)

### D01 정보보호 정책 (4항목)

| # | CSAP ID | OSCAL control-id | 항목명 | 구현 상태 |
|---|---------|-----------------|--------|---------|
| 1 | CSAP-D01-01 | CSAP-D01-01 | 정보보호 정책 수립 | template |
| 2 | CSAP-D01-02 | CSAP-D01-02 | 정보보호 정책 공표 | template |
| 3 | CSAP-D01-03 | CSAP-D01-03 | 정보보호 정책 검토 | template |
| 4 | CSAP-D01-04 | CSAP-D01-04 | 관련 법령 준수 | template |

### D02 조직 보안 (3항목)

| # | CSAP ID | OSCAL control-id | 항목명 | 구현 상태 |
|---|---------|-----------------|--------|---------|
| 5 | CSAP-D02-01 | CSAP-D02-01 | 정보보호 조직 구성 | template |
| 6 | CSAP-D02-02 | CSAP-D02-02 | 정보보호 책임 할당 | organizational |
| 7 | CSAP-D02-03 | CSAP-D02-03 | 외부 전문가 활용 | organizational |

### D03 인적 보안 (4항목)

| # | CSAP ID | OSCAL control-id | 항목명 | 구현 상태 |
|---|---------|-----------------|--------|---------|
| 8 | CSAP-D03-01 | CSAP-D03-01 | 보안 서약 | template |
| 9 | CSAP-D03-02 | CSAP-D03-02 | 보안 교육 | template |
| 10 | CSAP-D03-03 | CSAP-D03-03 | 퇴직자 관리 | template |
| 11 | CSAP-D03-04 | CSAP-D03-04 | 외부 인력 관리 | template |

### D04 자산 관리 (5항목)

| # | CSAP ID | OSCAL control-id | 항목명 | 구현 상태 |
|---|---------|-----------------|--------|---------|
| 12 | CSAP-D04-01 | CSAP-D04-01 | 자산 식별 | guide |
| 13 | CSAP-D04-02 | CSAP-D04-02 | 자산 분류 | guide |
| 14 | CSAP-D04-03 | CSAP-D04-03 | 자산 취급 | guide |
| 15 | CSAP-D04-04 | CSAP-D04-04 | 자산 반납 | guide |
| 16 | CSAP-D04-05 | CSAP-D04-05 | 매체 관리 | guide |

### D05 공급망 보안 (4항목)

| # | CSAP ID | OSCAL control-id | 항목명 | 구현 상태 |
|---|---------|-----------------|--------|---------|
| 17 | CSAP-D05-01 | CSAP-D05-01 | 공급망 보안 정책 | guide |
| 18 | CSAP-D05-02 | CSAP-D05-02 | 공급업체 평가 | guide |
| 19 | CSAP-D05-03 | CSAP-D05-03 | 공급업체 모니터링 | guide |
| 20 | CSAP-D05-04 | CSAP-D05-04 | 소프트웨어 공급망 | implemented |

### D06 침해사고 관리 (5항목)

| # | CSAP ID | OSCAL control-id | 항목명 | 구현 상태 |
|---|---------|-----------------|--------|---------|
| 21 | CSAP-D06-01 | CSAP-D06-01 | 침해사고 대응 절차 | implemented |
| 22 | CSAP-D06-02 | CSAP-D06-02 | 침해사고 보고 | implemented |
| 23 | CSAP-D06-03 | CSAP-D06-03 | 감사 로그 | implemented |
| 24 | CSAP-D06-04 | CSAP-D06-04 | 로그 분석 | implemented |
| 25 | CSAP-D06-05 | CSAP-D06-05 | 사후 관리 | guide |

### D07 재해 복구 (4항목)

| # | CSAP ID | OSCAL control-id | 항목명 | 구현 상태 |
|---|---------|-----------------|--------|---------|
| 26 | CSAP-D07-01 | CSAP-D07-01 | 재해 복구 계획 | guide |
| 27 | CSAP-D07-02 | CSAP-D07-02 | 백업 관리 | implemented |
| 28 | CSAP-D07-03 | CSAP-D07-03 | 복원 테스트 | guide |
| 29 | CSAP-D07-04 | CSAP-D07-04 | 업무 연속성 | guide |

### D08 접근 통제 (12항목)

| # | CSAP ID | OSCAL control-id | 항목명 | 구현 상태 |
|---|---------|-----------------|--------|---------|
| 30 | CSAP-D08-01 | CSAP-D08-01 | 사용자 계정 관리 | implemented |
| 31 | CSAP-D08-02 | CSAP-D08-02 | 사용자 인증 | implemented |
| 32 | CSAP-D08-03 | CSAP-D08-03 | 권한 관리 | implemented |
| 33 | CSAP-D08-04 | CSAP-D08-04 | 접근 통제 | implemented |
| 34 | CSAP-D08-05 | CSAP-D08-05 | 세션 관리 | implemented |
| 35 | CSAP-D08-06 | CSAP-D08-06 | 로그인 실패 관리 | implemented |
| 36 | CSAP-D08-07 | CSAP-D08-07 | 비밀번호 관리 | implemented |
| 37 | CSAP-D08-08 | CSAP-D08-08 | 관리자 접근 통제 | implemented |
| 38 | CSAP-D08-09 | CSAP-D08-09 | 원격 접근 통제 | implemented |
| 39 | CSAP-D08-10 | CSAP-D08-10 | 모바일 접근 통제 | implemented |
| 40 | CSAP-D08-11 | CSAP-D08-11 | 테넌트 격리 | implemented |
| 41 | CSAP-D08-12 | CSAP-D08-12 | 접근 권한 검토 | guide |

### D09 암호화 (4항목)

| # | CSAP ID | OSCAL control-id | 항목명 | 구현 상태 |
|---|---------|-----------------|--------|---------|
| 42 | CSAP-D09-01 | CSAP-D09-01 | 암호 정책 | implemented |
| 43 | CSAP-D09-02 | CSAP-D09-02 | 전송 암호화 | implemented |
| 44 | CSAP-D09-03 | CSAP-D09-03 | 저장 암호화 | implemented |
| 45 | CSAP-D09-04 | CSAP-D09-04 | 키 관리 | guide |

### D10 네트워크 보안 (8항목)

| # | CSAP ID | OSCAL control-id | 항목명 | 구현 상태 |
|---|---------|-----------------|--------|---------|
| 46 | CSAP-D10-01 | CSAP-D10-01 | 네트워크 보안 정책 | implemented |
| 47 | CSAP-D10-02 | CSAP-D10-02 | 네트워크 분리 | implemented |
| 48 | CSAP-D10-03 | CSAP-D10-03 | 방화벽 | implemented |
| 49 | CSAP-D10-04 | CSAP-D10-04 | 침입 탐지 | implemented |
| 50 | CSAP-D10-05 | CSAP-D10-05 | DDoS 대응 | guide |
| 51 | CSAP-D10-06 | CSAP-D10-06 | 무선 네트워크 | not-applicable |
| 52 | CSAP-D10-07 | CSAP-D10-07 | DNS 보안 | guide |
| 53 | CSAP-D10-08 | CSAP-D10-08 | 데이터 유출 방지 | implemented |

### D11 가상화 보안 (8항목)

| # | CSAP ID | OSCAL control-id | 항목명 | 구현 상태 |
|---|---------|-----------------|--------|---------|
| 54 | CSAP-D11-01 | CSAP-D11-01 | 가상화 보안 정책 | implemented |
| 55 | CSAP-D11-02 | CSAP-D11-02 | 가상 머신 격리 | implemented |
| 56 | CSAP-D11-03 | CSAP-D11-03 | 이미지 관리 | implemented |
| 57 | CSAP-D11-04 | CSAP-D11-04 | 가상 네트워크 | implemented |
| 58 | CSAP-D11-05 | CSAP-D11-05 | 가상 스토리지 | implemented |
| 59 | CSAP-D11-06 | CSAP-D11-06 | 하이퍼바이저 보안 | guide |
| 60 | CSAP-D11-07 | CSAP-D11-07 | 자원 관리 | implemented |
| 61 | CSAP-D11-08 | CSAP-D11-08 | 가상화 패치 | guide |

### D12 시스템 개발 보안 (10항목)

| # | CSAP ID | OSCAL control-id | 항목명 | 구현 상태 |
|---|---------|-----------------|--------|---------|
| 62 | CSAP-D12-01 | CSAP-D12-01 | 개발 보안 정책 | implemented |
| 63 | CSAP-D12-02 | CSAP-D12-02 | 입력값 검증 | implemented |
| 64 | CSAP-D12-03 | CSAP-D12-03 | SQL 주입 방지 | implemented |
| 65 | CSAP-D12-04 | CSAP-D12-04 | XSS 방지 | implemented |
| 66 | CSAP-D12-05 | CSAP-D12-05 | 에러 처리 | implemented |
| 67 | CSAP-D12-06 | CSAP-D12-06 | 파일 업로드 보안 | implemented |
| 68 | CSAP-D12-07 | CSAP-D12-07 | API 보안 | implemented |
| 69 | CSAP-D12-08 | CSAP-D12-08 | 취약점 점검 | implemented |
| 70 | CSAP-D12-09 | CSAP-D12-09 | 보안 테스트 | implemented |
| 71 | CSAP-D12-10 | CSAP-D12-10 | 형상 관리 | implemented |

### D13 공공기관 추가 보호조치 (8항목)

| # | CSAP ID | OSCAL control-id | 항목명 | 구현 상태 |
|---|---------|-----------------|--------|---------|
| 72 | CSAP-D13-01 | CSAP-D13-01 | 공공기관 보안 관제 | implemented |
| 73 | CSAP-D13-02 | CSAP-D13-02 | 공공기관 데이터 보호 | implemented |
| 74 | CSAP-D13-03 | CSAP-D13-03 | 공공기관 서비스 연속성 | guide |
| 75 | CSAP-D13-04 | CSAP-D13-04 | 공공기관 사고 통보 | guide |
| 76 | CSAP-D13-05 | CSAP-D13-05 | 공공기관 컴플라이언스 | implemented |
| 77 | CSAP-D13-06 | CSAP-D13-06 | 공공기관 접근 제어 | implemented |
| 78 | CSAP-D13-07 | CSAP-D13-07 | 공공기관 감사 추적 | implemented |
| 79 | CSAP-D13-08 | CSAP-D13-08 | 공공기관 인력 보안 | template |

---

## 3. 구현 상태 통계

| 상태 | 항목 수 | 비율 | 설명 |
|------|--------|------|------|
| implemented | 40 | 50.6% | 플랫폼에 코드/설정 구현 완료 |
| template | 10 | 12.7% | 템플릿 제공 (조직 커스터마이징 필요) |
| guide | 17 | 21.5% | 구현 가이드 제공 (환경별 설정) |
| organizational | 2 | 2.5% | 조직 차원 문서 필요 |
| not-applicable | 1 | 1.3% | SaaS 서비스에 해당 없음 |
| **합계** | **79** | **100%** | |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 — 79항목 전수 매핑 | PM Agent |
