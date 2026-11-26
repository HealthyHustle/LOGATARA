import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface StorybookDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  lightDismiss?: boolean;
  maxWidthClass?: string;
}

/**
 * Native <dialog> modal component adhering to modern-web-guidance:
 * - Uses native showModal() (no redundant role="dialog", aria-modal, or custom focus trap)
 * - Uses closedby="any" + pointerdown/pointerup bounding-box fallback where closedBy is unsupported
 * - Resets dialog.returnValue = '' on close
 * - Uses level-1 heading inside modal for accessible name via aria-labelledby
 */
export function StorybookDialog({
  open,
  onClose,
  title,
  children,
  lightDismiss = true,
  maxWidthClass = 'max-w-md',
}: StorybookDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };

    dialog.addEventListener('close', handleClose);

    // Fallback for browsers without native closedby="any" support (e.g. Safari)
    let cleanupPointer: (() => void) | undefined;
    if (lightDismiss && !('closedBy' in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const isOutside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      const onDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e);
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e)) dialog.close();
      };
      dialog.addEventListener('pointerdown', onDown);
      dialog.addEventListener('pointerup', onUp);
      cleanupPointer = () => {
        dialog.removeEventListener('pointerdown', onDown);
        dialog.removeEventListener('pointerup', onUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      cleanupPointer?.();
    };
  }, [lightDismiss, onClose]);

  const extraAttrs: Record<string, string> = {};
  if (lightDismiss) extraAttrs.closedby = 'any';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="storybook-dialog"
      {...extraAttrs}
    >
      <div
        className={`relative w-full ${maxWidthClass} bg-surface-ivory rounded-[2rem] p-6 sm:p-7 shadow-storybook-lg border-2 border-on-surface-bark/10 text-on-surface batik-watermark`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h1 id={titleId} className="font-display text-2xl font-bold text-primary leading-tight">
            {title}
          </h1>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Tutup dialog"
            className="p-2 rounded-full bg-surface-container hover:bg-surface-high text-on-surface-bark transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
