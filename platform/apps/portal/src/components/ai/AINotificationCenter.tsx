// AI Notification Center — 개인화 알림 센터 — MTU-N553
// Design Ref: MTU-N242 예측 알림
// Plan SC: FR-UP.AI.3

'use client';

import { useState, useEffect, useCallback } from 'react';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  source: string;
}

interface AINotificationCenterProps {
  tenantId: string;
  userId: string;
  maxItems?: number;
}

const TYPE_COLORS = {
  info: 'var(--color-info)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
  success: 'var(--color-success)',
} as const;

export function AINotificationCenter({ tenantId, userId, maxItems = 50 }: AINotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = useCallback(async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';
      const res = await fetch(
        `${apiBase}/api/notifications?tenantId=${tenantId}&userId=${userId}&limit=${maxItems}`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as { data: { items: Notification[] } };
      setNotifications(json.data.items);
    } finally {
      setLoading(false);
    }
  }, [tenantId, userId, maxItems]);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';
    await fetch(`${apiBase}/api/notifications/${id}/read`, { method: 'POST' });
  }, []);

  const visible = notifications.filter((n) => filter === 'all' || !n.read);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      className="border rounded-lg overflow-hidden"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
      role="region"
      aria-label="AI 알림 센터"
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            알림 센터
          </span>
          {unreadCount > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--color-error)', color: '#fff' }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setFilter('all')}
            className="px-2 py-1 rounded"
            style={{
              backgroundColor: filter === 'all' ? 'var(--color-primary)' : 'transparent',
              color: filter === 'all' ? '#fff' : 'var(--color-text)',
            }}
          >
            전체
          </button>
          <button
            onClick={() => setFilter('unread')}
            className="px-2 py-1 rounded"
            style={{
              backgroundColor: filter === 'unread' ? 'var(--color-primary)' : 'transparent',
              color: filter === 'unread' ? '#fff' : 'var(--color-text)',
            }}
          >
            안읽음
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading && (
          <p className="p-4 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            로딩 중...
          </p>
        )}
        {!loading && visible.length === 0 && (
          <p className="p-4 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            알림이 없습니다.
          </p>
        )}
        {visible.map((n) => (
          <button
            key={n.id}
            onClick={() => markAsRead(n.id)}
            className="w-full text-left p-3 border-b hover:bg-black/5"
            style={{ borderColor: 'var(--color-border)', opacity: n.read ? 0.6 : 1 }}
          >
            <div className="flex items-start gap-2">
              <span
                className="inline-block w-2 h-2 rounded-full mt-1.5"
                style={{ backgroundColor: TYPE_COLORS[n.type] }}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                  {n.title}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {n.message}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {new Date(n.timestamp).toLocaleString('ko-KR')} · {n.source}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
