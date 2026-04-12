# SVC-AI-ADV-R105 — Multi-Tenant Model Fine-tuner (Design)

> 작성일: 2026-04-12 | 버전: 2.0.0 (재작성)

## 1. 아키텍처 옵션

- **Option A**: 테넌트별 물리적 격리 파일시스템 — WSL2 환경에서 제약
- **Option B (선정)**: 인메모리 Map<tenantId, VersionHistory> + 모든 API에서 tenantId 강제 검증
- **Option C**: 공유 저장소 + ACL — 엔진이 직접 수행 불가

## 2. 구성 요소

```typescript
type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

interface FineTuneJob {
  jobId: string
  tenantId: string
  baseModel: string
  datasetHash: string
  status: JobStatus
  submittedAt: string
  modelVersionTag?: string
}

interface ModelVersion {
  versionTag: string
  tenantId: string
  baseModel: string
  datasetHash: string
  createdAt: string
  isActive: boolean
}
```

## 3. 동작 규칙

- `submitFineTuneJob`: O등급 외 차단. jobId UUID 자동 생성.
- `updateJobStatus('succeeded')`: modelVersionTag 필수, 버전 히스토리에 추가 (isActive=false)
- `promoteVersion`: 현재 활성 버전 → inactive 후 새 활성 전환
- `rollback`: 직전 비활성 버전 중 최신 찾아 활성화
- 모든 호출에서 `tenantId` 일치 확인 (교차 접근 시 BLOCKED)

## 4. Design Anchor

- **CSAP D-06**: 모든 단계 감사 로그
- **N2SF N-05**: dataGrade guard
- **테넌트 격리**: 필수
