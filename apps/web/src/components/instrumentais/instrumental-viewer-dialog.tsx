'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, ZoomIn, ZoomOut } from 'lucide-react';
import { isImageStoragePath } from '@/lib/instrumentais';

interface InstrumentalViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string | null;
  title: string;
  description?: string | null;
  storagePath?: string | null;
}

export function InstrumentalViewerDialog({
  open,
  onOpenChange,
  fileUrl,
  title,
  description,
  storagePath,
}: InstrumentalViewerDialogProps) {
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (open) {
      setZoom(100);
    }
  }, [open, fileUrl]);

  const isImage = useMemo(() => {
    if (!storagePath) return false;
    return isImageStoragePath(storagePath);
  }, [storagePath]);

  const documentUrl = useMemo(() => {
    if (!fileUrl) return null;
    if (isImage) return fileUrl;
    return `${fileUrl}#toolbar=1&navpanes=0&zoom=${zoom}`;
  }, [fileUrl, isImage, zoom]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-6xl h-[92vh] overflow-hidden p-0">
        <div className="flex h-full flex-col">
          <DialogHeader className="border-b px-6 py-4 text-left">
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <p className="pr-10 text-sm text-muted-foreground">{description}</p>
            )}
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setZoom((current) => Math.max(50, current - 10))}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <div className="min-w-16 text-center text-sm font-medium">{zoom}%</div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setZoom((current) => Math.min(200, current + 10))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => fileUrl && window.open(fileUrl, '_blank', 'noopener,noreferrer')}
              disabled={!fileUrl}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir original
            </Button>
          </div>

          <div className="flex-1 overflow-auto bg-slate-200/70 p-6">
            {!documentUrl ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Nenhum arquivo disponível para visualização.
              </div>
            ) : isImage ? (
              <div className="flex min-h-full items-start justify-center">
                <div
                  className="rounded-sm bg-white shadow-2xl"
                  style={{ width: `${Math.round(794 * (zoom / 100))}px` }}
                >
                  <img
                    src={documentUrl}
                    alt={title}
                    className="block h-auto w-full rounded-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="flex min-h-full items-start justify-center">
                <div className="h-[calc(100vh-17rem)] w-full max-w-[960px] overflow-hidden rounded-sm bg-white shadow-2xl">
                  <iframe
                    key={documentUrl}
                    src={documentUrl}
                    title={title}
                    className="h-full w-full border-0"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
