'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Bell, Megaphone, Send, StopCircle } from 'lucide-react';

interface NoticeRow {
  id: string;
  notice_group_id: string | null;
  title: string;
  message: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  read_at: string | null;
  recipient_user_id: string;
}

interface NoticeGroup {
  groupId: string;
  title: string;
  message: string;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  recipientCount: number;
  readCount: number;
}

const DEFAULT_EXPIRY_DAYS = 7;

function buildDefaultExpiry() {
  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_EXPIRY_DAYS);
  date.setHours(18, 0, 0, 0);

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

export default function AdminAvisosPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [expiresAt, setExpiresAt] = useState(buildDefaultExpiry());

  async function fetchNotices() {
    if (!user?.id) return;

    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('id, notice_group_id, title, message, expires_at, is_active, created_at, read_at, recipient_user_id')
      .eq('created_by', user.id)
      .eq('type', 'admin_notice')
      .order('created_at', { ascending: false });

    setRows((data as NoticeRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchNotices();
  }, [user?.id]);

  const groupedNotices = useMemo<NoticeGroup[]>(() => {
    const grouped = new Map<string, NoticeGroup>();

    for (const row of rows) {
      const groupId = row.notice_group_id ?? row.id;
      const current = grouped.get(groupId);

      if (current) {
        current.recipientCount += 1;
        if (row.read_at) current.readCount += 1;
      } else {
        grouped.set(groupId, {
          groupId,
          title: row.title,
          message: row.message,
          expiresAt: row.expires_at,
          isActive: row.is_active,
          createdAt: row.created_at,
          recipientCount: 1,
          readCount: row.read_at ? 1 : 0,
        });
      }
    }

    return Array.from(grouped.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [rows]);

  async function handleCreateNotice(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !title.trim() || !message.trim() || !expiresAt) return;

    setSaving(true);
    const { data: dtProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('role', 'DT');

    if (profilesError) {
      alert(`Não foi possível carregar os DTs: ${profilesError.message}`);
      setSaving(false);
      return;
    }

    if (!dtProfiles || dtProfiles.length === 0) {
      alert('Nenhum perfil de DT ativo foi encontrado para receber o aviso.');
      setSaving(false);
      return;
    }

    const noticeGroupId = crypto.randomUUID();
    const expiryIso = new Date(expiresAt).toISOString();

    const payload = dtProfiles.map((dt) => ({
      recipient_user_id: dt.user_id,
      created_by: user.id,
      type: 'admin_notice',
      notice_group_id: noticeGroupId,
      title: title.trim(),
      message: message.trim(),
      link_path: '/dashboard',
      expires_at: expiryIso,
      metadata: {
        created_via: 'admin_avisos',
        notice_group_id: noticeGroupId,
      },
    }));

    const { error } = await supabase.from('notifications').insert(payload);

    if (error) {
      alert(`Não foi possível criar o aviso: ${error.message}`);
      setSaving(false);
      return;
    }

    await logAudit('CREATE', 'notifications', noticeGroupId, {
      action: 'admin_notice_created',
      recipients: dtProfiles.length,
      expires_at: expiryIso,
    });

    setTitle('');
    setMessage('');
    setExpiresAt(buildDefaultExpiry());
    setSaving(false);
    fetchNotices();
  }

  async function handleDeactivateNotice(groupId: string) {
    if (!confirm('Encerrar este aviso agora? Ele deixará de aparecer para os DTs.')) return;

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('notifications')
      .update({ is_active: false, expires_at: now })
      .eq('notice_group_id', groupId)
      .eq('type', 'admin_notice');

    if (error) {
      alert(`Não foi possível encerrar o aviso: ${error.message}`);
      return;
    }

    await logAudit('UPDATE', 'notifications', groupId, {
      action: 'admin_notice_deactivated',
    });

    fetchNotices();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Avisos</h1>
        <p className="text-muted-foreground">
          Envie comunicados internos para todos os Professores Diretores de Turma.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Novo aviso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateNotice} className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Atualização importante do sistema"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escreva o aviso que todos os DTs irão receber..."
                rows={4}
                required
              />
            </div>

            <div className="space-y-2 max-w-sm">
              <Label>Válido até</Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                <Send className="mr-2 h-4 w-4" />
                {saving ? 'Enviando...' : 'Enviar aviso para todos os DTs'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Histórico de avisos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando avisos...</p>
          ) : groupedNotices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aviso enviado até agora.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Destinatários</TableHead>
                  <TableHead>Leituras</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedNotices.map((notice) => {
                  const isExpired = notice.expiresAt ? new Date(notice.expiresAt) <= new Date() : false;
                  const isActive = notice.isActive && !isExpired;

                  return (
                    <TableRow key={notice.groupId}>
                      <TableCell className="font-medium">{notice.title}</TableCell>
                      <TableCell className="max-w-md whitespace-pre-line text-sm text-muted-foreground">
                        {notice.message}
                      </TableCell>
                      <TableCell>{notice.recipientCount}</TableCell>
                      <TableCell>{notice.readCount}/{notice.recipientCount}</TableCell>
                      <TableCell>{formatDateTime(notice.expiresAt)}</TableCell>
                      <TableCell>
                        <Badge variant={isActive ? 'success' : 'outline'}>
                          {isActive ? 'Ativo' : 'Encerrado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isActive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Encerrar aviso"
                            onClick={() => handleDeactivateNotice(notice.groupId)}
                          >
                            <StopCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
