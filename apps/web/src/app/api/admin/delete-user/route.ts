import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Helper para criar cliente admin com service role key (server-side only)
// Inicialização deferida para evitar erros durante build se env vars não estiverem disponíveis
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error(`Supabase configuration missing: URL=${!!url}, KEY=${!!key}`);
  }
  
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    let supabaseAdmin;
    try {
      supabaseAdmin = getSupabaseAdmin();
    } catch (initError: any) {
      return NextResponse.json(
        { error: `Erro de configuração: ${initError.message}` },
        { status: 500 }
      );
    }

    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar autenticação e permissão (ADMIN_SME)
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Extrair token
    const token = authHeader.split(' ')[1];
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !userData.user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    // Verificar se é ADMIN_SME
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', userData.user.id)
      .single();

    if (profileError || !profile || profile.role !== 'ADMIN_SME') {
      return NextResponse.json(
        { error: 'Apenas ADMIN_SME podem deletar usuários' },
        { status: 403 }
      );
    }

    // Deletar o usuário de auth.users (isso cascata deleta o profile via trigger)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (deleteError) {
      return NextResponse.json(
        { error: `Erro ao deletar usuário: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Usuário deletado com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar usuário:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
