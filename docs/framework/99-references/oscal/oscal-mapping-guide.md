# OSCAL 호환성 레이어 매핑 가이드

> MTU-A4 | FR-7.1 | 적용 기준일: 2026-04-05
> 참조: NIST OSCAL 1.1.2, FedRAMP OSCAL 의무화 2026-09, EU CRA 2027

---

## 1. 개요

NIST OSCAL(Open Security Controls Assessment Language) 형식으로 CSAP 79개 통제항목과
N2SF 6개 보안 영역을 매핑하여 기계가독형 규제 준수 문서를 생성합니다.

**목적**:
- FedRAMP 인증 시 OSCAL SSP 필수 제출 (2026-09 의무화)
- EU CRA 사이버복원력법 기계가독형 문서화 (2027)
- CSAP-NIST 중복 항목 자동 식별 → 이중 인증 효율화

---

## 2. OSCAL 구조

```
OSCAL 문서 계층
-----------------------------------------
Catalog    : 통제항목 정의 (csap-catalog-local.json)
Profile    : 적용할 통제항목 선택 (csap-profile.json)  <-- 본 프레임워크
Component  : 시스템 구성 요소별 구현 설명
SSP        : System Security Plan (시스템 보안 계획)
Assessment : 평가 계획 및 결과
POAM       : Plan of Action and Milestones
-----------------------------------------
```

---

## 3. CSAP → OSCAL control.id 변환 규칙

### 3.1 변환 공식

```
CSAP ID 형식:   CSAP-D{분야번호}-{항목번호}
OSCAL ID 형식:  csap-d{분야번호}.{항목번호}

변환 규칙:
  1. 접두사 "CSAP-" 제거
  2. 소문자 변환
  3. "-" 를 "." 으로 변환
```

### 3.2 변환 예시

| CSAP ID | OSCAL control.id | NIST 800-53 대응 |
|---------|-----------------|-----------------|
| CSAP-D01-01 | csap-d01.01 | PL-1 (Security Planning Policy) |
| CSAP-D08-03 | csap-d08.03 | AC-7 (Unsuccessful Logon Attempts) |
| CSAP-D09-01 | csap-d09.01 | SC-13 (Cryptographic Protection) |
| CSAP-D09-02 | csap-d09.02 | SC-28 (Protection of Information at Rest) |
| CSAP-D09-03 | csap-d09.03 | SC-8 (Transmission Confidentiality) |
| CSAP-D12-01 | csap-d12.01 | SA-11 (Developer Security Testing) |
| CSAP-D12-10 | csap-d12.10 | CM-3 (Configuration Change Control) |
| CSAP-D13-10 | csap-d13.10 | — (N2SF 고유, NIST 미대응) |

---

## 4. N2SF → OSCAL 매핑

| N2SF 영역 | OSCAL group.id | NIST 800-53 Family | CSAP 연계 분야 |
|---------|--------------|-------------------|-------------|
| N-01 계정관리 | n2sf-n01 | AC (Access Control) | D-08 |
| N-02 권한관리 | n2sf-n02 | AC, IA (Identification) | D-08 |
| N-03 격리관리 | n2sf-n03 | SC (System/Comm Protection) | D-10, D-11 |
| N-04 암호관리 | n2sf-n04 | SC, IA | D-09 |
| N-05 데이터관리 | n2sf-n05 | MP (Media Protection), SI | D-04, D-12 |
| N-06 이벤트관리 | n2sf-n06 | AU (Audit/Accountability) | D-06 |

---

## 5. CSAP 13개 분야 전수 OSCAL 매핑

| CSAP 분야 | 항목 수 | OSCAL group.id | NIST 800-53 Family | 매핑 난이도 |
|---------|--------|--------------|-------------------|-----------|
| D-01 정보보호 정책 | 6 | csap-d01 | PL (Planning) | 낮음 |
| D-02 정보보호 조직 | 5 | csap-d02 | PS (Personnel Security) | 낮음 |
| D-03 인적 보안 | 4 | csap-d03 | PS, AT (Awareness/Training) | 낮음 |
| D-04 자산 관리 | 6 | csap-d04 | CM (Configuration Mgmt) | 중간 |
| D-05 공급망 관리 | 4 | csap-d05 | SR (Supply Chain Risk) | 높음 |
| D-06 침해사고 관리 | 5 | csap-d06 | IR (Incident Response) | 중간 |
| D-07 재해복구 | 4 | csap-d07 | CP (Contingency Planning) | 중간 |
| D-08 접근 통제 | 12 | csap-d08 | AC (Access Control) | 높음 |
| D-09 암호화 | 4 | csap-d09 | SC, IA | 중간 |
| D-10 네트워크 보안 | 8 | csap-d10 | SC | 중간 |
| D-11 가상화 보안 | 7 | csap-d11 | SC, SA (System Acquisition) | 중간 |
| D-12 시스템 개발 보안 | 10 | csap-d12 | SA | 높음 |
| D-13 공공기관 추가 | 10 | csap-d13 | SC, CA, PE | 높음 |
| **합계** | **79** | **13 groups** | **12 NIST Families** | — |

---

## 6. FedRAMP 호환 SSP 구조 준수

| FedRAMP SSP 필수 요소 | 대응 OSCAL 요소 | 프레임워크 적용 |
|--------------------|--------------|-------------|
| 시스템 설명 | system-characteristics | k3s 클러스터 기반 공공 SaaS |
| 보안 통제 구현 설명 | control-implementation | 79항목 구현 가이드 매핑 |
| 통제 담당자 | responsible-parties | CISO/보안담당/개발팀/IT |
| 매개변수 값 | set-parameters | 비밀번호 정책, 세션 정책 등 |
| OSCAL 버전 1.1.x | oscal-version | 1.1.2 명시 |

---

## 7. oscal-cli 검증 절차

### 7.1 설치

```bash
# Java 17+ 필요
wget https://github.com/usnistgov/oscal-cli/releases/latest/download/oscal-cli.jar
java -version  # OpenJDK 17+ 확인
```

### 7.2 프로파일 검증

```bash
# OSCAL JSON 스키마 유효성 검증
java -jar oscal-cli.jar validate \
  --as profile \
  docs/framework/99-references/oscal/csap-profile.json

# 성공 시 출력:
# [INFO] Validation of 'csap-profile.json' is valid.
```

### 7.3 Gitea CI/CD 자동 검증

```yaml
# .gitea/workflows/oscal-validate.yml
name: OSCAL 스키마 검증

on:
  push:
    paths:
      - 'docs/framework/99-references/oscal/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - name: OSCAL CLI 설치
        run: wget -q https://github.com/usnistgov/oscal-cli/releases/latest/download/oscal-cli.jar
      - name: 프로파일 검증
        run: java -jar oscal-cli.jar validate --as profile docs/framework/99-references/oscal/csap-profile.json
```

---

## 8. 로컬 카탈로그 생성 가이드

CSAP는 NIST처럼 공식 OSCAL 카탈로그를 제공하지 않으므로 로컬 카탈로그를 생성해야 합니다.

```bash
# csap-catalog-local.json 생성 스크립트 (개요)
# 1. checklist-master.md에서 79항목 추출
# 2. OSCAL catalog 스키마에 맞게 변환
# 3. 각 항목을 control 객체로 생성

# 카탈로그 구조:
# {
#   "catalog": {
#     "uuid": "...",
#     "metadata": { ... },
#     "groups": [
#       { "id": "csap-d01", "title": "정보보호 정책", "controls": [...] },
#       { "id": "csap-d02", "title": "정보보호 조직", "controls": [...] },
#       ...
#     ]
#   }
# }
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-A4 Do — OSCAL 매핑 가이드 + csap-profile.json 작성 | Implementer Agent |
