'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCircle2, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchCurrentUserNotifications,
  fetchCurrentUserUnreadNotificationCount,
  markNotificationAsRead,
  type AppNotification,
} from '@/lib/notifications';

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

export function NotificationBell() {
  const { profile } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const canReceiveNotifications = profile?.role === 'DT';

  async function refreshCount() {
    if (!canReceiveNotifications) return;
    const { count: unreadCount } = await fetchCurrentUserUnreadNotificationCount();
    setCount(unreadCount);
  }

  async function loadNotifications() {
    if (!canReceiveNotifications) return;
    setLoading(true);
    const { data } = await fetchCurrentUserNotifications();
    setNotifications(data);
    setLoading(false);
  }

  useEffect(() => {
    if (!canReceiveNotifications) return;
    refreshCount();
    const interval = setInterval(() => {
      refreshCount();
      if (open) {
        loadNotifications();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [canReceiveNotifications, open]);

  if (!canReceiveNotifications) return null;

  const handleOpenChange = async (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      await Promise.all([refreshCount(), loadNotifications()]);
    }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    await markNotificationAsRead(notification.id);
    await refreshCount();
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
      )
    );
    setOpen(false);

    if (notification.link_path) {
      router.push(notification.link_path);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => handleOpenChange(true)}
        title="Notificações"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Notificações</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando notificações...</p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma notificação disponível.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent ${
                    notification.read_at ? 'bg-background' : 'bg-primary/5 border-primary/30'
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {notification.type === 'instrumental_review' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Megaphone className="h-4 w-4 text-blue-600" />
                      )}
                      <p className="font-medium">{notification.title}</p>
                    </div>
                    {!notification.read_at && (
                      <Badge variant="secondary">Nova</Badge>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {notification.message}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatTimestamp(notification.created_at)}</span>
                    {notification.expires_at && (
                      <span>Válido até {formatTimestamp(notification.expires_at)}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
