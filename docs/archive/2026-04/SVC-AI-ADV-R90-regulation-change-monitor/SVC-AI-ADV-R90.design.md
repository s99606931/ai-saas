# SVC-AI-ADV-R90 Design — Regulation Change Monitor

> 버전: 1.0.0 | 2026-04-12 | Plan Ref: SVC-AI-ADV-R90.plan.md §FR-R90.1~7

## Design Anchor

- **목적**: 공공 법령 변경을 자동 탐지하고 서비스 영향도를 LLM으로 분류
- **기술**: TypeScript strict, fetch(폴링), 해시 기반 diff, LLM 프롬프트
- **Pragmatic Balance**: 외부 API mock 친화 설계, 순수 함수 중심, 의존성 주입

## 아키텍처 (Pragmatic Balance 선택)

```
┌──────────────────┐   ┌──────────────┐   ┌──────────────┐
│ RegulationPoller │──▶│ DiffDetector │──▶│ ImpactAnlyzr │
└──────────────────┘   └──────────────┘   └──────┬───────┘
                                                  │
                    ┌─────────────────────────────┤
                    ▼                             ▼
           ┌─────────────┐                ┌──────────────┐
           │ ChangeLedger │                │ ServiceMapper │
           └──────┬──────┘                └──────┬───────┘
                  │                              │
                  └─────────────┬────────────────┘
                                ▼
                        ┌──────────────┐
                        │ AlertRouter  │
                        └──────────────┘
```

### 핵심 타입 (Session Guide)

```ts
export type RegulationGrade = 'LAW' | 'DECREE' | 'RULE' | 'NOTICE'

export interface RegulationDocument {
  id: string
  title: string
  grade: RegulationGrade
  effectiveDate: string
  bodyHash: string
  url: string
}

export interface RegulationChange {
  docId: string
  changeType: 'ADDED' | 'MODIFIED' | 'REMOVED'
  prevHash: string | null
  nextHash: string | null
  detectedAt: string
}

export type ImpactLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface ImpactAssessment {
  change: RegulationChange
  level: ImpactLevel
  rationale: string
  affectedServices: string[]
  complianceTags: string[] // e.g. 'CSAP-D08', 'N2SF-N05'
}
```

### 컴포넌트 책임

| 클래스 | 책임 | 순수성 |
|--------|------|--------|
| `RegulationPoller` | HTTP 폴링 + 백오프 | IO |
| `DiffDetector` | 이전 스냅샷 ↔ 현재 비교 | 순수 |
| `ImpactAnalyzer` | LLM 호출 + 파싱 | IO (주입된 llmCall) |
| `ServiceMapper` | 키워드→서비스 정적 매핑 | 순수 |
| `ChangeLedger` | append-only 이력 | IO (주입된 storage) |
| `AlertRouter` | 채널별 알림 분배 | IO (주입된 채널) |

### 알고리즘: DiffDetector

1. 이전 스냅샷 Map<id, hash>
2. 현재 Doc[] 순회
   - prev에 없으면 ADDED
   - hash 다르면 MODIFIED
3. prev에만 있는 id는 REMOVED

### 알고리즘: ImpactAnalyzer 프롬프트 (O등급 데이터)

```
입력: 법령 제목 + 변경 유형 + 본문 요약 (공개 법령, 마스킹 불필요)
출력: JSON { level, rationale, affectedServices[], complianceTags[] }
가드: JSON 파싱 실패 시 LOW로 안전 기본값 (False Negative 방지용 로그)
```

### N2SF/CSAP 준수 체크

- ✅ N2SF N-05: 국가법령정보센터는 O등급 공공 데이터 → AI 전송 허용
- ✅ CSAP D-06: ChangeLedger append-only (수정 불가)
- ✅ 하드코딩 시크릿 없음 (API key는 생성자 주입)

### 테스트 전략 (G4)

- DiffDetector: 4개 케이스 (추가/수정/삭제/변경없음)
- ImpactAnalyzer: mock LLM → JSON 파싱 성공/실패
- ServiceMapper: 키워드 매칭 정확성
- ChangeLedger: append만 허용, 수정 거부
- 통합: Poller → Analyzer → Router end-to-end

## 변경 이력

| 버전 | 일자 | 내용 |
|------|------|------|
| 1.0.0 | 2026-04-12 | 최초 작성 |
