'use client';

import jsPDF from 'jspdf';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import {
  BIO_FORM_FIELD_LABELS,
  BIO_FORM_SECTIONS,
  type BioFormSections,
} from '@/lib/bio-form-status';

export interface BioFormInstrumentalStudent {
  id: string;
  name: string;
  enrollment_code: string | null;
  school_id: string;
  classroom_id: string;
  classrooms?: {
    year_grade: string;
    label: string;
    dt_user_id?: string | null;
    schools?: {
      name: string;
    } | null;
  } | null;
}

interface ExistingBioPdfUpload {
  id: string;
  storage_path: string;
  original_filename: string | null;
}

function slugifyFilePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function fileDateStamp(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
}

function svgUrlToBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 5000);
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      clearTimeout(timer);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || 256;
      canvas.height = image.naturalHeight || 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    image.src = url;
  });
}

export function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function getManualInstrumentalReviewMode() {
  const { data, error } = await supabase
    .from('instrumental_review_settings')
    .select('review_mode_enabled')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('[Ficha Biográfica] Erro ao carregar modo de revisão:', error.message);
  }

  return data?.review_mode_enabled ?? true;
}

async function createInstrumentalReviewNotification(params: {
  actorUserId: string;
  recipientUserId: string;
  actorLabel: string;
  uploadId: string;
  studentId: string;
  studentName: string;
  approvalMode: 'automatic';
}) {
  const title = `Ficha Biográfica de ${params.studentName} aprovado automaticamente`;
  const message = `Seu instrumental "Ficha Biográfica" do aluno ${params.studentName} foi aprovado automaticamente pelo sistema.`;

  const { error } = await supabase.from('notifications').insert({
    recipient_user_id: params.recipientUserId,
    created_by: params.actorUserId,
    type: 'instrumental_review',
    title,
    message,
    link_path: '/dt/instrumentais',
    metadata: {
      upload_id: params.uploadId,
      type: 'ficha_biografica',
      student_id: params.studentId,
      student_name: params.studentName,
      review_notes: 'Aprovado automaticamente com o modo de revisão desativado.',
      reviewer_name: params.actorLabel,
      reviewed_at: new Date().toISOString(),
      approval_mode: params.approvalMode,
    },
  });

  if (error) {
    console.error('[Ficha Biográfica] Erro ao criar notificação automática:', error.message);
    return;
  }

  await logAudit('CREATE', 'notifications', params.uploadId, {
    action: 'instrumental_auto_review_notification_created',
    upload_id: params.uploadId,
    recipient_user_id: params.recipientUserId,
  });
}

export async function buildBioFormPdf(params: {
  student: BioFormInstrumentalStudent;
  sections: BioFormSections;
  completed: boolean;
  dtName: string;
}) {
  const { student, sections, completed, dtName } = params;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const schoolName = student.classrooms?.schools?.name ?? 'Escola não vinculada';
  const classroomLabel = student.classrooms
    ? `${student.classrooms.year_grade} ${student.classrooms.label}`
    : 'Turma não vinculada';
  const generatedAt = new Date();
  const generatedAtLabel = generatedAt.toLocaleString('pt-BR');
  const statusLabel = completed ? 'Completa' : 'Pendente';
  const logoBase64 = await svgUrlToBase64('/PPDT_ARARENDA/logo-blue.svg');
  let y = 18;

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  const drawHeader = () => {
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', margin, 8, 14, 14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('PPDT Ararendá', margin + 17, 13);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Sistema Municipal DT', margin + 17, 17);
    } else {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('PPDT Ararendá', margin, 13);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('PROJETO DIRETOR DE TURMA', pageWidth / 2, 13, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(margin, 24, pageWidth - margin, 24);
    doc.line(margin, 25.5, pageWidth - margin, 25.5);
    y = 34;
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(12);
    doc.setFillColor(176, 207, 95);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.rect(margin, y - 3, contentWidth, 9, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(title.toUpperCase(), margin + 2, y + 2.5);
    y += 10;
  };

  const addInlineFieldsRow = (items: Array<{ label: string; value: string; width?: number }>) => {
    const totalCustomWidth = items.reduce((sum, item) => sum + (item.width ?? 0), 0);
    const autoCount = items.filter((item) => !item.width).length;
    const remainingWidth = contentWidth - totalCustomWidth;
    const autoWidth = autoCount > 0 ? remainingWidth / autoCount : 0;
    const rowHeight = 8;

    ensureSpace(rowHeight + 2);

    let x = margin;
    doc.setFontSize(9);

    items.forEach((item) => {
      const width = item.width ?? autoWidth;
      const safeValue = (item.value || '').trim();
      const labelText = `${item.label}:`;
      doc.setFont('helvetica', 'bold');
      const labelWidth = doc.getTextWidth(labelText);
      const valueX = x + labelWidth + 3;
      const lineStart = x + labelWidth + 2;
      const lineEnd = x + width;

      doc.text(labelText, x, y);
      doc.setFont('helvetica', 'normal');

      if (safeValue) {
        const truncated = doc.splitTextToSize(safeValue, Math.max(width - labelWidth - 7, 12))[0] ?? safeValue;
        doc.text(truncated, valueX, y);
      }

      doc.line(lineStart, y + 1.2, lineEnd, y + 1.2);
      x += width;
    });

    y += rowHeight;
  };

  const addTwoColumnTable = (left: Array<{ label: string; value: string }>, right?: Array<{ label: string; value: string }>) => {
    const rowHeight = 9;
    const totalRows = Math.max(left.length, right?.length ?? 0);
    const columnWidth = contentWidth / 2;

    ensureSpace(totalRows * rowHeight + 8);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);

    for (let row = 0; row < totalRows; row += 1) {
      const rowTop = y + row * rowHeight;
      const leftItem = left[row];
      const rightItem = right?.[row];

      doc.rect(margin, rowTop, columnWidth, rowHeight);
      doc.rect(margin + columnWidth, rowTop, columnWidth, rowHeight);

      if (leftItem) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(leftItem.label.toUpperCase(), margin + 2, rowTop + 3);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const leftValue = doc.splitTextToSize((leftItem.value || '').trim() || '—', columnWidth - 4)[0] ?? '—';
        doc.text(leftValue, margin + 2, rowTop + 6.7);
      }

      if (rightItem) {
        const rightX = margin + columnWidth;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(rightItem.label.toUpperCase(), rightX + 2, rowTop + 3);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const rightValue = doc.splitTextToSize((rightItem.value || '').trim() || '—', columnWidth - 4)[0] ?? '—';
        doc.text(rightValue, rightX + 2, rowTop + 6.7);
      }
    }

    y += totalRows * rowHeight + 3;
  };

  drawHeader();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Ficha Biográfica do Estudante', pageWidth / 2, y, { align: 'center' });
  y += 8;

  if (!completed) {
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Documento gerado com ficha pendente de conclusão.', pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 7;
  }

  addSectionTitle('Identificação do Documento');
  addInlineFieldsRow([
    { label: 'Escola', value: schoolName, width: 104 },
    { label: 'Turma', value: classroomLabel, width: 74 },
  ]);
  addInlineFieldsRow([
    { label: 'Aluno', value: student.name, width: 104 },
    { label: 'Matrícula', value: student.enrollment_code ?? '—', width: 74 },
  ]);
  addInlineFieldsRow([
    { label: 'Professor Diretor de Turma', value: dtName || '—', width: 104 },
    { label: 'Gerado em', value: generatedAtLabel, width: 74 },
  ]);

  ensureSpace(11);
  doc.setFillColor(completed ? 230 : 255, completed ? 244 : 248, completed ? 234 : 220);
  doc.setDrawColor(completed ? 34 : 180, completed ? 120 : 83, completed ? 70 : 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.rect(margin, y - 1.5, contentWidth, 8.5, 'FD');
  doc.setTextColor(completed ? 22 : 120, completed ? 101 : 53, completed ? 52 : 15);
  doc.text(`Status da ficha: ${statusLabel}`, margin + 3, y + 4);
  doc.setTextColor(0, 0, 0);
  y += 10;

  for (const section of BIO_FORM_SECTIONS) {
    addSectionTitle(section.label);
    const entries = Object.entries(sections[section.id] ?? {}).map(([field, rawValue]) => ({
      label: BIO_FORM_FIELD_LABELS[field] ?? field,
      value: rawValue,
    }));
    const midpoint = Math.ceil(entries.length / 2);
    addTwoColumnTable(entries.slice(0, midpoint), entries.slice(midpoint));
  }

  const pdfBlob = doc.output('blob');
  const filename = `FICHA_BIOGRAFICA_${slugifyFilePart(schoolName)}_${slugifyFilePart(student.name)}_${fileDateStamp(generatedAt)}.pdf`;

  return { blob: pdfBlob, filename, generatedAt };
}

async function findLatestExistingBioPdf(uploadedByUserId: string, studentId: string) {
  const { data } = await supabase
    .from('instrumental_uploads')
    .select('id, storage_path, original_filename')
    .eq('uploaded_by', uploadedByUserId)
    .eq('student_id', studentId)
    .eq('type', 'ficha_biografica')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ExistingBioPdfUpload | null) ?? null;
}

export async function syncBioFormInstrumental(params: {
  actorUserId: string;
  actorUserName: string;
  uploadedByUserId: string;
  dtName: string;
  student: BioFormInstrumentalStudent;
  sections: BioFormSections;
  completed: boolean;
}) {
  const manualReviewEnabled = await getManualInstrumentalReviewMode();
  const autoReviewTimestamp = new Date().toISOString();
  const generatedPdf = await buildBioFormPdf({
    student: params.student,
    sections: params.sections,
    completed: params.completed,
    dtName: params.dtName,
  });

  const storagePath = `${params.uploadedByUserId}/ficha_biografica/${crypto.randomUUID()}.pdf`;
  const pdfFile = new File([generatedPdf.blob], generatedPdf.filename, {
    type: 'application/pdf',
    lastModified: generatedPdf.generatedAt.getTime(),
  });

  const { error: uploadError } = await supabase.storage
    .from('instrumentais')
    .upload(storagePath, pdfFile, { contentType: 'application/pdf', upsert: false });

  if (uploadError) {
    throw new Error(`Não foi possível salvar o PDF no storage: ${uploadError.message}`);
  }

  const existingUpload = await findLatestExistingBioPdf(params.uploadedByUserId, params.student.id);
  let instrumentalId = '';
  let action: 'create' | 'replace' = 'create';

  if (existingUpload) {
    action = 'replace';
    const { error: replaceError } = await supabase
      .from('instrumental_uploads')
      .update({
        storage_path: storagePath,
        original_filename: generatedPdf.filename,
        reference_date: generatedPdf.generatedAt.toISOString().split('T')[0],
        observations: `Gerado automaticamente da ficha biográfica (${params.completed ? 'completa' : 'pendente'})`,
        reviewed_by: null,
        reviewed_at: manualReviewEnabled ? null : autoReviewTimestamp,
        review_notes: manualReviewEnabled
          ? null
          : 'Aprovado automaticamente com o modo de revisão desativado.',
      })
      .eq('id', existingUpload.id);

    if (replaceError) {
      await supabase.storage.from('instrumentais').remove([storagePath]);
      throw new Error(`Não foi possível atualizar o instrumental existente: ${replaceError.message}`);
    }

    await supabase.storage.from('instrumentais').remove([existingUpload.storage_path]);
    instrumentalId = existingUpload.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('instrumental_uploads')
      .insert({
        uploaded_by: params.uploadedByUserId,
        school_id: params.student.school_id,
        classroom_id: params.student.classroom_id,
        student_id: params.student.id,
        type: 'ficha_biografica',
        storage_path: storagePath,
        original_filename: generatedPdf.filename,
        reference_date: generatedPdf.generatedAt.toISOString().split('T')[0],
        observations: `Gerado automaticamente da ficha biográfica (${params.completed ? 'completa' : 'pendente'})`,
        reviewed_at: manualReviewEnabled ? null : autoReviewTimestamp,
        review_notes: manualReviewEnabled
          ? null
          : 'Aprovado automaticamente com o modo de revisão desativado.',
      })
      .select('id')
      .single();

    if (insertError || !inserted?.id) {
      await supabase.storage.from('instrumentais').remove([storagePath]);
      throw new Error(`Não foi possível registrar o instrumental gerado: ${insertError?.message ?? 'Erro desconhecido.'}`);
    }

    instrumentalId = inserted.id;
  }

  await logAudit(action === 'replace' ? 'UPDATE' : 'CREATE', 'instrumental_uploads', instrumentalId, {
    action: 'generated_from_bio_form',
    student_id: params.student.id,
    student_name: params.student.name,
    bio_form_completed: params.completed,
    generation_mode: action,
  });

  if (!manualReviewEnabled) {
    await createInstrumentalReviewNotification({
      actorUserId: params.actorUserId,
      recipientUserId: params.uploadedByUserId,
      uploadId: instrumentalId,
      studentId: params.student.id,
      studentName: params.student.name,
      approvalMode: 'automatic',
      actorLabel: params.actorUserName,
    });
  }

  return {
    action,
    uploadId: instrumentalId,
    filename: generatedPdf.filename,
    blob: generatedPdf.blob,
    generatedAt: generatedPdf.generatedAt,
    manualReviewEnabled,
  };
}
