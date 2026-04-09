# N05 데이터 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | N2SF-N05-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| N2SF 영역 | N05 데이터 |
| 대상 독자 | 개발자, 데이터 관리자, 보안 담당자 |
| FR 매핑 | FR-3.3, FR-3.4, FR-3.5 |
| MTU 매핑 | MTU-C5 |

<!-- Design Ref: MTU-C5 Plan -- N05 데이터 -->
<!-- Plan SC: 데이터 등급별 AI API 연동 통제, MTU-C4 연계 -->

---

## 1. 영역 개요

N05 데이터 영역은 데이터의 수집, 분류, 처리, 저장, 전송, 폐기 전 생명 주기를 관리합니다.
특히 AI/LLM API 연동 시 데이터 등급별 통제가 핵심이며, CSAP D04(자산 관리), D13(공공기관 추가 요건)과 직접 대응됩니다.

### 핵심 원칙

- **데이터 등급 분류 의무**: 모든 데이터는 C/S/O 등급 분류 후 처리
- **AI API 차단 원칙**: C/S 등급 데이터는 외부 AI API 전송 절대 금지
- **PII 마스킹 필수**: O 등급도 개인정보 포함 시 반드시 마스킹 후 전송
- **데이터 주권**: 국내 저장 원칙 (해외 서버 저장 금지, 예외: O 등급 AI API 처리)

---

## 2. C/S/O 등급별 데이터 처리 요건

| 처리 단계 | C 등급 (기밀) | S 등급 (민감) | O 등급 (공개) |
|---------|-------------|-------------|-------------|
| 수집 | 최소 수집 원칙 + 즉시 암호화 저장 | 최소 수집 원칙 + 암호화 | 일반 수집 |
| 분류 | 수집 즉시 C 등급 레이블 부착 | 수집 즉시 S 등급 레이블 | 기본 O 등급 |
| 처리 | 격리 환경 전용 (에어갭) | 내부망 전용 | 공개망 허용 |
| 저장 | AES-256-GCM + 전용 HSM + 별도 스토리지 | AES-256-GCM + Sealed Secrets | 표준 암호화 |
| 전송 | 내부 전용 (외부 전송 금지) | 내부망 전용 (mTLS) | TLS 1.2+ (외부 허용) |
| AI API | 절대 금지 (온프레미스 LM Studio만) | 절대 금지 (온프레미스만) | PII 마스킹 후 허용 |
| 백업 | 암호화 백업 + 격리 보관 | 암호화 백업 | 표준 백업 |
| 폐기 | DoD 5220.22-M 3회 덮어쓰기 + 폐기 인증서 | 완전 삭제 + 기록 | 일반 삭제 |
| 보관 기한 | 법정 보존 기간 + 영구 보관 검토 | 법정 보존 기간 | 최소 1년 |

---

## 3. AI API 연동 통제 (핵심)

### 데이터 등급별 AI 라우팅 판단

> 상세 분류 기준: [데이터 등급 분류 체계](../data-grade-classification.md) (MTU-C4) 참조

```
사용자 요청 (AI 기능 호출)
         │
         ▼
┌────────────────────────┐
│ 1. 데이터 등급 분류      │ ◀── MTU-C4 classifyData()
│    (C / S / O ?)        │
└────────────┬───────────┘
             │
       ┌─────┴──────┐
       │            │
       ▼            ▼
   C 또는 S       O 등급
    등급            │
       │            ▼
       │     ┌──────────────────┐
       │     │ 2. PII 포함 여부   │
       │     │    검사            │
       │     └──────┬───────────┘
       │            │
       │      ┌─────┴──────┐
       │      │            │
       │    PII 있음     PII 없음
       │      │            │
       │      ▼            │
       │   ┌──────────┐   │
       │   │ 3. PII   │   │
       │   │ 마스킹    │   │
       │   └────┬─────┘   │
       │        │          │
       │        ▼          ▼
       │     ┌────────────────────┐
       │     │ 4. Claude API 호출  │
       │     │ (Anthropic 외부 API)│
       │     │ N2SF N05 허용 경로  │
       │     └────────────────────┘
       │
       ▼
┌─────────────────────────┐
│ 온프레미스 LM Studio     │
│ (WSL2 내부)              │
│ - Llama 3.1 8B          │
│ - 외부 전송 없음         │
│ - N2SF N03 격리 적용     │
└─────────────────────────┘
```

### AI API 차단 구현 패턴

```typescript
// N05 데이터 영역: AI API 연동 통제
// CSAP-D13-01 (데이터 주권) + N2SF N-05

import { DataGrade, classifyData } from '@/lib/data-classification'  // MTU-C4
import { maskPII } from '@/lib/pii-masker'
import { auditLog } from '@/lib/audit'

interface AIRouteResult {
  destination: 'LM_STUDIO' | 'CLAUDE_API'
  response: string
  masked: boolean
}

async function routeToAI(
  prompt: string,
  contextData: unknown,
  userId: string
): Promise<AIRouteResult> {
  // 1단계: 데이터 등급 자동 분류 (MTU-C4)
  const grade = classifyData(contextData)

  // 2단계: C/S 등급 → 외부 AI API 절대 차단
  if (grade === DataGrade.C || grade === DataGrade.S) {
    await auditLog({
      actor: userId,
      action: 'AI_ROUTE_LOCAL',
      target: 'LM_STUDIO',
      dataGrade: grade,
      n2sfDomain: 'N05',
      csapControl: 'D13-01',
      result: 'SUCCESS',
    })

    const response = await lmStudioClient.complete({
      prompt,
      model: 'llama-3.1-8b',
    })

    return { destination: 'LM_STUDIO', response, masked: false }
  }

  // 3단계: O 등급 → PII 검사 + 마스킹 후 외부 AI API 허용
  if (grade === DataGrade.O) {
    const { maskedText, piiFound } = await maskPII(prompt)

    await auditLog({
      actor: userId,
      action: 'AI_ROUTE_EXTERNAL',
      target: 'CLAUDE_API',
      dataGrade: grade,
      n2sfDomain: 'N05',
      csapControl: 'D13-01',
      result: 'SUCCESS',
      metadata: { piiMasked: piiFound },
    })

    const response = await claudeApiClient.complete({
      prompt: maskedText,
    })

    return { destination: 'CLAUDE_API', response, masked: piiFound }
  }

  // 미분류 데이터 → 차단 (fail-safe)
  throw new Error('데이터 등급 미분류 — AI 라우팅 차단 (N2SF N-05)')
}
```

### PII 마스킹 패턴

```typescript
// PII 마스킹 — O 등급 데이터의 AI API 전송 전 필수 처리
interface MaskResult {
  maskedText: string
  piiFound: boolean
  maskedFields: string[]
}

// 마스킹 대상 패턴 (한국 기준)
// H-02 수정 (2026-04-05): g 플래그 제거 — pattern.test() + replace() 혼용 시
// g 플래그와 lastIndex 이동으로 첫 매칭을 건너뛰는 버그 방지 (N2SF N-05 위반 수정)
// 전역 교체는 replace() 내부에서 새 RegExp 객체를 생성하여 처리
const PII_PATTERNS: Record<string, RegExp | null> = {
  주민등록번호: /\d{6}[-]\d{7}/,
  휴대전화: /01[0-9][-]?\d{3,4}[-]?\d{4}/,
  이메일: /[\w.+-]+@[\w-]+\.[\w.]+/,
  계좌번호: /\d{3,4}[-]\d{2,6}[-]\d{2,6}/,
  카드번호: /\d{4}[-]?\d{4}[-]?\d{4}[-]?\d{4}/,
  이름: null,   // NER 모델 사용 (규칙 기반 불가)
}

async function maskPII(text: string): Promise<MaskResult> {
  let maskedText = text
  const maskedFields: string[] = []

  for (const [field, pattern] of Object.entries(PII_PATTERNS)) {
    if (pattern === null) continue
    // 매 반복마다 g 플래그를 적용한 새 RegExp를 생성하여 lastIndex 누적 방지
    const globalPattern = new RegExp(pattern.source, 'g')
    if (globalPattern.test(maskedText)) {
      // replace()에도 새 RegExp 생성 — test()로 소비된 lastIndex와 무관하게 동작
      maskedText = maskedText.replace(new RegExp(pattern.source, 'g'), `[${field}_MASKED]`)
      maskedFields.push(field)
    }
  }

  return {
    maskedText,
    piiFound: maskedFields.length > 0,
    maskedFields,
  }
}
```

---

## 4. CSAP 통제항목 역참조

| CSAP ID | 항목명 | N05 구현 요건 | 증적 |
|---------|--------|------------|------|
| [CSAP-D04-01](../../02-csap/standard-grade/implementation-guide/D04-asset.md#csap-d04-01) | 정보 자산 식별 | 데이터 자산 목록 + 등급 분류 | 자산 대장 |
| [CSAP-D04-02](../../02-csap/standard-grade/implementation-guide/D04-asset.md#csap-d04-02) | 정보 자산 분류 | C/S/O 등급 분류 기준 수립 | 분류 기준서 |
| [CSAP-D04-03](../../02-csap/standard-grade/implementation-guide/D04-asset.md#csap-d04-03) | 정보 자산 관리 | 등급별 처리·저장·전송 규칙 | 관리 규정 |
| [CSAP-D04-04](../../02-csap/standard-grade/implementation-guide/D04-asset.md#csap-d04-04) | 정보 자산 폐기 | 등급별 안전한 폐기 절차 | 폐기 확인서 |
| [CSAP-D04-05](../../02-csap/standard-grade/implementation-guide/D04-asset.md#csap-d04-05) | 매체 관리 | 이동식 매체 반출입 통제 | 반출입 대장 |
| [CSAP-D13-01](../../02-csap/standard-grade/implementation-guide/D13-public-sector.md#csap-d13-01) | 데이터 주권 | 국내 저장, 해외 전송 통제 | 데이터 흐름도 |
| [CSAP-D13-02](../../02-csap/standard-grade/implementation-guide/D13-public-sector.md#csap-d13-02) | 개인정보 보호 | PII 마스킹, 수집 동의 | 동의서, 마스킹 로그 |
| [CSAP-D13-03](../../02-csap/standard-grade/implementation-guide/D13-public-sector.md#csap-d13-03) | 데이터 보존 | 법정 보존 기간 준수 | 보존 정책서 |
| [CSAP-D13-04](../../02-csap/standard-grade/implementation-guide/D13-public-sector.md#csap-d13-04) | 데이터 이동 통제 | 등급별 이동 경로 제한 | 이동 승인 기록 |

---

## 5. 데이터 생명 주기 관리

```
수집                분류              처리
━━━━━━━━━       ━━━━━━━━━       ━━━━━━━━━
최소 수집       →  C/S/O 등급    →  등급별 처리
동의 확보          자동 분류         격리/내부/공개
(D13-02)          (MTU-C4)          (N03 연계)
    │                │                 │
    ▼                ▼                 ▼
저장                전송              폐기
━━━━━━━━━       ━━━━━━━━━       ━━━━━━━━━
등급별 암호화   →  등급별 경로    →  등급별 삭제
(N04 연계)         TLS + mTLS        DoD/완전/일반
별도 스토리지      AI API 통제        폐기 인증서
(D09-01)          (N05 핵심)         (D04-04)
```

---

## 6. 데이터 폐기 절차

| 등급 | 폐기 방법 | 검증 | 증적 |
|------|---------|------|------|
| C 등급 | DoD 5220.22-M 3회 덮어쓰기 + 물리 파쇄 (SSD) | 폐기 완료 검증 도구 실행 | 폐기 인증서 + 사진 증빙 |
| S 등급 | 완전 삭제 (secure-delete) + 검증 | 삭제 후 복구 불가 확인 | 삭제 기록 + 검증 결과 |
| O 등급 | 일반 삭제 (rm) + 주기적 정리 | 삭제 확인 | 삭제 로그 |

```bash
# C 등급 안전한 파일 폐기 (DoD 5220.22-M)
shred -vfz -n 3 /data/classified/target-file.dat

# S 등급 안전한 파일 폐기
shred -vfz -n 1 /data/sensitive/target-file.dat

# 폐기 감사 로그 기록
cat >> /shared/audit.jsonl << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "actor": "$(whoami)",
  "action": "DATA_DESTRUCTION",
  "target": "/data/classified/target-file.dat",
  "dataGrade": "C",
  "n2sfDomain": "N05",
  "csapControl": "D04-04",
  "method": "DoD-5220.22-M-3pass",
  "result": "SUCCESS"
}
EOF
```

---

## 7. 증적 자료 체크리스트

| 번호 | 증적 자료 | 보관 주기 | 비고 |
|------|---------|---------|------|
| 1 | 데이터 자산 목록 + 등급 분류 | 최신 유지 | 분기 1회 갱신 |
| 2 | 데이터 등급 분류 기준서 | 영구 | MTU-C4 산출물 참조 |
| 3 | AI API 연동 로그 | 1년 | 라우팅 결정 + 마스킹 여부 |
| 4 | PII 마스킹 로그 | 1년 | 마스킹 대상 필드 기록 |
| 5 | 데이터 폐기 인증서 (C 등급) | 영구 | 물리 파쇄 사진 포함 |
| 6 | 데이터 이동 승인 기록 | 3년 | 등급 간 이동 시 |
| 7 | 개인정보 수집·이용 동의서 | 파기 후 3년 | 개인정보보호법 |

---

## 8. 관련 문서

- [데이터 등급 분류 체계](../data-grade-classification.md) (MTU-C4) -- 분류 기준 상세
- [CSAP x N2SF 전수 매핑 테이블](../csap-n2sf-mapping.md) (MTU-C4)
- [N03 격리 구현 가이드](./N03-isolation.md) (격리 아키텍처 연계)
- [N04 암호화 구현 가이드](./N04-encryption.md) (저장 암호화 연계)
- [N06 운영 구현 가이드](./N06-operations.md) (감사 로그 연계)
- [CSAP D04 자산 관리 구현 가이드](../../02-csap/standard-grade/implementation-guide/D04-asset.md)
- [CSAP D13 공공기관 추가 요건 구현 가이드](../../02-csap/standard-grade/implementation-guide/D13-public-sector.md)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.1 | 2026-04-05 | H-02 품질 검토 수정 — maskPII g 플래그+lastIndex 버그 수정 (N2SF N-05 위반 수정) | Implementer Agent |
| 1.0.0 | 2026-04-05 | 최초 작성 — N05 데이터 구현 가이드 (AI API 통제 + MTU-C4 연계) | Claude Code |
