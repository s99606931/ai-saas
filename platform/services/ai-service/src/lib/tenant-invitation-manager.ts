// 테넌트 초대/온보딩 관리 -- FR-N360.1~FR-N360.4
// Design Ref: MTU-N360 | CSAP: D-06, D-08

export interface Invitation { readonly inviteId: string; readonly tenantId: string; readonly email: string; readonly role: string; readonly status: 'pending' | 'accepted' | 'declined' | 'expired'; readonly token: string; readonly expiresAt: string; readonly createdAt: string; }
export interface OnboardingChecklist { readonly tenantId: string; readonly userId: string; readonly steps: readonly OnboardingStep[]; readonly completionRate: number; }
export interface OnboardingStep { readonly stepId: string; readonly title: string; readonly completed: boolean; }
export interface InviteAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: InviteAuditEntry[] = [];
function recordAudit(entry: Omit<InviteAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getInviteAuditLog(tenantId: string): readonly InviteAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const inviteStore: Map<string, Invitation[]> = new Map();

export function createInvitation(tenantId: string, email: string, role: string, expiryHours: number = 48): Invitation {
  const token = Math.random().toString(36).slice(2, 18) + Math.random().toString(36).slice(2, 18);
  const invite: Invitation = { inviteId: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tenantId, email, role, status: 'pending', token, expiresAt: new Date(Date.now() + expiryHours * 3600000).toISOString(), createdAt: new Date().toISOString() };
  const existing = inviteStore.get(tenantId) ?? [];
  existing.push(invite);
  inviteStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'INVITATION_CREATED', target: invite.inviteId, details: { email, role } });
  return invite;
}

export function acceptInvitation(tenantId: string, token: string): Invitation | null {
  const invites = inviteStore.get(tenantId) ?? [];
  const idx = invites.findIndex(i => i.token === token && i.status === 'pending');
  if (idx < 0) return null;
  const inv = invites[idx]!;
  if (new Date(inv.expiresAt) < new Date()) { invites[idx] = { ...inv, status: 'expired' }; return null; }
  const accepted = { ...inv, status: 'accepted' as const };
  invites[idx] = accepted;
  recordAudit({ actor: inv.email, tenantId, action: 'INVITATION_ACCEPTED', target: inv.inviteId, details: {} });
  return accepted;
}

export function getInvitations(tenantId: string): readonly Invitation[] { return inviteStore.get(tenantId) ?? []; }

const DEFAULT_STEPS: Omit<OnboardingStep, 'stepId'>[] = [
  { title: '프로필 설정', completed: false },
  { title: '보안 설정 (MFA)', completed: false },
  { title: '서비스 둘러보기', completed: false },
  { title: '첫 작업 완료', completed: false },
];

export function createOnboarding(tenantId: string, userId: string): OnboardingChecklist {
  const steps = DEFAULT_STEPS.map((s, i) => ({ stepId: `ob-${i + 1}`, ...s }));
  return { tenantId, userId, steps, completionRate: 0 };
}

export function completeStep(checklist: OnboardingChecklist, stepId: string): OnboardingChecklist {
  const steps = checklist.steps.map(s => s.stepId === stepId ? { ...s, completed: true } : s);
  const done = steps.filter(s => s.completed).length;
  return { ...checklist, steps, completionRate: steps.length > 0 ? done / steps.length : 0 };
}

export class TenantInvitationManagerService {
  constructor(private readonly tenantId: string) {}
  invite(email: string, role: string, expiry?: number): Invitation { return createInvitation(this.tenantId, email, role, expiry); }
  accept(token: string): Invitation | null { return acceptInvitation(this.tenantId, token); }
  list(): readonly Invitation[] { return getInvitations(this.tenantId); }
  onboard(userId: string): OnboardingChecklist { return createOnboarding(this.tenantId, userId); }
  getAuditLog(): readonly InviteAuditEntry[] { return getInviteAuditLog(this.tenantId); }
}
