# SVC-AI-ADV-R402 Design: Federated Identity Manager

## 토큰
- { issuer, expiry: ISO8601, subject, role }

## verify
- issuer ∈ trustedIssuers
- Date.parse(expiry) > now

## 권한 전파
- roleMapping: Map<sourceRole, targetRoles[]>
- 매핑 없으면 ['guest'] 반환

## 감사
- token.verify, permissions.propagate
