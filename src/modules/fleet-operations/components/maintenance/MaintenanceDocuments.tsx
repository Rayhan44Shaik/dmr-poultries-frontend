import { memo, useEffect, useState } from 'react';
import { Download, FileText, Loader2, Paperclip, Trash2, X, ChevronDown } from 'lucide-react';
import { useI18n } from '../../../../i18n';
import type { MaintenanceDocument } from '../../types';
import { maintenanceApi } from '../../services/maintenanceApi';
import { handleApiError } from '../../../../api/errors';
import { useSafeNotification } from '../../../../hooks/useSafeNotification';
import { confirmDialog } from '../../../../ui/confirm/confirmStore';

interface MaintenanceDocumentsProps {
  maintenanceId: string;
  documents: MaintenanceDocument[];
  allowRemove?: boolean;
  onChanged?: () => void;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const MaintenanceDocuments = ({ maintenanceId, documents, allowRemove = true, onChanged }: MaintenanceDocumentsProps) => {
  const { t } = useI18n();
  // Inline preview — opens BELOW the cards inside the same view (no popup).
  const [previewDoc, setPreviewDoc] = useState<MaintenanceDocument | null>(null);
  const [visibleDocs, setVisibleDocs] = useState<MaintenanceDocument[]>(documents || []);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const { showNotification } = useSafeNotification();

  useEffect(() => setVisibleDocs(Array.isArray(documents) ? documents : []), [documents]);

  const remove = async (doc: MaintenanceDocument) => {
    // Global confirmation dialog instead of the blocking native
    // `window.confirm`. The handler was already async, so the guard keeps its
    // exact linear shape and nothing below it changes.
    const confirmed = await confirmDialog({
      title: t('common.remove'),
      message: t('fleet.maintenance_docs.confirm_remove', { file: doc.fileName }),
      record: doc.fileName,
      confirmLabel: t('common.remove'),
      cancelLabel: t('common.cancel'),
      tone: 'danger',
    });
    if (!confirmed) return;
    setRemovingId(doc.id);
    try {
      await maintenanceApi.removeDocument(maintenanceId, doc.id);
      setVisibleDocs((items) => items.filter((item) => item.id !== doc.id));
      if (previewDoc?.id === doc.id) setPreviewDoc(null);
      showNotification(t('fleet.maintenance_docs.removed'), 'success');
      onChanged?.();
    } catch (cause) {
      showNotification(handleApiError(cause), 'error');
    } finally {
      setRemovingId(null);
    }
  };

  if (visibleDocs.length === 0) return <p className="text-sm italic text-slate-400">{t('fleet.maintenance_docs.no_documents')}</p>;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {visibleDocs.map((doc) => {
          const isImage = (doc.mimeType || '').startsWith('image/');
          const url = maintenanceApi.documentUrl(maintenanceId, doc.id);
          return (
            <div key={doc.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-blue-300 hover:shadow-sm">
              <button
                type="button"
                title={doc.fileName}
                onClick={() => setPreviewDoc((current) => (current?.id === doc.id ? null : doc))}
                className={`flex h-24 w-full items-center justify-center overflow-hidden bg-slate-100 transition-all ${
                  previewDoc?.id === doc.id ? 'ring-2 ring-inset ring-blue-400' : ''
                }`}>
                {isImage ? <img src={url} alt={doc.fileName} className="h-full w-full object-cover transition-transform group-hover:scale-105" /> : <div className="flex flex-col items-center text-slate-400"><FileText size={26} /><span className="mt-1 text-[10px] uppercase">PDF</span></div>}
              </button>
              <div className="p-2">
                <p className="flex items-center gap-1 truncate text-xs font-medium text-slate-700" title={doc.fileName}><Paperclip size={11} className="shrink-0 text-slate-400" /><span className="truncate">{doc.fileName}</span></p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{formatFileSize(doc.fileSize)}</span>
                  <div className="flex items-center gap-1">
                    <span className={`inline-flex text-slate-300 transition-transform duration-200 ${previewDoc?.id === doc.id ? 'rotate-180 text-blue-400' : ''}`}><ChevronDown size={12} /></span>
                    <button type="button" onClick={() => maintenanceApi.downloadDocument(maintenanceId, doc).catch((cause) => showNotification(handleApiError(cause), 'error'))} className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title={t('common.download')}><Download size={13} /></button>
                    {allowRemove && <button type="button" disabled={removingId === doc.id} onClick={() => void remove(doc)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" title={t('common.remove')}>{removingId === doc.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}</button>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Inline preview — expands right below the cards, scroll ("drag") to
          see the full document; download + hide live in its own strip. */}
      {previewDoc && (() => {
        const url = maintenanceApi.documentUrl(maintenanceId, previewDoc.id);
        const isImage = (previewDoc.mimeType || '').startsWith('image/');
        const isPdf = (previewDoc.mimeType || '').includes('pdf');
        return (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm animate-fade-in-up">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-3.5 py-2">
              <p className="flex min-w-0 items-center gap-2 text-xs font-bold text-slate-700">
                <FileText size={14} className="shrink-0 text-slate-400" />
                <span className="truncate">{previewDoc.fileName}</span>
                <span className="shrink-0 font-semibold text-slate-400">· {formatFileSize(previewDoc.fileSize)}</span>
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => maintenanceApi.downloadDocument(maintenanceId, previewDoc).catch((cause) => showNotification(handleApiError(cause), 'error'))}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-blue-700 active:scale-95"
                >
                  <Download size={12} />
                  {t('common.download')}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  title={t('common.close')}
                  aria-label={t('common.close')}
                  className="group relative flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
            {/* Scroll the body — "drag to see" the whole document. */}
            <div className="max-h-[440px] overflow-auto bg-slate-100/60">
              {isImage ? (
                <img src={url} alt={previewDoc.fileName} className="mx-auto min-h-[120px] w-auto max-w-full object-contain" />
              ) : isPdf ? (
                <iframe src={url} title={previewDoc.fileName} className="h-[436px] w-full border-0" />
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                  <FileText size={26} />
                  <button
                    type="button"
                    onClick={() => maintenanceApi.downloadDocument(maintenanceId, previewDoc).catch((cause) => showNotification(handleApiError(cause), 'error'))}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    {t('common.download')}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
};

export default memo(MaintenanceDocuments);
