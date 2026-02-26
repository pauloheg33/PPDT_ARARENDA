import { supabase } from './supabase';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOCK'
  | 'UNLOCK'
  | 'LOGIN'
  | 'IMPORT'
  | 'EXPORT';

export async function logAudit(
  action: AuditAction,
  entity: string,
  entityId: string,
  metadata?: Record<string, unknown>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from('audit_log').insert({
    action,
    entity,
    entity_id: entityId,
    actor_user_id: user.id,
    metadata: metadata ?? {},
  });
}
