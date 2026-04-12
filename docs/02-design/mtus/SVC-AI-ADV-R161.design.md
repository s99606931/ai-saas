# Design — SVC-AI-ADV-R161 Prompt Version Registry

## 아키텍처 옵션

| 옵션 | 장점 | 단점 | 선택 |
|------|------|------|------|
| 인메모리 Map + 이력 | 단순 | 영속성 없음 | ★ Pragmatic (외부 저장소는 상위 레이어 책임) |
| DB 영속 | 영속성 | 구현 복잡 | - |

## 모듈 구조

```
prompt-version-registry.ts
├── PromptVersion { name, version, template, author, createdAt }
├── RegistryState { versions: Map<name, PromptVersion[]>, active: Map<name, string>, previousActive: Map<name, string> }
├── PromptVersionRegistry
│   ├── register(name, version, template, author, grade)
│   ├── activate(name, version)
│   ├── rollback(name)
│   ├── getActive(name), listVersions(name)
│   └── getAuditLog()
```

## 핵심 결정

- previousActive 는 직전 1개만 유지 (다중 롤백은 상위 책임)
- register 시 자동 activate 하지 않음 (명시적 activate 필요)
- 단, 최초 register 는 자동 activate

## Session Guide

- 파일 < 250 줄, 테스트 8+

## 추적성

- FR-R161.1~FR-R161.8 → 메서드 매핑
