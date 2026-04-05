# MTU-A4: OSCAL 호환성 레이어 [신규]

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-A4 |
| Phase | Phase 4 Advanced |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-7.1 |
| 의존 MTU | MTU-C1 (CSAP 마스터 체크리스트), MTU-C4 (N2SF 매핑) |
| 예상 세션 | 1 세션 |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| WHY | FedRAMP OSCAL 의무화(2026-09) + EU CRA(2027) — 공공 SaaS 수출 및 글로벌 인증 시 OSCAL 형식 필수. 기계가독형 규제 준수 문서로 감리 자동화 기반 마련 |
| WHO | 보안 아키텍트 (OSCAL 프로파일 작성), CI/CD 담당 (oscal-cli 자동 검증) |
| RISK | OSCAL 스키마 오류 시 FedRAMP 제출 불가 — 초기 구조 설계 오류가 79항목 전체에 영향 |
| SUCCESS | CSAP 79항목 + N2SF 6영역 OSCAL 매핑 완비 + oscal-cli 검증 통과 |
| SCOPE | OSCAL SSP(System Security Plan) 프로파일 생성 + 매핑 가이드 작성, 실제 oscal-cli 실행은 구현 단계 |

---

## 목적

NIST OSCAL(Open Security Controls Assessment Language) 형식으로 CSAP 통제항목과
N2SF 보안 영역을 매핑하여 기계가독형 규제 준수 문서를 생성합니다.

**시장조사 반영 — 선택 근거**:
- **FedRAMP OSCAL 의무화 2026-09**: FedRAMP 승인 클라우드 서비스는 OSCAL SSP 필수 제출
- **EU CRA(사이버복원력법) 2027**: 유럽 판매 소프트웨어 보안 요구사항 기계가독형 문서화 의무
- **한국 공공 SaaS 수출 시 필수**: 미국 정부 조달(FedRAMP), EU 공공 조달(ENS) 동시 지원
- **NIST SP 800-53 Rev.5 연계**: CSAP D-08~D-13이 NIST 800-53과 80% 이상 중복 → OSCAL 매핑으로 중복 작업 제거
- **oscal-cli**: NIST 공식 검증 도구, GitHub Actions 연동 가능

---

## 산출물 파일 (2개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `99-references/oscal/csap-profile.json` | OSCAL SSP 형식 | CSAP 79항목 OSCAL control.id 매핑 완비 JSON |
| `99-references/oscal/oscal-mapping-guide.md` | 아키텍처 레퍼런스형 | OSCAL 구조 설명, CSAP↔OSCAL ID 변환 규칙, oscal-cli 사용법 |

---

## OSCAL 구조 설계

### CSAP → OSCAL control.id 변환 규칙

```
CSAP ID 형식:  CSAP-D{분야번호}-{항목번호}
OSCAL ID 형식: csap-d{분야번호}.{항목번호}

변환 예시:
  CSAP-D08-03  →  control.id: "csap-d08.03"
  CSAP-D09-01  →  control.id: "csap-d09.01"
  CSAP-D12-10  →  control.id: "csap-d12.10"
```

### N2SF → OSCAL 영역 매핑

| N2SF 영역 | OSCAL group.id | NIST 800-53 대응 |
|---------|--------------|----------------|
| N-01 (계정관리) | n2sf-n01 | AC (Access Control) |
| N-02 (권한관리) | n2sf-n02 | AC, IA (Identification and Authentication) |
| N-03 (격리관리) | n2sf-n03 | SC (System and Communications Protection) |
| N-04 (암호관리) | n2sf-n04 | SC, IA |
| N-05 (데이터관리) | n2sf-n05 | MP (Media Protection), SI |
| N-06 (이벤트관리) | n2sf-n06 | AU (Audit and Accountability) |

### csap-profile.json 스켈레톤 구조

```json
{
  "profile": {
    "uuid": "{{생성 시 UUID}}",
    "metadata": {
      "title": "공공기관 SaaS 프레임워크 CSAP 보안 프로파일",
      "version": "1.0.0",
      "oscal-version": "1.1.2",
      "last-modified": "2026-04-05T00:00:00Z",
      "parties": [
        {
          "uuid": "{{UUID}}",
          "type": "organization",
          "name": "공공기관 SaaS 프레임워크 개발팀"
        }
      ]
    },
    "imports": [
      {
        "href": "./csap-catalog-local.json",
        "_note": "CSAP는 공식 OSCAL 카탈로그 미제공 — 로컬 생성 카탈로그 사용. NIST SP 800-53 Rev.5 OSCAL 기반(usnistgov/oscal-content) 커스텀 매핑 적용",
        "include-controls": {
          "with-ids": [
            "csap-d08.01", "csap-d08.02", "...",
            "csap-d09.01", "csap-d09.02", "...",
            "csap-d12.01", "..."
          ]
        }
      }
    ],
    "merge": { "as-is": true },
    "modify": {
      "set-parameters": [
        {
          "param-id": "csap-d08.03_prm_1",
          "values": ["RBAC", "최소 권한 원칙"]
        }
      ]
    }
  }
}
```

---

## CSAP 분야별 OSCAL 매핑 현황 계획

| CSAP 분야 | 항목 수 | OSCAL group.id | NIST 대응 분야 | 매핑 난이도 |
|---------|--------|--------------|-------------|-----------|
| D-01 정보보호 정책 | 6 | csap-d01 | PL (Planning) | 낮음 |
| D-02 정보보호 조직 | 5 | csap-d02 | PS (Personnel Security) | 낮음 |
| D-03 인적 보안 | 4 | csap-d03 | PS, AT (Awareness and Training) | 낮음 |
| D-04 자산 관리 | 6 | csap-d04 | CM (Configuration Mgmt) | 중간 |
| D-05 공급망 관리 | 4 | csap-d05 | SR (Supply Chain Risk Mgmt) | 높음 |
| D-06 침해사고 관리 | 5 | csap-d06 | IR (Incident Response) | 중간 |
| D-07 재해복구 | 4 | csap-d07 | CP (Contingency Planning) | 중간 |
| D-08 접근 통제 | 12 | csap-d08 | AC | 높음 |
| D-09 암호화 | 4 | csap-d09 | SC, IA | 중간 |
| D-10 네트워크 보안 | 8 | csap-d10 | SC (System and Comm. Protection) | 중간 |
| D-11 가상화 보안 | 7 | csap-d11 | SC, SA (System Acquisition) | 중간 |
| D-12 시스템 개발 보안 | 10 | csap-d12 | SA (System Acquisition) | 높음 |
| D-13 공공기관 추가 보호조치 | 10 | csap-d13 | SC, CA (Assessment), PE | 높음 |
| **합계** | **79** | **13 groups** | — | — |

---

## oscal-cli 검증 파이프라인

```bash
# 1. oscal-cli 설치 (Java 기반)
wget https://github.com/usnistgov/oscal-cli/releases/latest/download/oscal-cli.jar

# 2. OSCAL JSON 스키마 유효성 검증
java -jar oscal-cli.jar validate \
  --as profile \
  99-references/oscal/csap-profile.json

# 3. 성공 출력 예시
# [INFO] Validation of 'csap-profile.json' is valid.

# 4. Gitea CI/CD 자동 검증 (Actions 단계)
# .gitea/workflows/oscal-validate.yml에 추가
```

---

## FedRAMP 호환 SSP 구조 준수 체크

| FedRAMP SSP 필수 요소 | 대응 OSCAL 요소 | 적용 여부 |
|--------------------|--------------|---------|
| 시스템 설명 | system-characteristics | 포함 |
| 보안 통제 구현 설명 | control-implementation | 포함 |
| 통제 담당자 | responsible-parties | 포함 |
| 매개변수 값 | set-parameters | 포함 |
| OSCAL 버전 1.1.x | oscal-version | 1.1.2 명시 |

---

## 합격 기준

1. CSAP 79항목 OSCAL control.id 매핑 완비: `csap-d{분야}.{항목}` 형식으로 전수 기재 (누락 0건)
2. N2SF 6영역 OSCAL 매핑 포함: n2sf-n01~n06 group.id 및 NIST 800-53 교차 매핑
3. oscal-cli 검증 통과: `csap-profile.json` 스키마 유효성 검증 오류 0건 (JSON 구조 기준)
4. FedRAMP 호환 SSP 구조 준수: 5개 필수 요소 전수 포함

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 — FedRAMP 2026-09 의무화, EU CRA 2027 대응 신규 모듈 | Claude Code |
| 0.2.0 | 2026-04-05 | P1: CSAP OSCAL 카탈로그 URL 오류 수정 (존재하지 않는 URL → 로컬 파일 참조로 변경), D10~D13 도메인명 수정 (P0-02 MTU-C1 기준 정렬) | Claude Code |
