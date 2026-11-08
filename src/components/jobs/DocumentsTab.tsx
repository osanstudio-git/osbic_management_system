import { useState } from 'react';
import { FileText, Download, Trash2, XCircle, UploadCloud, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  type JobDocument, 
  useUploadJobDocument, 
  useUpdateDocumentStatus, 
  useDeleteDocument 
} from '../../hooks/shared/useJobs';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  jobId: string;
  documents: JobDocument[];
  isEmployee: boolean;
  isAdmin: boolean;
}

import { useDropzone } from 'react-dropzone';

const DocumentsTab = ({ jobId, documents, isEmployee, isAdmin }: Props) => {
  const [showUpload, setShowUpload] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<JobDocument | null>(null);
  const [uploadMode, setUploadMode] = useState<'direct' | 'link'>('direct');
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { mutate: uploadDoc, isPending } = useUploadJobDocument();
  const { mutate: updateStatus } = useUpdateDocumentStatus();
  const { mutate: deleteDoc } = useDeleteDocument();

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const [actionDocId, setActionDocId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'reject' | 'delete' | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [vaultTab, setVaultTab] = useState<'clientUploads' | 'staffUploads'>('clientUploads');

  const getStoragePath = (filePath: string): string => {
    if (!filePath) return '';
    if (!filePath.startsWith('http')) return filePath;
    const match = filePath.match(/\/storage\/v1\/object\/(?:public|sign)\/documents\/(.+?)(?:\?.*)?$/);
    return match ? decodeURIComponent(match[1]) : filePath;
  };

  const handlePreview = async (doc: JobDocument) => {
    setIsLoadingPreview(true);
    try {
      const storagePath = getStoragePath(doc.file_path);
      if (!storagePath.startsWith('http')) {
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(storagePath, 3600);
        
        if (error) throw error;
        if (data?.signedUrl) {
          setPreviewUrl(data.signedUrl);
          setPreviewDoc(doc);
          return;
        }
      }
      setPreviewUrl(doc.file_path);
      setPreviewDoc(doc);
    } catch (err: any) {
      toast.error('Could not retrieve preview: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownload = async (path: string, name: string) => {
    try {
      const storagePath = getStoragePath(path);
      if (!storagePath.startsWith('http')) {
        const { data, error } = await supabase.storage.from('documents').download(storagePath);
        if (error) throw error;
        
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', name);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return;
      }
      window.open(path, '_blank');
    } catch (err: any) {
      toast.error('Download failed: ' + (err.message || 'Unknown error'));
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        setSelectedFile(file);
        setFileName(file.name);
      }
    },
    multiple: false
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadMode === 'direct' && !selectedFile) return toast.error('Please select a file');
    if (uploadMode === 'link' && (!fileName || !fileUrl)) return toast.error('Please fill all fields');

    uploadDoc({
      jobId,
      fileName,
      fileUrl: uploadMode === 'link' ? fileUrl : undefined,
      file: uploadMode === 'direct' ? selectedFile! : undefined,
      docType: 'general'
    }, {
      onSuccess: () => {
        toast.success('Document uploaded successfully');
        setShowUpload(false);
        setFileName('');
        setFileUrl('');
        setSelectedFile(null);
      },
      onError: (err: any) => {
        toast.error('Upload failed: ' + (err.message || 'Unknown error'));
      }
    });
  };

  const handleStatusUpdate = (docId: string, status: 'approved' | 'rejected') => {
    if (status === 'rejected') {
      setActionDocId(docId);
      setActionType('reject');
      setRejectionReasonInput('');
    } else {
      updateStatus({ docId, status }, {
        onSuccess: () => {
          toast.success('Document marked as approved');
        }
      });
    }
  };

  const handleDelete = (docId: string) => {
    setActionDocId(docId);
    setActionType('delete');
  };

  return (
    <div className="space-y-6 relative overflow-hidden">
      
      {/* ── Document Preview Modal ── */}
      {previewDoc && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
           <div className="bg-card border border-border rounded-[2rem] w-full max-w-3xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-border flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground truncate max-w-xs">{previewDoc.file_name}</h3>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Digital Artifact Preview</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <button 
                     onClick={() => handleDownload(previewDoc.file_path, previewDoc.file_name)}
                     className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                     title="Download Original"
                   >
                     <Download size={20} />
                   </button>
                   <button 
                    onClick={() => setPreviewDoc(null)}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                   >
                     <XCircle size={24} />
                   </button>
                </div>
              </div>

              <div className="flex-1 bg-[#0A0F1E]/30 p-4 md:p-8 flex items-center justify-center min-h-[350px] max-h-[70vh] overflow-y-auto">
                {previewDoc?.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || previewDoc?.file_path?.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                  <img 
                    src={previewUrl} 
                    alt={previewDoc.file_name} 
                    className="max-h-[60vh] max-w-full object-contain rounded-2xl shadow-xl border border-border/10"
                  />
                ) : previewDoc?.file_name?.match(/\.pdf$/i) || previewDoc?.file_path?.match(/\.pdf/i) ? (
                  <iframe 
                    src={previewUrl}
                    className="w-full h-[60vh] border-none bg-white rounded-xl shadow-inner"
                    title={previewDoc.file_name}
                  />
                ) : (
                  <iframe 
                    src={previewUrl.startsWith('http') ? `https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true` : previewUrl}
                    className="w-full h-[60vh] border-none bg-white rounded-xl"
                    title="Document Preview"
                  />
                )}
              </div>
           </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-syne font-bold text-foreground">Document Vault</h3>
          <p className="text-xs text-muted-foreground">Secure artifact storage for this workflow</p>
        </div>
        {(isEmployee || isAdmin) && (
          <button 
            onClick={() => setShowUpload(true)}
            className="bg-primary text-[#0A0F1E] px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/10 transition-transform active:scale-95 flex items-center gap-2"
          >
            <UploadCloud size={16} /> New Upload
          </button>
        )}
      </div>

      {/* ── Upload Modal ── */}
      {showUpload && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-card border border-border rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-foreground">Upload Document</h3>
                  <p className="text-xs text-muted-foreground">Securely store project artifacts</p>
                </div>
                <button onClick={() => setShowUpload(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <XCircle size={24} />
                </button>
              </div>

              {/* Mode Toggle */}
              <div className="flex p-1 bg-muted rounded-xl mb-6">
                <button 
                  onClick={() => setUploadMode('direct')}
                  className={cn("flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all", uploadMode === 'direct' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground/60")}
                >
                  System File
                </button>
                <button 
                  onClick={() => setUploadMode('link')}
                  className={cn("flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all", uploadMode === 'link' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground/60")}
                >
                  Cloud Link
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                {uploadMode === 'direct' ? (
                  <div {...getRootProps()} className={cn(
                    "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
                    isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 bg-muted/30",
                    selectedFile && "border-emerald-500/50 bg-emerald-500/5"
                  )}>
                    <input {...getInputProps()} />
                    {selectedFile ? (
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
                          <FileText size={24} />
                        </div>
                        <p className="text-sm font-bold text-foreground truncate max-w-[200px] mx-auto">{selectedFile.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Click to change</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                          <UploadCloud size={24} />
                        </div>
                        <p className="text-sm font-bold text-foreground">Click or Drag File</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">PDF, Word, Images up to 10MB</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">Display Name</label>
                      <input 
                        type="text" 
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        placeholder="e.g. CR_Document.pdf"
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-gold outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">Public Link URL</label>
                      <input 
                        type="url" 
                        value={fileUrl}
                        onChange={(e) => setFileUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-gold outline-none"
                        required
                      />
                    </div>
                  </>
                )}
                
                <button 
                  type="submit" 
                  disabled={isPending}
                  className="w-full py-4 mt-6 rounded-xl bg-primary text-[#0A0F1E] text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/10 disabled:opacity-50"
                >
                  {isPending ? 'Processing Upload...' : uploadMode === 'direct' ? 'Start Vault Secure Upload' : 'Record Document Link'}
                </button>
              </form>
           </div>
        </div>
      )}

      {(() => {
        const clientDocs = documents.filter(d => 
          d.is_checklist_doc 
            ? (d.document_category !== 'output')
            : (d.uploaded_by_role === 'client')
        );
        const staffDocs = documents.filter(d => 
          d.is_checklist_doc 
            ? (d.document_category === 'output')
            : (d.uploaded_by_role !== 'client')
        );

        return (
          <div className="space-y-6">
            {/* Tab segments */}
            <div className="flex p-1 bg-muted/60 border border-border rounded-2xl max-w-md mb-2">
              <button
                onClick={() => setVaultTab('clientUploads')}
                className={cn(
                  "flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5",
                  vaultTab === 'clientUploads' 
                    ? "bg-primary text-white shadow-lg shadow-primary/20 border border-primary/10" 
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-white/5"
                )}
              >
                Client Requirements
              </button>
              <button
                onClick={() => setVaultTab('staffUploads')}
                className={cn(
                  "flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5",
                  vaultTab === 'staffUploads' 
                    ? "bg-primary text-white shadow-lg shadow-primary/20 border border-primary/10" 
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-white/5"
                )}
              >
                Issued Deliverables
              </button>
            </div>

            {(() => {
              const currentList = vaultTab === 'clientUploads' ? clientDocs : staffDocs;
              if (currentList.length > 0) {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {currentList.map((doc) => (
                      <div key={doc.id} className="bg-card border border-border rounded-2xl p-5 relative group overflow-hidden shadow-xl hover:border-gold/30 transition-colors flex flex-col justify-between min-h-[160px]">
                         <div>
                           {doc.status === 'rejected' && (
                             <div className="absolute top-0 left-0 right-0 bg-red-500/10 text-red-500 border-b border-red-500/20 px-3 py-1 text-[10px] uppercase font-bold tracking-widest text-center">
                               Rejected: {doc.rejection_reason}
                             </div>
                           )}

                           <div className={cn("flex items-start gap-4", doc.status === 'rejected' && "pt-6")}>
                             <div className="w-12 h-12 rounded-xl bg-white/5 text-primary flex items-center justify-center shrink-0">
                                <FileText size={20} />
                             </div>
                             <div className="flex-1 min-w-0">
                                 <p className="text-sm font-bold text-foreground truncate mb-1" title={doc.file_name}>{doc.file_name}</p>
                                 <p className="text-[10px] text-muted-foreground/60 truncate">Uploaded by {doc.uploaded_by_name}</p>
                                 {doc.is_checklist_doc && (
                                   <div className="flex flex-wrap gap-1 mt-1.5">
                                     <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-primary/15 text-primary border border-primary/10">
                                       {doc.document_type || 'Checklist file'}
                                     </span>
                                     {doc.applicant_name && (
                                       <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                                         👤 {doc.applicant_name}
                                       </span>
                                     )}
                                   </div>
                                 )}
                                <p className="text-[10px] text-muted-foreground/60">
                                  {doc.created_at || doc.uploaded_at ? new Date(doc.created_at || doc.uploaded_at).toLocaleString() : ''}
                                </p>
                             </div>
                           </div>
                         </div>

                         <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                            <span className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded", 
                              doc.status === 'approved' ? "bg-emerald-500/10 text-emerald-400" : 
                              doc.status === 'pending' ? "bg-amber-500/10 text-amber-500" : 
                              "bg-red-500/10 text-red-400"
                            )}>
                              {doc.status}
                            </span>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {(isAdmin || isEmployee) && doc.uploaded_by_role === 'client' && doc.status === 'pending' && (
                                  <>
                                    <button 
                                      onClick={() => handleStatusUpdate(doc.id, 'approved')}
                                      className="text-emerald-500 hover:text-emerald-400 p-1.5 transition-colors" 
                                      title="Approve Document"
                                    >
                                      <CheckCircle2 size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleStatusUpdate(doc.id, 'rejected')}
                                      className="text-muted-foreground hover:text-red-400 p-1.5 transition-colors" 
                                      title="Reject Document"
                                    >
                                      <XCircle size={14} />
                                    </button>
                                  </>
                                )}
                                <button 
                                 onClick={() => handlePreview(doc)}
                                 disabled={isLoadingPreview}
                                 className="text-muted-foreground hover:text-primary p-1.5 transition-colors disabled:opacity-50" 
                                 title="View Preview"
                                >
                                  <Eye size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDownload(doc.file_path, doc.file_name)}
                                  className="text-muted-foreground hover:text-foreground p-1.5 transition-colors" 
                                  title="Download"
                                >
                                  <Download size={14} />
                                </button>
                                {(isAdmin || isEmployee) && (
                                  <button 
                                    onClick={() => handleDelete(doc.id)}
                                    className="text-muted-foreground hover:text-red-400 p-1.5 transition-colors" 
                                    title="Delete"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                             </div>
                         </div>
                      </div>
                    ))}
                  </div>
                );
              } else {
                return (
                  <div className="py-24 text-center border-2 border-dashed border-border rounded-2xl bg-card">
                     <FileText size={48} className="mx-auto mb-4 text-muted-foreground/60 opacity-30" />
                     <p className="text-muted-foreground font-bold mb-2">Segment Empty</p>
                     <p className="text-xs text-muted-foreground/60 max-w-sm mx-auto">
                       {vaultTab === 'clientUploads' 
                         ? 'No client documents have been uploaded to this job pipeline yet.' 
                         : 'No staff deliverables or visa/CR documents have been uploaded to this vault yet.'}
                     </p>
                  </div>
                );
              }
            })()}
          </div>
        );
      })()}

      {/* ── Custom Reject Prompt Modal ── */}
      {actionType === 'reject' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-6">
            <div>
              <h4 className="text-lg font-bold text-foreground font-syne">Reject Document</h4>
              <p className="text-xs text-muted-foreground mt-1">Please provide the client with a detailed rejection reason so they can update it.</p>
            </div>
            
            <textarea
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              placeholder="e.g. Blurred photo, expired date, wrong document type..."
              className="w-full h-24 bg-muted/50 border border-border rounded-2xl p-4 text-xs text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary transition-all resize-none"
              rows={3}
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setActionType(null);
                  setActionDocId(null);
                  setRejectionReasonInput('');
                }}
                className="px-5 py-2.5 rounded-xl border border-border hover:bg-white/5 text-xs font-bold text-muted-foreground transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!rejectionReasonInput.trim()) return toast.error('Please enter a rejection reason');
                  if (actionDocId) {
                    updateStatus({ docId: actionDocId, status: 'rejected', rejectionReason: rejectionReasonInput }, {
                      onSuccess: () => {
                        toast.success('Document marked as rejected');
                        setActionType(null);
                        setActionDocId(null);
                        setRejectionReasonInput('');
                      }
                    });
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-red-500/10"
              >
                Reject Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Delete Confirm Modal ── */}
      {actionType === 'delete' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 mx-auto flex items-center justify-center mb-2">
                <AlertCircle size={24} />
              </div>
              <h4 className="text-base font-bold text-foreground font-syne">Purge Artifact?</h4>
              <p className="text-xs text-muted-foreground leading-normal px-2">
                Are you sure you want to permanently delete this document? This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setActionType(null);
                  setActionDocId(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-border hover:bg-white/5 text-xs font-bold text-muted-foreground transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (actionDocId) {
                    deleteDoc(actionDocId, {
                      onSuccess: () => {
                        toast.success('Artifact purged from system records');
                        setActionType(null);
                        setActionDocId(null);
                      }
                    });
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-red-500/10"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsTab;
