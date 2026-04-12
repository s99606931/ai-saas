# Design: MTU-N248 운영 자동화 고도화

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead (infra-architect)

---

## Design Anchor

| 항목 | 값 |
|------|---|
| 의존성 관리 | Renovate Bot (그룹화 + 자동 병합) |
| 버전 관리 | Semantic Release (Conventional Commits) |
| DR | Velero 백업 + k3s 페일오버 시뮬레이션 |
| 런북 | Bash 스크립트 자동화 |

---

## S3. 상세 설계

### S3.1 Renovate 그룹화 전략 (FR-N248.1, FR-N248.2)

```json5
{
  "packageRules": [
    {
      "groupName": "보안 패치",
      "matchUpdateTypes": ["patch"],
      "matchCategories": ["security"],
      "automerge": true,      // 보안 패치 자동 병합
      "schedule": ["every weekday"]
    },
    {
      "groupName": "일반 의존성",
      "matchUpdateTypes": ["minor", "patch"],
      "schedule": ["on monday"]
    },
    {
      "groupName": "주요 업데이트",
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "labels": ["breaking-change"]
    }
  ]
}
```

### S3.2 DR 자동 검증 (FR-N248.4)

```
DR 시뮬레이션 흐름:
1. Velero 백업 상태 확인
2. 핵심 서비스 헬스체크
3. 데이터베이스 복원 시뮬레이션 (dry-run)
4. DNS 페일오버 시뮬레이션
5. 결과 보고 + 감사 로그
```

### S3.3 운영 런북 (FR-N248.5)

자주 발생하는 장애 시나리오별 자동화:
- Pod CrashLoopBackOff 대응
- 디스크 사용량 90%+ 대응
- 인증서 만료 대응
- 데이터베이스 연결 고갈 대응

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 최초 설계 | PM Lead (infra-architect) |
