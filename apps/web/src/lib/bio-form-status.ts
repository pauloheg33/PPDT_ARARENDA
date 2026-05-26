export type BioFormSections = Record<string, Record<string, string>>;

export const BIO_FORM_SECTIONS = [
  { id: 'familia', label: 'Composição Familiar' },
  { id: 'vida_escolar', label: 'Vida Escolar' },
  { id: 'tempo_livre', label: 'Tempo Livre' },
  { id: 'saude', label: 'Saúde / Alimentação' },
  { id: 'complementar', label: 'Atividades Complementares' },
] as const;

export const BIO_FORM_DEFAULT_SECTIONS: BioFormSections = {
  familia: {
    com_quem_mora: '',
    numero_irmaos: '',
    profissao_pai: '',
    profissao_mae: '',
    renda_familiar: '',
    tipo_moradia: '',
    observacoes_familia: '',
  },
  vida_escolar: {
    disciplina_preferida: '',
    disciplina_dificuldade: '',
    apoio_pedagogico: '',
    deslocamento: '',
    profissao_desejada: '',
    repetencia: '',
    motivo_repetencia: '',
    opiniao_escola: '',
  },
  tempo_livre: {
    atividades_livres: '',
    usa_internet: '',
    horas_tela: '',
    pratica_esporte: '',
    qual_esporte: '',
    participa_grupo: '',
    qual_grupo: '',
  },
  saude: {
    problemas_saude: '',
    medicamento_continuo: '',
    qual_medicamento: '',
    alimentacao_escola: '',
    alergia_alimentar: '',
    qual_alergia: '',
    plano_saude: '',
  },
  complementar: {
    participa_programa_social: '',
    qual_programa: '',
    trabalha: '',
    onde_trabalha: '',
    carga_horaria_trabalho: '',
    expectativa_futuro: '',
    observacoes_gerais: '',
  },
};

export const BIO_FORM_FIELD_LABELS: Record<string, string> = {
  com_quem_mora: 'Com quem mora?',
  numero_irmaos: 'Número de irmãos',
  profissao_pai: 'Profissão do pai',
  profissao_mae: 'Profissão da mãe',
  renda_familiar: 'Renda familiar',
  tipo_moradia: 'Tipo de moradia',
  observacoes_familia: 'Observações',
  disciplina_preferida: 'Disciplina preferida',
  disciplina_dificuldade: 'Disciplina com dificuldade',
  apoio_pedagogico: 'Recebe apoio pedagógico?',
  deslocamento: 'Como se desloca até a escola?',
  profissao_desejada: 'Profissão desejada',
  repetencia: 'Já repetiu de ano?',
  motivo_repetencia: 'Motivo da repetência',
  opiniao_escola: 'O que acha da escola?',
  atividades_livres: 'Atividades nos tempos livres',
  usa_internet: 'Usa internet?',
  horas_tela: 'Horas de tela por dia',
  pratica_esporte: 'Pratica esporte?',
  qual_esporte: 'Qual esporte?',
  participa_grupo: 'Participa de algum grupo?',
  qual_grupo: 'Qual grupo?',
  problemas_saude: 'Problemas de saúde',
  medicamento_continuo: 'Usa medicamento contínuo?',
  qual_medicamento: 'Qual medicamento?',
  alimentacao_escola: 'Se alimenta na escola?',
  alergia_alimentar: 'Possui alergia alimentar?',
  qual_alergia: 'Qual alergia?',
  plano_saude: 'Possui plano de saúde?',
  participa_programa_social: 'Participa de programa social?',
  qual_programa: 'Qual programa?',
  trabalha: 'Trabalha?',
  onde_trabalha: 'Onde trabalha?',
  carga_horaria_trabalho: 'Carga horária de trabalho',
  expectativa_futuro: 'Expectativa para o futuro',
  observacoes_gerais: 'Observações gerais',
};

export function cloneBioFormSections() {
  return JSON.parse(JSON.stringify(BIO_FORM_DEFAULT_SECTIONS)) as BioFormSections;
}

export function mergeBioFormSections(
  loaded?: Record<string, Record<string, string>> | null
) {
  const merged = cloneBioFormSections();

  if (!loaded) return merged;

  for (const [sectionKey, sectionFields] of Object.entries(loaded)) {
    if (!merged[sectionKey]) continue;

    for (const [field, value] of Object.entries(sectionFields)) {
      merged[sectionKey][field] = value;
    }
  }

  return merged;
}

export function getBioFormSectionCompletion(
  sections: BioFormSections,
  sectionId: string
) {
  const fields = sections[sectionId] ?? {};
  const total = Object.keys(fields).length;

  if (total === 0) return 0;

  const filled = Object.values(fields).filter((value) => value.trim() !== '').length;
  return Math.round((filled / total) * 100);
}

export function getBioFormStatus(sections: BioFormSections) {
  const sectionCompletion = Object.fromEntries(
    BIO_FORM_SECTIONS.map((section) => [
      section.id,
      getBioFormSectionCompletion(sections, section.id),
    ])
  ) as Record<string, number>;

  const sectionValues = Object.values(sectionCompletion);
  const totalSections = sectionValues.length;
  const overallCompletion =
    totalSections > 0
      ? Math.round(
          sectionValues.reduce((sum, value) => sum + value, 0) / totalSections
        )
      : 0;

  const isComplete =
    totalSections > 0 && sectionValues.every((value) => value === 100);

  return {
    isComplete,
    overallCompletion,
    sectionCompletion,
  };
}
