# SVC-AI-ADV-R107 — Semantic Version Control for Prompts (Design)

> 작성일: 2026-04-12 | 버전: 2.0.0 (재작성)

## 1. 구성

```typescript
type BumpType = 'major' | 'minor' | 'patch'

interface SemVer {
  major: number
  minor: number
  patch: number
}

interface PromptCommit {
  name: string
  version: SemVer
  versionString: string
  template: string
  message?: string
  committedAt: string
  isActive: boolean
}

interface DiffLine {
  type: ' ' | '+' | '-'
  line: string
}
```

## 2. 동작

### §2.1 commit

- 최초 커밋: 1.0.0
- bumpType에 따라 major/minor/patch 증가
- 신규 커밋은 isActive=true (이전 커밋 비활성)
- 시크릿 패턴 차단: `sk-`, `AKIA`, 20+길이 hex 등

### §2.2 diff

- Myers 간소화 대신 공통 프리픽스/서픽스 + 나머지 `-`/`+`
- 또는 줄 단위 LCS (여기서는 단순 Hunnel: 공통 구간 뺀 차이)
- 실용: 라인 분리 후 같은 라인은 ' ', 다른 라인은 `-` (A) / `+` (B) 순서

### §2.3 rollback

- 활성 히스토리 중 직전 활성 버전 탐색 (activationSeq 기반)
- 없으면 null

## 3. Design Anchor

- CSAP D-06 감사
- 보안: 시크릿 정규식 차단
