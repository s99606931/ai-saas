// 서비스 카탈로그 관리 -- FR-N361.1~FR-N361.4
// Design Ref: MTU-N361 | CSAP: D-06, D-08

export interface CatalogItem { readonly itemId: string; readonly name: string; readonly category: string; readonly description: string; readonly tier: 'free' | 'basic' | 'premium'; readonly price: number; readonly active: boolean; }
export interface Subscription { readonly subId: string; readonly tenantId: string; readonly itemId: string; readonly status: 'active' | 'cancelled' | 'expired'; readonly subscribedAt: string; }
export interface CatalogAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: CatalogAuditEntry[] = [];
function recordAudit(entry: Omit<CatalogAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getCatalogAuditLog(tenantId: string): readonly CatalogAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const catalogStore: CatalogItem[] = [];
const subscriptionStore: Subscription[] = [];

export function registerCatalogItem(name: string, category: string, description: string, tier: CatalogItem['tier'], price: number): CatalogItem {
  const item: CatalogItem = { itemId: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, category, description, tier, price, active: true };
  catalogStore.push(item);
  return item;
}

export function searchCatalog(query: string, category?: string): readonly CatalogItem[] {
  const lower = query.toLowerCase();
  return catalogStore.filter(i => i.active && i.name.toLowerCase().includes(lower) && (!category || i.category === category));
}

export function subscribe(tenantId: string, itemId: string): Subscription {
  const sub: Subscription = { subId: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tenantId, itemId, status: 'active', subscribedAt: new Date().toISOString() };
  subscriptionStore.push(sub);
  recordAudit({ actor: 'system', tenantId, action: 'SERVICE_SUBSCRIBED', target: itemId, details: { subId: sub.subId } });
  return sub;
}

export function getSubscriptions(tenantId: string): readonly Subscription[] { return subscriptionStore.filter(s => s.tenantId === tenantId); }

export class ServiceCatalogManagerService {
  constructor(private readonly tenantId: string) {}
  register(name: string, cat: string, desc: string, tier: CatalogItem['tier'], price: number): CatalogItem { return registerCatalogItem(name, cat, desc, tier, price); }
  search(query: string, cat?: string): readonly CatalogItem[] { return searchCatalog(query, cat); }
  subscribe(itemId: string): Subscription { return subscribe(this.tenantId, itemId); }
  subscriptions(): readonly Subscription[] { return getSubscriptions(this.tenantId); }
  getAuditLog(): readonly CatalogAuditEntry[] { return getCatalogAuditLog(this.tenantId); }
}
