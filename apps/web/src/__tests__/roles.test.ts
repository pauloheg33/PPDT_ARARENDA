import { describe, it, expect } from 'vitest';
import { hasPermission, canAccessSchool, canManageClassroom, ROLES } from '@/lib/roles';

describe('RBAC – roles.ts', () => {
  it('ADMIN_SME has all permissions via "tudo"', () => {
    expect(hasPermission(ROLES.ADMIN_SME, 'gerenciar_usuarios')).toBe(true);
    expect(hasPermission(ROLES.ADMIN_SME, 'qualquer_coisa')).toBe(true);
  });

  it('DT cannot manage users', () => {
    expect(hasPermission(ROLES.DT, 'gerenciar_usuarios')).toBe(false);
  });

  it('DT can manage assigned classroom', () => {
    expect(hasPermission(ROLES.DT, 'gerenciar_turma_atribuida')).toBe(true);
  });

  it('ALUNO can only fill bio form when unlocked', () => {
    expect(hasPermission(ROLES.ALUNO, 'preencher_ficha_biografica_quando_liberado')).toBe(true);
    expect(hasPermission(ROLES.ALUNO, 'gerenciar_usuarios')).toBe(false);
  });

  it('canAccessSchool returns correct values', () => {
    expect(canAccessSchool(ROLES.ADMIN_SME)).toBe(true);
    expect(canAccessSchool(ROLES.COORD_PPDT)).toBe(true);
    expect(canAccessSchool(ROLES.GESTOR_ESCOLA)).toBe(true);
    expect(canAccessSchool(ROLES.DT)).toBe(false);
    expect(canAccessSchool(ROLES.ALUNO)).toBe(false);
  });

  it('canManageClassroom returns correct values', () => {
    expect(canManageClassroom(ROLES.ADMIN_SME)).toBe(true);
    expect(canManageClassroom(ROLES.DT)).toBe(true);
    expect(canManageClassroom(ROLES.ALUNO)).toBe(false);
    expect(canManageClassroom(ROLES.COORD_PPDT)).toBe(false);
  });
});
