import { supabase } from './supabase';
import type { Json } from '@/types/database';

export type NotificationType = 'instrumental_review' | 'admin_notice';

export interface AppNotification {
  id: string;
  recipient_user_id: string;
  created_by: string | null;
  type: NotificationType;
  notice_group_id: string | null;
  title: string;
  message: string;
  link_path: string | null;
  read_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  metadata: Json;
  created_at: string;
}

export async function fetchCurrentUserNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false });
  return { data: (data as AppNotification[] | null) ?? [], error };
}

export async function fetchCurrentUserUnreadNotificationCount() {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .is('read_at', null)
    ;

  return { count: count ?? 0, error };
}

export async function markNotificationAsRead(notificationId: string) {
  return supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null);
}
