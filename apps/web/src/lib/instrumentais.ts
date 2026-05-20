import jsPDF from 'jspdf';

export type InstrumentalSourceFormat = 'pdf' | 'image';

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export const INSTRUMENTAL_FILE_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

export function getInstrumentalSourceFormat(file: File): InstrumentalSourceFormat | null {
  if (file.type === 'application/pdf') return 'pdf';
  if (SUPPORTED_IMAGE_MIME_TYPES.has(file.type)) return 'image';

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'pdf';
  if (IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) return 'image';

  return null;
}

export function isSupportedInstrumentalFile(file: File) {
  return getInstrumentalSourceFormat(file) !== null;
}

export function buildInstrumentalPdfFilename(originalName: string) {
  const sanitized = originalName.replace(/\.[^.]+$/, '').trim() || 'instrumental';
  return `${sanitized}.pdf`;
}

export function isImageStoragePath(storagePath: string) {
  const lowerPath = storagePath.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lowerPath.endsWith(ext));
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

async function dataUrlToImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível carregar a imagem selecionada.'));
    image.src = dataUrl;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error('Não foi possível preparar a foto para envio.'));
      },
      'image/jpeg',
      0.92
    );
  });
}

async function imageFileToPdf(file: File) {
  const dataUrl = await fileToDataUrl(file);
  const image = await dataUrlToImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível preparar a foto do instrumental.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const normalizedImageBlob = await canvasToBlob(canvas);
  const normalizedImageDataUrl = await fileToDataUrl(
    new File([normalizedImageBlob], 'instrumental.jpg', { type: 'image/jpeg' })
  );

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const imageRatio = canvas.width / canvas.height;
  const contentRatio = contentWidth / contentHeight;

  let renderWidth = contentWidth;
  let renderHeight = contentHeight;

  if (imageRatio > contentRatio) {
    renderHeight = renderWidth / imageRatio;
  } else {
    renderWidth = renderHeight * imageRatio;
  }

  const x = (pageWidth - renderWidth) / 2;
  const y = (pageHeight - renderHeight) / 2;

  doc.addImage(normalizedImageDataUrl, 'JPEG', x, y, renderWidth, renderHeight, undefined, 'FAST');

  const pdfBlob = doc.output('blob');
  const pdfName = buildInstrumentalPdfFilename(file.name);

  return new File([pdfBlob], pdfName, {
    type: 'application/pdf',
    lastModified: Date.now(),
  });
}

export async function normalizeInstrumentalUpload(file: File) {
  const sourceFormat = getInstrumentalSourceFormat(file);

  if (!sourceFormat) {
    throw new Error('Envie um arquivo em PDF, JPG, PNG ou WEBP.');
  }

  if (sourceFormat === 'pdf') {
    return {
      file,
      sourceFormat,
      originalFilename: file.name,
      storedFilename: file.name,
    };
  }

  const pdfFile = await imageFileToPdf(file);

  return {
    file: pdfFile,
    sourceFormat,
    originalFilename: file.name,
    storedFilename: pdfFile.name,
  };
}
