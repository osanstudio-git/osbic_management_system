import React, { useState } from 'react';
import { 
  FileText, Upload, Plus, Download, Eye, Trash2, 
  Clock, ShieldCheck, AlertCircle, X, Loader2, Calendar 
} from 'lucide-react';
import { useEmployeeDocuments, type EmployeeDocument } from '../../hooks/admin/useEmployeeDocuments';
import { supabase } from '../../lib/supabase';
import { format, parseISO, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';

interface EmployeeDocumentsVaultProps {
  employeeId: string;
  employeeName: string;
}

export const EmployeeDocumentsVault: React.FC<EmployeeDocumentsVaultProps> = ({ employeeId, employeeName }) => {
  const { documents, isLoading, uploadDocument, isUploading, deleteDocument, isDeleting } = useEmployeeDocuments(employeeId);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<EmployeeDocument['document_type']>('civil_id');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleOpenView = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(filePath, 3600);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      toast.error('Could not preview file: ' + (err.message || 'Error'));
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(filePath);
      if (error) throw error;
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Download failed: ' + (err.message || 'Error'));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please choose a file to upload');
      return;
    }
    if (!title.trim()) {
      toast.error('Please provide a document title');
      return;
    }

    uploadDocument(
      {
        employeeId,
        documentType,
        title: title.trim(),
        file,
        expiryDate: expiryDate || null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          setIsAddOpen(false);
          setTitle('');
          setExpiryDate('');
          setNotes('');
          setFile(null);
        },
      }
    );
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-card border border-border/80 rounded-2xl shadow-sm">
        <div>
          <h3 className="text-base font-syne font-bold text-foreground flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" />
            Official Employee Vault ({documents.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Store and verify legal documents for {employeeName} (Civil ID, Passport, Labor Contract, Academic Certs)
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-md active:scale-95"
        >
          <Plus size={16} />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Upload Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Upload size={16} className="text-primary" />
                Upload to Employee Vault
              </h4>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">Document Type *</label>
                <select
                  value={documentType}
                  onChange={(e) => {
                    const dt = e.target.value as any;
                    setDocumentType(dt);
                    if (!title) {
                      if (dt === 'civil_id') setTitle('Civil ID Copy');
                      else if (dt === 'passport') setTitle('Passport Copy');
                      else if (dt === 'visa') setTitle('Resident Visa Card');
                      else if (dt === 'labor_contract') setTitle('Ministry of Labor Contract');
                      else if (dt === 'academic_cert') setTitle('Degree / Diploma Certificate');
                    }
                  }}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="civil_id">National / Civil ID</option>
                  <option value="passport">Passport Copy</option>
                  <option value="visa">Employment / Resident Visa</option>
                  <option value="labor_contract">Ministry Labor Contract</option>
                  <option value="academic_cert">Academic / Degree Certificate</option>
                  <option value="driving_license">Driving License</option>
                  <option value="other">Other Official Record</option>
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Document Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Civil ID Front & Back"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Expiry Date (If applicable)</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Choose File (PDF or Image) *</label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Renewed at Sanad Center"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl text-muted-foreground hover:bg-muted font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold flex items-center gap-1.5 hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  <span>{isUploading ? 'Uploading...' : 'Save Document'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Documents Grid */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin text-primary" />
          <span>Loading employee vault...</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="p-12 text-center bg-card border border-dashed border-border/80 rounded-2xl space-y-2">
          <FileText size={36} className="mx-auto text-muted-foreground/40" />
          <h4 className="text-sm font-bold text-foreground">No documents uploaded yet</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Upload copies of Civil ID, Passport, Labor Contract, and educational degrees to keep the staff dossier complete.
          </p>
          <button
            onClick={() => setIsAddOpen(true)}
            className="mt-3 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 text-xs font-bold transition-all"
          >
            + Upload First Document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const daysLeft = doc.expiry_date ? differenceInDays(parseISO(doc.expiry_date), new Date()) : null;

            return (
              <div
                key={doc.id}
                className="bg-card border border-border/70 hover:border-primary/40 rounded-2xl p-4 shadow-sm transition-all flex flex-col justify-between space-y-3 group"
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-muted-foreground mb-1">
                    <span className="px-2 py-0.5 rounded-md bg-muted/50 border border-border">
                      {doc.document_type.replace('_', ' ')}
                    </span>
                    <span className="font-mono text-muted-foreground/70">{formatFileSize(doc.file_size)}</span>
                  </div>

                  <h4 className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {doc.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground/80 line-clamp-1 mt-0.5 font-mono">
                    {doc.file_name}
                  </p>
                </div>

                {doc.expiry_date && (
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock size={11} /> Expiry:
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        daysLeft !== null && daysLeft < 0
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : daysLeft !== null && daysLeft <= 30
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {format(parseISO(doc.expiry_date), 'dd MMM yyyy')}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenView(doc.file_path)}
                      className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1 transition-all"
                      title="Preview in browser"
                    >
                      <Eye size={13} />
                      <span className="text-[10px]">Preview</span>
                    </button>
                    <button
                      onClick={() => handleDownload(doc.file_path, doc.file_name)}
                      className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1 transition-all"
                      title="Download file"
                    >
                      <Download size={13} />
                      <span className="text-[10px]">Download</span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(`Delete ${doc.title}?`)) {
                        deleteDocument({ id: doc.id, filePath: doc.file_path });
                      }
                    }}
                    disabled={isDeleting}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete document"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
