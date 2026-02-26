# PPDT Ararendá — Projeto Professor Diretor de Turma

Sistema de gestão educacional municipal para a **Secretaria Municipal de Educação de Ararendá-CE**, inspirado no SIGE DT (Diretor de Turma).

---

## Visão Geral

| Item | Detalhe |
|------|---------|
| **Frontend** | Next.js 14 (App Router) com export estático |
| **Estilo** | TailwindCSS + shadcn/ui |
| **Backend** | Supabase (PostgreSQL + Auth + Storage + RLS) |
| **Deploy** | GitHub Pages via GitHub Actions |
| **Exportação** | PDF (jsPDF) · CSV · XLSX |
| **Segurança** | RLS por role, LGPD com audit_log |

### Papéis (RBAC)

| Role | Acesso |
|------|--------|
| `ADMIN_SME` | Acesso total à rede municipal |
| `COORD_PPDT` | Leitura de toda a rede |
| `GESTOR_ESCOLA` | Leitura da própria escola |
| `DT` | Gestão completa da turma atribuída |
| `ALUNO` | Preencher ficha biográfica (quando liberado) |

---

## Módulos

1. **Cadastros** — Escolas, Turmas, Alunos, Usuários
2. **Importação CSV/XLSX** — Upload em massa com detecção de duplicatas
3. **Ficha Biográfica** — 5 seções (Família, Vida Escolar, Tempo Livre, Saúde, Complementar), autosave, liberação pelo DT
4. **Registro Fotográfico** — Upload de fotos 3×4, líder/vice-líder, exportação PDF
5. **Mapeamento de Sala** — Grade configurável com drag-and-drop, exportação PDF
6. **Relatórios** — Caracterização da turma, dados estatísticos, análise por disciplina, exportação PDF
7. **Dashboard** — Visão diferenciada por role (SME/Escola/DT)

---

## Pré-requisitos

- **Node.js** ≥ 18 (recomendado v20 LTS)
- **npm** ≥ 9
- Conta no [Supabase](https://supabase.com) (plano gratuito funciona)

---

## Instalação Local

```bash
# 1. Clone o repositório
git clone https://github.com/SEU_USUARIO/PPDT_ARARENDA.git
cd PPDT_ARARENDA/apps/web

# 2. Instale as dependências
npm install

# 3. Configure o ambiente
cp .env.example .env.local
# Edite .env.local com as credenciais do Supabase

# 4. Rode em desenvolvimento
npm run dev
# Acesse http://localhost:3000
```

---

## Configuração do Supabase

### 1. Criar projeto

1. Acesse [app.supabase.com](https://app.supabase.com) e crie um novo projeto
2. Copie **Project URL** e **anon public key** em Settings → API

### 2. Rodar as migrations

No **SQL Editor** do Supabase, execute em ordem:

1. `supabase/migrations/001_create_tables.sql` — Tabelas, views e índices
2. `supabase/migrations/002_rls_policies.sql` — RLS e políticas de acesso
3. `supabase/migrations/003_storage_setup.sql` — Bucket de fotos

### 3. Popular dados iniciais (opcional)

Execute `supabase/seeds/001_seed_data.sql` para inserir 3 escolas e 10 alunos de exemplo.

### 4. Criar usuário Admin

No Supabase → Authentication → Users → **Add User** (email + senha).

Depois, no SQL Editor:

```sql
INSERT INTO public.profiles (id, email, full_name, role)
VALUES (
  'UUID_DO_USUARIO_CRIADO',
  'admin@ararenda.ce.gov.br',
  'Administrador SME',
  'ADMIN_SME'
);
```

### 5. Configurar Storage

O script `003_storage_setup.sql` já cria o bucket `student-photos`. Verifique em Storage que está com as políticas de acesso corretas.

---

## Deploy no GitHub Pages

### Configuração

1. No `apps/web/next.config.js`, descomente e ajuste:
   ```js
   basePath: '/PPDT_ARARENDA',
   assetPrefix: '/PPDT_ARARENDA',
   ```

2. No GitHub → Settings → **Secrets and variables** → Actions, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. No GitHub → Settings → **Pages** → Source: **GitHub Actions**

4. Faça push na branch `main` — o deploy é automático.

---

## Estrutura do Projeto

```
PPDT_ARARENDA/
├── .github/workflows/deploy.yml    # CI/CD
├── apps/web/
│   ├── src/
│   │   ├── app/                    # Páginas (App Router)
│   │   │   ├── (auth)/login/       # Login
│   │   │   └── (dashboard)/        # Área autenticada
│   │   │       ├── dashboard/      # Dashboard principal
│   │   │       ├── admin/          # Escolas, Turmas, Alunos, Importar, Usuários
│   │   │       └── dt/turma/[id]/  # Liberação, Ficha, Fotos, Mapa, Relatórios
│   │   ├── components/             # UI components (shadcn/ui)
│   │   ├── hooks/                  # useAuth
│   │   ├── lib/                    # supabase, roles, audit, utils
│   │   └── types/                  # database.ts
│   ├── public/                     # Assets estáticos
│   ├── .env.example
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── package.json
├── supabase/
│   ├── migrations/                 # 001, 002, 003
│   └── seeds/                      # 001_seed_data
└── scripts/
    └── modelo_importacao_alunos.csv # Modelo CSV para importação
```

---

## Importação de Alunos

O sistema aceita CSV e XLSX. Use o modelo em `scripts/modelo_importacao_alunos.csv`.

**Colunas obrigatórias:**
- `nome_completo` (ou `full_name`, `nome`)
- `data_nascimento` (ou `birthdate`, `nascimento`) — formato YYYY-MM-DD

**Detecção de duplicatas:** por `codigo_matricula` + `data_nascimento`.

---

## Licença

Projeto desenvolvido para uso interno da Secretaria Municipal de Educação de Ararendá-CE.

© 2025 SME Ararendá. Todos os direitos reservados.
