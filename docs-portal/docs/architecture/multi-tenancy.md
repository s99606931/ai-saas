---
sidebar_position: 2
---

# 멀티테넌시

## 테넌트 격리 모델

각 공공기관은 독립된 테넌트로 운영됩니다. 데이터는 Row-Level Security(RLS) 기반으로 격리합니다.

## RBAC 권한 모델

| 역할 | 권한 | 범위 |
|------|------|------|
| system-admin | 전체 관리 | 전체 시스템 |
| tenant-admin | 기관 관리 | 소속 테넌트 |
| user | 일반 사용 | 소속 테넌트 |
| viewer | 읽기 전용 | 소속 테넌트 |
