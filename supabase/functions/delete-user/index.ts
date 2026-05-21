import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('[delete-user] url ok:', !!supabaseUrl, '| key ok:', !!serviceRoleKey);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get('Authorization');
    console.log('[delete-user] auth header present:', !!authHeader);

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    console.log('[delete-user] user ok:', !!user, '| error:', userError?.message);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: `Token inválido: ${userError?.message}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    console.log('[delete-user] profile role:', profile?.role, '| error:', profileError?.message);

    if (profileError || !profile || profile.role !== 'ADMIN_SME') {
      return new Response(
        JSON.stringify({ error: `Acesso negado: role=${profile?.role ?? 'não encontrado'}, erro=${profileError?.message ?? 'nenhum'}` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { user_id } = body;

    console.log('[delete-user] target user_id:', user_id);

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    console.log('[delete-user] delete error:', deleteError?.message);

    if (deleteError) {
      return new Response(JSON.stringify({ error: `Erro ao deletar: ${deleteError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[delete-user] success');
    return new Response(JSON.stringify({ success: true, message: 'Usuário deletado com sucesso' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[delete-user] unhandled exception:', error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
