# ISMS-P 보호 분야: P-30~P-44 네트워크 보안, 시스템 개발, 취약점 관리

> MTU-C6b | FR-2.4-P | 적용 기준일: 2026-04-05
> 참조: CSAP D-10 (네트워크 8항목), D-12 (시스템 개발 10항목)

---

## 개요

ISMS-P 보호대책 요구사항 중 네트워크 보안, 시스템 개발 보안, 취약점 관리 분야 15개 항목입니다.
방화벽 정책, SAST/DAST, 패치 관리, 시큐어 코딩을 다룹니다.

---

## 항목별 구현 가이드

### ISMS-P-P-30: 네트워크 영역 분리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-30 |
| 요구사항 | DMZ·내부·DB 영역 네트워크 분리 |
| 핵심 요건 | 영역별 방화벽 정책, NetworkPolicy deny-all 기본, 허용 최소 포트만 개방 |
| CSAP 중첩 | CSAP-D10-01 (네트워크 분리) |
| k3s 패턴 | 네임스페이스 기반 NetworkPolicy + kube-router |

---

### ISMS-P-P-31: 방화벽 관리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-31 |
| 요구사항 | 방화벽 정책 관리 |
| 핵심 요건 | 방화벽 룰 문서화, 분기별 정책 검토, 불필요 룰 제거, 변경 이력 기록 |
| CSAP 중첩 | CSAP-D10-02 (방화벽 정책) |

---

### ISMS-P-P-32: 침입 탐지/방지

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-32 |
| 요구사항 | IDS/IPS 운영 |
| 핵심 요건 | 침입 탐지 규칙 갱신, 탐지 이벤트 실시간 모니터링, 오탐 관리 |
| CSAP 중첩 | CSAP-D10-03 (침입 탐지) |
| k3s 패턴 | Falco (런타임 이상 탐지) + NetworkPolicy 차단 |

---

### ISMS-P-P-33: 보안 로그 수집

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-33 |
| 요구사항 | 보안 이벤트 로그 중앙 수집 |
| 핵심 요건 | 서버·네트워크·DB 로그 중앙 수집, 6개월 보관, 무결성 보장 |
| CSAP 중첩 | CSAP-D10-04 (보안 모니터링) |
| k3s 패턴 | OpenTelemetry Collector → Loki (MTU-I4 연계) |

---

### ISMS-P-P-34: 무선 네트워크 보안

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-34 |
| 요구사항 | 무선 네트워크 접근 통제 |
| 핵심 요건 | WPA3 필수, 인가된 AP만 허용, 비인가 AP 탐지 |
| CSAP 중첩 | CSAP-D10-05 (무선 보안) |

---

### ISMS-P-P-35: 시큐어 코딩

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-35 |
| 요구사항 | 안전한 소프트웨어 개발 |
| 핵심 요건 | OWASP Top 10 대응, 입력 검증 (Zod), SQL 주입 방지, XSS 방지 |
| CSAP 중첩 | CSAP-D12-01 (시큐어 코딩) |

**구현 예시**:
```typescript
import { z } from 'zod'
import DOMPurify from 'dompurify'

// 입력 검증 (SQL 주입, XSS 방지)
const userInputSchema = z.object({
  name: z.string().min(1).max(100).transform(v => DOMPurify.sanitize(v)),
  email: z.string().email(),
  comment: z.string().max(1000).transform(v => DOMPurify.sanitize(v)),
})

// 매개변수화 쿼리 필수
const user = await db.execute(
  'SELECT * FROM users WHERE email = $1 AND org_id = $2',
  [validated.email, orgId]
)
```

---

### ISMS-P-P-36: 소프트웨어 테스트

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-36 |
| 요구사항 | 보안 테스트 수행 |
| 핵심 요건 | 단위·통합·보안 테스트 수행, 커버리지 80% 이상, 보안 테스트 결과 기록 |
| CSAP 중첩 | CSAP-D12-02 (소프트웨어 시험) |

---

### ISMS-P-P-37: 코드 리뷰

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-37 |
| 요구사항 | 소스코드 보안 검토 |
| 핵심 요건 | PR 필수 코드리뷰, Reviewer 에이전트 AgentShield 102규칙, 보안 취약점 미해결 병합 금지 |
| CSAP 중첩 | CSAP-D12-03 (코드 검토) |

---

### ISMS-P-P-38: SAST/DAST

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-38 |
| 요구사항 | 정적·동적 분석 도구 적용 |
| 핵심 요건 | CI/CD 파이프라인 SAST (ESLint security, Trivy), DAST (OWASP ZAP) 자동 실행 |
| CSAP 중첩 | CSAP-D12-04 (보안 점검) |

**Gitea Actions 연동**:
```yaml
- name: SAST - Trivy 파일시스템 스캔 (ISMS-P-P-38)
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    severity: 'HIGH,CRITICAL'
    exit-code: '1'
```

---

### ISMS-P-P-39: 오픈소스 보안

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-39 |
| 요구사항 | 오픈소스 컴포넌트 보안 관리 |
| 핵심 요건 | SBOM 생성·관리, 취약 라이브러리 탐지, 라이선스 검토 |
| CSAP 중첩 | CSAP-D12-05 (오픈소스 관리), MTU-C8 Supply Chain 연계 |

---

### ISMS-P-P-40: 환경 분리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-40 |
| 요구사항 | 개발·테스트·운영 환경 분리 |
| 핵심 요건 | 운영 데이터 개발환경 사용 금지, 환경별 독립 접근 통제, 배포 승인 절차 |
| CSAP 중첩 | CSAP-D12-06 (환경 분리) |

---

### ISMS-P-P-41: 변경 관리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-41 |
| 요구사항 | 시스템 변경 관리 절차 |
| 핵심 요건 | 변경 요청·승인·실행·검증 절차, 긴급 변경 사후 승인, 변경 이력 기록 |
| CSAP 중첩 | CSAP-D12-07 (변경 관리) |

---

### ISMS-P-P-42: 취약점 점검

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-42 |
| 요구사항 | 정기 취약점 점검 수행 |
| 핵심 요건 | 분기 1회 취약점 점검, 발견 취약점 30일 이내 조치, 조치 완료 재검증 |
| CSAP 중첩 | CSAP-D12-08 (취약점 관리) |

---

### ISMS-P-P-43: 패치 관리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-43 |
| 요구사항 | 보안 패치 적시 적용 |
| 핵심 요건 | CRITICAL 패치 72시간 이내, HIGH 7일, MEDIUM 30일 이내 적용, 패치 이력 기록 |
| CSAP 중첩 | CSAP-D12-09 (패치 관리) |

---

### ISMS-P-P-44: 보안 형상 관리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-44 |
| 요구사항 | 보안 설정 형상 관리 |
| 핵심 요건 | 보안 설정 베이스라인 정의, 형상 변경 감지, CIS Benchmark 적용 |
| CSAP 중첩 | CSAP-D12-10 (형상 관리) |
| k3s 패턴 | Kyverno 정책으로 형상 강제 (MTU-C7 연계) |

---

## CSAP 교차 참조 요약

| ISMS-P 항목 | CSAP 매핑 | 비고 |
|-------------|----------|------|
| ISMS-P-P-30~34 | CSAP-D10-01~05 | 네트워크 보안 완전/부분 중복 |
| ISMS-P-P-35~44 | CSAP-D12-01~10 | 시스템 개발 보안 완전 중복 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-C6b Do — 네트워크·개발·취약점 15항목 전수 작성 | Implementer Agent |
