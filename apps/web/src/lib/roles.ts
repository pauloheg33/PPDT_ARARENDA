export const ROLES = {
  ADMIN_SME: 'ADMIN_SME',
  COORD_PPDT: 'COORD_PPDT',
  GESTOR_ESCOLA: 'GESTOR_ESCOLA',
  DT: 'DT',
  ALUNO: 'ALUNO',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN_SME: 'Administrador SME',
  COORD_PPDT: 'Coordenação Municipal PPDT',
  GESTOR_ESCOLA: 'Gestor Escolar',
  DT: 'Professor Diretor de Turma',
  ALUNO: 'Aluno',
};

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  ADMIN_SME: [
    'tudo',
    'gerenciar_usuarios',
    'gerenciar_escolas',
    'gerenciar_turmas',
    'consultar_rede',
  ],
  COORD_PPDT: [
    'consultar_rede',
    'acompanhar_escolas',
    'visualizar_relatorios',
    'criar_modelos_instrumentais',
  ],
  GESTOR_ESCOLA: [
    'consultar_escola',
    'consultar_turmas_da_escola',
    'visualizar_relatorios_escola',
  ],
  DT: [
    'gerenciar_turma_atribuida',
    'liberar_bloquear_ficha_biografica',
    'montar_registro_fotografico',
    'montar_mapeamento_sala',
    'registrar_atendimentos',
    'gerar_relatorios_turma',
  ],
  ALUNO: [
    'preencher_ficha_biografica_quando_liberado',
    'visualizar_sua_ficha_quando_liberado',
  ],
};

export function hasPermission(role: Role, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms.includes('tudo') || perms.includes(permission);
}

export function canAccessSchool(role: Role): boolean {
  return ['ADMIN_SME', 'COORD_PPDT', 'GESTOR_ESCOLA'].includes(role);
}

export function canManageClassroom(role: Role): boolean {
  return ['ADMIN_SME', 'DT'].includes(role);
}
