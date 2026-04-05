# MTU-C5: N2SF 6개 영역 통제 구현 가이드

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-C5 |
| Phase | Phase 2 Core Security |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-3.3, FR-3.4, FR-3.5 |
| 의존 MTU | MTU-C4 |
| 예상 세션 | 1 세션 |

---

## 목적

N2SF(국가사이버안전관리규정) 6개 보안 영역(N01~N06) 구현 가이드를 제공합니다.
각 영역별 C/S/O 등급에 따른 통제 요건과 CSAP 통제항목 역참조를 포함합니다.

**시장조사 반영 — N2SF MLS 2026 대응**:
- N2SF 다층보안(MLS, Multi-Level Security) 2026년 도입 예정
- MLS 도입 시 공개망에서도 보안 등급별 LLM 활용 가능한 아키텍처 전환
- 현재(폐쇄망 격리) → 미래(MLS 기반 공개망 허용) 이중 아키텍처 설계 필수
- 산출물 `N03-isolation.md`에 MLS 전환 로드맵 포함

**핵심 원칙 — N03 격리**:
- C 등급: 물리적 완전 격리 + 논리적 분리 (공개망 연결 불가, 전용 k3s 클러스터)
- S 등급: 논리적 분리 (전용 Namespace, NetworkPolicy 강제 차단)
- O 등급: 공유 클러스터 허용 (Namespace 격리 + 레이블 강제)

---

## 산출물 파일 (6개)

| 파일 | N2SF 영역 | 핵심 내용 |
|------|---------|---------|
| `03-n2sf/domains/N01-management-security.md` | N01 관리적 보안 | 정책 수립, 조직, 교육, CSAP D01~D03 역참조 |
| `03-n2sf/domains/N02-authentication.md` | N02 인증 | 사용자 식별·인증, RBAC, MFA, CSAP D08 역참조 |
| `03-n2sf/domains/N03-isolation.md` | N03 격리 | C/S/O 등급별 격리 아키텍처, MLS 전환 로드맵 |
| `03-n2sf/domains/N04-encryption.md` | N04 암호화 | 등급별 암호화 요건, KCMVP 알고리즘, CSAP D09 역참조 |
| `03-n2sf/domains/N05-data.md` | N05 데이터 | 데이터 분류·처리·AI API 연동 통제, MTU-C4 연계 |
| `03-n2sf/domains/N06-operations.md` | N06 운영 | 취약점 관리, 감사 로그, 사고 대응, CSAP D06·D12 역참조 |

---

## N2SF 영역별 핵심 통제 요건

### N01 관리적 보안 — 등급별 요건

| 통제 항목 | C 등급 | S 등급 | O 등급 |
|---------|--------|--------|--------|
| 정보보호 정책 | 연 2회 검토 + 경영진 서명 | 연 1회 검토 | 수립 확인 |
| 보안 교육 | 분기별 필수 교육 + 시험 | 반기별 필수 교육 | 연 1회 |
| 사고 보고 | 1시간 이내 보고 | 4시간 이내 보고 | 24시간 이내 |

### N02 인증 — 등급별 요건

| 통제 항목 | C 등급 | S 등급 | O 등급 |
|---------|--------|--------|--------|
| 인증 방식 | 다중 인증 필수 (OTP+생체) | 다중 인증 필수 (OTP) | 아이디/비밀번호 허용 |
| 세션 유효 시간 | 15분 | 30분 | 60분 |
| 특권 계정 | 별도 계정 + 매 접근 승인 | 별도 계정 필수 | 역할 분리 권고 |
| 로그인 실패 잠금 | 3회 | 5회 | 10회 |

### N03 격리 — 아키텍처 (핵심)

```
현재 아키텍처 (2026년 기준)
─────────────────────────────────────────────────
C 등급 (기밀)     │ 물리 격리 전용 클러스터
                  │ 공개망 연결 없음
                  │ 전용 HSM 암호화
─────────────────────────────────────────────────
S 등급 (민감)     │ 논리 격리 전용 Namespace
                  │ NetworkPolicy: 기본 차단
                  │ 타 Namespace 통신 불가
─────────────────────────────────────────────────
O 등급 (공개)     │ 공유 클러스터
                  │ Namespace 격리 + 레이블 강제
                  │ AI API 연동 허용 (마스킹 후)
─────────────────────────────────────────────────

N2SF MLS 전환 로드맵 (미래 아키텍처)
─────────────────────────────────────────────────
2026년 하반기     │ N2SF MLS 도입 검토 시작
2027년            │ MLS 파일럿 (O→S 등급 공개망 연동)
2028년 이후       │ C 등급 MLS 기반 공개망 LLM 활용 검토
─────────────────────────────────────────────────
```

### N03 격리 구현 패턴 (k3s Namespace)

```yaml
# C 등급 Namespace — 기본 모든 통신 차단 (CSAP-D10-01, N2SF N-03)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: classified-workloads  # C 등급 전용 Namespace
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  # Egress: 외부 인터넷 전면 차단 (공개망 연결 불가)
---
# S 등급 Namespace — 동일 Namespace 내 통신만 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: sensitive-namespace-isolation
  namespace: sensitive-workloads  # S 등급 전용 Namespace
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          data-grade: sensitive  # S 등급 Namespace 간만 허용
```

### N04 암호화 — KCMVP 승인 알고리즘

| 용도 | 승인 알고리즘 | 금지 알고리즘 |
|------|------------|------------|
| 대칭 암호화 | ARIA-128/192/256, AES-128/192/256 | DES, 3DES, RC4 |
| 비대칭 암호화 | RSA-2048+, ECDSA P-256/P-384 | RSA-1024 이하 |
| 해시 | SHA-256, SHA-384, SHA-512 | MD5, SHA-1 |
| 키 교환 | ECDH P-256+, DH-2048+ | DH-1024 이하 |

### N05 데이터 — AI API 연동 통제

→ 데이터 등급 분류 및 AI API 차단 구현 패턴: [`03-n2sf/csap-n2sf-mapping.md`](../csap-n2sf-mapping.md) (MTU-C4) 참조

| 처리 단계 | C 등급 | S 등급 | O 등급 |
|---------|--------|--------|--------|
| 수집 | 최소 수집 원칙 + 암호화 저장 | 최소 수집 원칙 | 일반 수집 |
| 처리 | 격리 환경 전용 | 내부망 전용 | 공개망 허용 |
| AI API | 금지 | 금지 | PII 마스킹 후 허용 |
| 폐기 | DoD 5220.22-M + 인증서 | 완전 삭제 + 기록 | 일반 삭제 |

### N06 운영 — 감사 로그 연계

```typescript
// N2SF N-06 + CSAP D12-03 감사 로그 (audit.jsonl append-only)
interface AuditEntry {
  timestamp: string       // ISO 8601
  actor: string           // 사용자 ID
  action: string          // 수행 작업
  resource: string        // 대상 리소스
  dataGrade: DataGrade    // C/S/O 등급
  n2sfDomain: string      // 관련 N2SF 영역
  csapControl: string     // 관련 CSAP ID
  result: 'SUCCESS' | 'FAILURE' | 'BLOCKED'
  ip: string
}
```

---

## CSAP 통제항목 역참조 요약

| N2SF 영역 | CSAP 역참조 항목 |
|---------|--------------|
| N01 관리적 보안 | CSAP-D01-01~04, CSAP-D02-01~03, CSAP-D03-01~04 |
| N02 인증 | CSAP-D08-01~12 전수 |
| N03 격리 | CSAP-D10-01~03, CSAP-D08-08, CSAP-D08-10 |
| N04 암호화 | CSAP-D09-01~04 전수 |
| N05 데이터 | CSAP-D04-01~05, CSAP-D13-01~04 |
| N06 운영 | CSAP-D06-01~05, CSAP-D07-01~03, CSAP-D12-01~08 |

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-3.3 | N01~N06 전수 구현 가이드 | 6개 파일, 각 영역 통제 요건 완비 |
| FR-3.4 | C/S/O 등급별 요건 명시 | 각 파일 3등급 비교 테이블 포함 |
| FR-3.5 | CSAP 통제항목 역참조 | 각 파일 CSAP-DXX-YY 역참조 링크 완비 |
| FR-3.5a | N03 MLS 전환 로드맵 | N2SF MLS 2026 도입 대비 아키텍처 포함 |
| FR-3.5b | N03 격리 k8s 패턴 | NetworkPolicy YAML 예시 포함 |

---

## 합격 기준

1. N01~N06 6개 영역 전수 구현 가이드 파일 생성
2. 각 파일에 C/S/O 3등급 비교 테이블 포함
3. N03 격리 파일: C 등급 물리 격리 + O 등급 MLS 전환 로드맵 포함
4. 각 파일에 해당 영역 관련 CSAP 통제항목 역참조 완비
5. N05 파일에서 MTU-C4 (`data-grade-classification.md`) 참조 링크
6. N03 파일에 k8s NetworkPolicy YAML 예시 포함
7. Auditor 에이전트 Q-GATE G6 통과

---

## 테스트 시나리오

**TS-C5-01**: 보안 담당자가 N03 파일만으로 C 등급 데이터 격리 아키텍처 구성 방법 확인 가능
**TS-C5-02**: 개발자가 N05 파일에서 데이터 등급별 AI API 연동 가능 여부 5분 이내 판단 가능
**TS-C5-03**: 감사관이 N06 파일 기반 audit.jsonl 구조 확인 후 증거 자료 제출 절차 파악 가능

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 — N2SF 6개 영역 구현 가이드 + MLS 전환 로드맵 설계 | Claude Code |
