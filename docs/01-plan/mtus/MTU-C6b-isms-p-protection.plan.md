# MTU-C6b: ISMS-P 보호 분야 + 개인정보 처리단계별 보호조치 구현 가이드

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-C6b |
| Phase | Phase 3 Infrastructure |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-2.4 (ISMS-P 보호 분야) |
| 의존 MTU | MTU-C6a |
| 예상 세션 | 2 세션 |
| 분할 근거 | CTO 검토 R-03: MTU-C6 101항목 단일 MTU → 2세션 초과 위험. 보호(64) + 개인정보(21) 분야를 MTU-C6b로 분리 |

---

**세션 분할 계획**:
- Session 1: 보호 분야 (P1~P5) 구현 가이드 작성 (64개 항목)
- Session 2: 개인정보 생명주기 (21개 항목) + 자동 증적 수집 파이프라인 구성

---

## 목적

ISMS-P 보호 분야 64개 항목과 개인정보 처리단계별 보호조치 21개 항목 구현 가이드를 제공합니다.
자동 증적 수집 패턴(Gitea Actions → audit.jsonl)을 포함하여 2027년 의무화 심사 준비를 지원합니다.

**자동 증적 수집 핵심 가치**:
- 2026년 감사 패러다임: "운영 증적이 있는가?" 자동 검증으로 대응
- Gitea Actions 빌드/배포 이벤트 → audit.jsonl 자동 기록
- ISMS-P 심사 시 증거 자료 자동 제출 가능 (수동 수집 제거)
- 월간 증적 리포트 자동 생성 → 심사 준비 공수 80% 절감

---

## 산출물 파일

### 보호 분야 (64항목)

| 파일 | ISMS-P 항목 범위 | 핵심 내용 |
|------|--------------|---------|
| `05-isms-p/protection-controls/P01-P14-access.md` | ISMS-P-P-01~14 | 접근 통제, 계정 관리, 인증 |
| `05-isms-p/protection-controls/P15-P29-crypto.md` | ISMS-P-P-15~29 | 암호화, 키 관리, 인증서 |
| `05-isms-p/protection-controls/P30-P44-network.md` | ISMS-P-P-30~44 | 네트워크 보안, 시스템 개발, 취약점 |
| `05-isms-p/protection-controls/P45-P64-operation.md` | ISMS-P-P-45~64 | 운영 보안, 감사 로그, 사고 대응, 업무 연속성 |

### 개인정보 처리단계별 보호조치 (21항목)

| 파일 | ISMS-P 항목 범위 | 핵심 내용 |
|------|--------------|---------|
| `05-isms-p/privacy-controls/I01-I07-collection.md` | ISMS-P-I-01~07 | 개인정보 수집 동의, 최소 수집, 목적 외 이용 금지 |
| `05-isms-p/privacy-controls/I08-I14-processing.md` | ISMS-P-I-08~14 | 개인정보 처리, 접근 통제, 암호화, 위탁 관리 |
| `05-isms-p/privacy-controls/I15-I21-disposal.md` | ISMS-P-I-15~21 | 개인정보 보유 기간, 파기 절차, 정보주체 권리 |

### 자동화

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `05-isms-p/evidence-automation-guide.md` | 구현 가이드형 | Gitea Actions → audit.jsonl 자동 증적 수집 패턴 |

---

## ISMS-P 보호 분야 64항목 구조

| 대분류 | 항목 범위 | 항목 수 | 주요 내용 |
|--------|---------|---------|---------|
| 접근 통제 | P-01~14 | 14 | 사용자 인증, 권한 관리, 특권 계정, 세션 |
| 암호화 | P-15~29 | 15 | 저장·전송 암호화, 키 관리, PKI |
| 네트워크·개발·취약점 | P-30~44 | 15 | 방화벽, SAST/DAST, 패치 관리 |
| 운영·사고·연속성 | P-45~64 | 20 | 감사 로그, 사고 대응, BCP |
| **합계** | — | **64** | — |

---

## 자동 증적 수집 아키텍처

```
Gitea Actions 이벤트 흐름
─────────────────────────────────────────────────────
빌드 이벤트 발생 (push / PR merge)
    │
    ▼
Gitea Actions 파이프라인 실행
    │
    ├── 빌드 성공/실패 결과
    ├── Trivy 취약점 스캔 결과       → ISMS-P-P-38 증거
    ├── ESLint 보안 분석 결과        → ISMS-P-P-33 증거
    └── 테스트 커버리지 결과         → ISMS-P-P-35 증거
    │
    ▼
audit.jsonl 자동 기록 (append-only)
    │
    ▼
월간 증적 리포트 자동 생성
    │
    ▼
ISMS-P 심사 시 증거 자료 자동 제출
─────────────────────────────────────────────────────
```

### 자동 증적 수집 구현 패턴 (Gitea Actions)

```yaml
# .gitea/workflows/evidence-collection.yml
name: ISMS-P 증적 자동 수집

on:
  push:
    branches: [main, develop]
  pull_request:
    types: [closed]

jobs:
  collect-evidence:
    runs-on: ubuntu-latest
    steps:
      - name: 소스코드 체크아웃
        uses: actions/checkout@v4

      - name: Trivy 취약점 스캔 (ISMS-P-P-38, CSAP-D12-01)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          format: 'json'
          output: 'trivy-results.json'

      - name: audit.jsonl 자동 기록
        env:
          AUDIT_FILE: /var/log/audit.jsonl
        run: |
          cat >> $AUDIT_FILE << EOF
          {
            "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
            "actor": "${{ github.actor }}",
            "action": "CI_BUILD",
            "branch": "${{ github.ref_name }}",
            "commit": "${{ github.sha }}",
            "trivy_result": "$(cat trivy-results.json | jq -c .)",
            "isms_p_controls": ["ISMS-P-P-38", "ISMS-P-P-33"],
            "csap_controls": ["CSAP-D12-01", "CSAP-D11-06"]
          }
          EOF
```

### audit.jsonl 스키마 (ISMS-P 연계)

```typescript
// audit.jsonl 항목 구조 (ISMS-P + CSAP 통합)
interface IsmsPAuditEntry {
  timestamp: string           // ISO 8601
  actor: string               // 작업자 ID
  action: AuditAction         // 수행 작업 유형
  resource?: string           // 대상 리소스
  result: 'SUCCESS' | 'FAILURE' | 'BLOCKED'
  ismsPControls: string[]     // 관련 ISMS-P-P-XX 항목
  ismsPIControls?: string[]   // 관련 ISMS-P-I-XX 항목 (개인정보 처리 시)
  csapControls: string[]      // 관련 CSAP-DXX-YY 항목
  evidence?: Record<string, unknown>  // 증거 데이터 (스캔 결과 등)
  ip: string
}

type AuditAction =
  | 'CI_BUILD'          // ISMS-P-P-38 취약점 스캔
  | 'DEPLOY'            // ISMS-P-P-45 배포 감사
  | 'ACCESS'            // ISMS-P-P-01 접근 기록
  | 'PERSONAL_DATA_ACCESS'  // ISMS-P-I-08 개인정보 접근
  | 'PERSONAL_DATA_DELETE'  // ISMS-P-I-19 개인정보 파기
```

---

## 개인정보 처리단계별 21항목 구조

| 코드 | 항목명 | 처리 단계 | 핵심 요건 |
|------|--------|---------|---------|
| ISMS-P-I-01 | 개인정보 수집 동의 | 수집 | 명시적 동의, 목적 고지 |
| ISMS-P-I-02 | 최소 수집 원칙 | 수집 | 서비스에 필요한 최소한만 수집 |
| ISMS-P-I-03 | 수집 제한 | 수집 | 법적 근거 없는 수집 금지 |
| ISMS-P-I-04 | 목적 외 이용 금지 | 수집 | 고지 목적 외 사용 금지 |
| ISMS-P-I-05 | 개인정보 처리 방침 | 수집 | 처리 방침 공개 의무 |
| ISMS-P-I-06 | 제3자 제공 동의 | 수집 | 제3자 제공 시 별도 동의 |
| ISMS-P-I-07 | 민감 정보 처리 제한 | 수집 | 민감 정보 별도 동의 필수 |
| ISMS-P-I-08 | 개인정보 처리 기록 | 처리 | 처리 목적·항목·기간 기록 |
| ISMS-P-I-09 | 접근 권한 관리 | 처리 | 최소 권한 원칙, 접근 로그 |
| ISMS-P-I-10 | 개인정보 암호화 | 처리 | 주민번호·계좌번호 등 암호화 |
| ISMS-P-I-11 | 접속 기록 보관 | 처리 | 6개월 이상 보관 |
| ISMS-P-I-12 | 보안 프로그램 설치 | 처리 | 악성코드 방지 조치 |
| ISMS-P-I-13 | 수탁자 관리 | 처리 | 수탁자 계약·교육·점검 |
| ISMS-P-I-14 | 국외 이전 제한 | 처리 | 국외 이전 시 동의 + 보호조치 |
| ISMS-P-I-15 | 보유 기간 설정 | 보유/파기 | 보유 기간 명시 + 파기 계획 |
| ISMS-P-I-16 | 보유 기간 만료 처리 | 보유/파기 | 만료 시 즉시 파기 |
| ISMS-P-I-17 | 파기 방법 | 보유/파기 | 복구 불가 방법으로 파기 |
| ISMS-P-I-18 | 파기 기록 보관 | 보유/파기 | 파기 일시·방법·담당자 기록 |
| ISMS-P-I-19 | 정보주체 열람권 | 권리 보장 | 열람 요구 30일 이내 처리 |
| ISMS-P-I-20 | 정보주체 정정·삭제권 | 권리 보장 | 정정·삭제 요구 처리 절차 |
| ISMS-P-I-21 | 정보주체 처리 정지권 | 권리 보장 | 처리 정지 요구 30일 이내 처리 |

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-2.4-P | ISMS-P 보호 분야 64항목 전수 | ISMS-P-P-01~64 전수 포함, 누락 0개 |
| FR-2.4-I | 개인정보 처리단계별 21항목 전수 | ISMS-P-I-01~21 전수 포함, 누락 0개 |
| FR-2.4-Pa | 자동 증적 수집 패턴 | Gitea Actions YAML 예시 + audit.jsonl 스키마 포함 |
| FR-2.4-Pb | audit.jsonl 연동 예시 | ISMS-P-P/I 항목 코드 자동 기록 패턴 포함 |
| FR-2.4-Pc | CSAP 중첩 항목 교차 참조 | CSAP-DXX-YY 역참조 완비 |

---

## 합격 기준

1. ISMS-P 보호 분야 64항목 전수 수록 (ISMS-P-P-01~64, 누락 0개)
2. 개인정보 처리단계별 21항목 전수 수록 (ISMS-P-I-01~21, 누락 0개)
3. `evidence-automation-guide.md`: Gitea Actions → audit.jsonl 자동 기록 YAML 예시 포함
4. audit.jsonl 스키마에 `ismsPControls`, `ismsPIControls` 필드 포함
5. 각 항목에 CSAP 중첩 항목 교차 참조 완비 (중복 작업 방지)
6. MTU-C6a 참조 링크 포함 (관리 분야 16항목 연계)
7. 개인정보 처리단계(수집→처리→보유·파기→권리보장) 단계별 구성 명확
8. Auditor 에이전트 Q-GATE G6 통과

---

## 테스트 시나리오

**TS-C6b-01**: 개발자가 `evidence-automation-guide.md`만으로 Gitea Actions 워크플로우 설정 후 audit.jsonl 자동 기록 확인
**TS-C6b-02**: 개인정보 담당자가 ISMS-P-I 파일만으로 개인정보 파기 절차 구성 방법 확인 가능
**TS-C6b-03**: ISMS-P 심사 전 자동 생성된 audit.jsonl에서 P-01~64, I-01~21 증거 자료 추출 가능

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | MTU-C6 분할 — CTO 검토 R-03 반영. 보호 분야 64항목 + 개인정보 21항목 + 자동 증적 패턴 설계 | Claude Code |
| 0.2.0 | 2026-04-05 | P0-04: 1세션 → 2세션 수정 (85항목+8파일 분량 반영) | CTO 팀 검토 |
