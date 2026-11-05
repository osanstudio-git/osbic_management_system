import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChatRooms, useChatMessages, useSendChatMessage, useCreateDirectChat, useCreateGroupChat, useMarkChatRead } from '../../hooks/shared/useChat';
import { useTranslation } from 'react-i18next';
import { Search, Plus, MessageSquare, Users, User, Send, Hash, Settings, X, Loader2, Paperclip, Image as ImageIcon, Eye, Download, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useAdminJobs, useEmployeeJobs, useJobDetail } from '../../hooks/shared/useJobs';
import MessagesTab from '../../components/jobs/MessagesTab';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function EmployeeMessages() {
  const { profile } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'team' | 'clients'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showNewChat, setShowNewChat] = useState(false);

  const { data: rooms = [], isLoading: loadingRooms } = useChatRooms();
  const { data: messages = [], isLoading: loadingMessages } = useChatMessages(activeChatId);
  const sendMutation = useSendChatMessage();
  const markReadMutation = useMarkChatRead();

  // Employees always see only their own assigned jobs, regardless of manager status
  const { data: jobs, isLoading: loadingJobs } = useEmployeeJobs(profile?.id || '');

  const { data: jobDetail } = useJobDetail(selectedJobId || '');

  // Fetch latest message for each job to support sorting and snippets
  const { data: latestJobMessages = {} } = useQuery({
    queryKey: ['employee_jobs_latest_messages', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('job_id, created_at, content, sender_id, is_read, conversation_scope, sender:profiles!messages_sender_id_fkey(full_name)')
        .eq('conversation_scope', 'staff_client')
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      const mapping: Record<string, any> = {};
      (data || []).forEach((m: any) => {
        if (!mapping[m.job_id]) {
          mapping[m.job_id] = { ...m, sender_name: m.sender?.full_name ?? 'Unknown' };
        }
      });
      return mapping;
    },
    enabled: !!profile?.id
  });

  const sortedJobs = useMemo(() => {
    if (!jobs) return [];
    
    // Filter by search query if any
    let result = jobs;
    if (searchQuery) {
      result = jobs.filter(j => 
        j.service_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.job_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return [...result].sort((a, b) => {
      const aMsg = latestJobMessages[a.id];
      const bMsg = latestJobMessages[b.id];
      
      const aTime = aMsg ? new Date(aMsg.created_at).getTime() : 0;
      const bTime = bMsg ? new Date(bMsg.created_at).getTime() : 0;
      
      if (aTime || bTime) {
        return bTime - aTime;
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [jobs, latestJobMessages, searchQuery]);

  const [messageInput, setMessageInput] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Automatically mark as read when switching chats
  React.useEffect(() => {
    if (activeChatId) {
      markReadMutation.mutate(activeChatId);
    }
  }, [activeChatId, messages.length]);

  const activeRoom = rooms.find((r: any) => r.id === activeChatId);

  const filteredRooms = rooms.filter((r: any) => {
    if (filter === 'team' && !r.is_team) return false;
    if (filter === 'clients' && !r.is_client) return false;
    if (searchQuery) {
      const match = r.display_name?.toLowerCase().includes(searchQuery.toLowerCase());
      return match;
    }
    return true;
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageInput.trim() && !attachmentFile) || !activeChatId) return;
    
    setIsUploading(true);
    let filePath = '';
    let fileName = '';
    
    try {
      if (attachmentFile) {
        const fileExt = attachmentFile.name.split('.').pop();
        fileName = attachmentFile.name;
        filePath = `chat_attachments/${activeChatId}_${Date.now()}.${fileExt}`;
        
        const { error: storageError } = await supabase.storage.from('documents').upload(filePath, attachmentFile);
        if (storageError) throw storageError;
      }
      
      let finalContent = messageInput.trim();
      if (filePath) {
        const type = attachmentFile?.type.startsWith('image/') ? 'IMAGE' : 'ATTACHMENT';
        const attachmentStr = `[${type}:${filePath}|${fileName}]`;
        finalContent = finalContent ? `${attachmentStr}\n${finalContent}` : attachmentStr;
      }

      await sendMutation.mutateAsync({ chatId: activeChatId, content: finalContent });
      setMessageInput('');
      setAttachmentFile(null);
    } catch (err: any) {
      toast.error('Failed to send message');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewAttachment = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(filePath, 3600);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      toast.error('Could not open document.');
    }
  };

  const handleDownloadAttachment = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(filePath);
      if (error) throw error;
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Download failed');
    }
  };

  const renderMessageContent = (content: string, isMe: boolean) => {
    const matchAttr = content.match(/\[(IMAGE|ATTACHMENT):([^|]+)\|([^\]]+)\]/);
    if (matchAttr) {
      const [fullMatch, type, path, name] = matchAttr;
      const text = content.replace(fullMatch, '').trim();
      return (
        <div className="flex flex-col gap-2">
          <div className={`p-2 rounded-lg border flex items-center gap-2 w-fit max-w-[200px] sm:max-w-[250px] ${
            isMe ? 'bg-primary-foreground/10 border-primary-foreground/20' : 'bg-background border-border'
          }`}>
            <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${isMe ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
              {type === 'IMAGE' ? <ImageIcon size={14} /> : <Paperclip size={14} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold truncate">{name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <button 
                  onClick={() => handleViewAttachment(path)}
                  className="text-[9px] flex items-center gap-1 uppercase tracking-widest hover:underline opacity-80"
                >
                  <Eye size={10} /> View
                </button>
                <button 
                  onClick={() => handleDownloadAttachment(path, name)}
                  className="text-[9px] flex items-center gap-1 uppercase tracking-widest hover:underline opacity-80"
                >
                  <Download size={10} /> Download
                </button>
              </div>
            </div>
          </div>
          {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
        </div>
      );
    }
    return <p className="text-sm whitespace-pre-wrap">{content}</p>;
  };

  return (
    <div className="h-full flex overflow-hidden bg-background">
      {/* ── Sidebar: Chat List ── */}
      <div className={`w-full md:w-[450px] shrink-0 border-r border-border flex-col bg-card/50 ${activeChatId || selectedJobId ? 'hidden md:flex' : 'flex'} font-sans`}>
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-syne font-bold text-foreground">{isRtl ? 'الرسائل' : 'Messages'}</h1>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowNewChat(true)}
                className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all"
                title={isRtl ? 'رسالة جديدة' : 'New Message'}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="relative mb-4">
            <Search size={18} className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
            <input 
              type="text"
              placeholder={isRtl ? 'البحث في المحادثات...' : 'Search conversations...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-background border border-border rounded-xl py-2 ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-sm focus:outline-none focus:border-primary/50 transition-colors`}
            />
          </div>

          <div className="flex gap-2">
            {(['all', 'team', 'clients'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                  filter === f 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f === 'all' ? (isRtl ? 'الكل' : 'All') : f === 'team' ? (isRtl ? 'الفريق' : 'Team') : (isRtl ? 'العملاء' : 'Clients')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1">
          {filter === 'clients' ? (
            loadingJobs ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : !sortedJobs || sortedJobs.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm p-8">
                {isRtl ? 'لا توجد قضايا عملاء نشطة.' : 'No active client cases.'}
              </div>
            ) : (
              sortedJobs.map((jb: any) => {
                const isSelected = selectedJobId === jb.id;
                const isUnread = latestJobMessages[jb.id] && latestJobMessages[jb.id].sender_id !== profile?.id && !latestJobMessages[jb.id].is_read;
                
                return (
                  <button
                    key={jb.id}
                    onClick={() => {
                      setSelectedJobId(jb.id);
                      setActiveChatId(null);
                    }}
                    className={`w-full ${isRtl ? 'text-right' : 'text-left'} p-3.5 rounded-xl transition-all flex gap-3 border ${
                      isSelected 
                        ? 'bg-primary/10 border-primary/20 shadow-sm' 
                        : (isUnread ? 'bg-primary/[0.04] border-primary/40 shadow-sm' : 'border-transparent hover:bg-muted/50')
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                        <MessageSquare size={20} />
                      </div>
                      {isUnread && (
                        <div className={`absolute -top-0.5 ${isRtl ? '-left-0.5' : '-right-0.5'} w-3.5 h-3.5 bg-red-500 rounded-full border border-card flex items-center justify-center`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className={cn("text-sm text-foreground truncate", isUnread ? "font-extrabold" : "font-bold")}>
                            {jb.client_name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {latestJobMessages[jb.id] && (
                            <span className={cn("font-mono text-[8px]", isUnread ? "text-primary font-bold" : "text-muted-foreground/40")}>
                              {new Date(latestJobMessages[jb.id].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider bg-muted text-muted-foreground border border-border">
                            {jb.job_code}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground/60 truncate font-semibold">
                        {isRtl ? 'الخدمة: ' : 'Service: '}{jb.service_name}
                      </p>
                      
                      {latestJobMessages[jb.id] ? (
                        <p className={cn("text-xs truncate my-1.5 font-medium bg-muted/20 px-2.5 py-1 rounded-lg border", isUnread ? "text-foreground border-primary/20 bg-primary/5 font-semibold animate-pulse" : "text-muted-foreground/60 border-border/30")}>
                          <span className={cn(isRtl ? "ml-1" : "mr-1", isUnread ? "font-black text-primary" : "font-bold text-primary")}>
                            {latestJobMessages[jb.id].sender_id === profile?.id ? (isRtl ? 'أنت' : 'You') : latestJobMessages[jb.id].sender_name}:
                          </span>
                          {latestJobMessages[jb.id].content}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/40 italic my-1.5">{isRtl ? 'لا توجد رسائل بعد' : 'No messages yet'}</p>
                      )}

                      <div className="flex items-center gap-1.5">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest border ${
                          jb.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          jb.status === 'active' || jb.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          jb.status === 'draft' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                          'bg-muted text-muted-foreground border-border'
                        }`}>
                          {jb.status === 'completed' ? (isRtl ? 'مكتمل' : 'Completed') :
                           jb.status === 'active' || jb.status === 'in_progress' ? (isRtl ? 'قيد التنفيذ' : 'In Progress') :
                           jb.status === 'draft' ? (isRtl ? 'مسودة' : 'Draft') : jb.status}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )
          ) : (
            loadingRooms ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm p-8">
                {isRtl ? 'لم يتم العثور على محادثات.' : 'No conversations found.'}
              </div>
            ) : (
              filteredRooms.map((room: any) => (
                <button
                  key={room.id}
                  onClick={() => {
                    setActiveChatId(room.id);
                    setSelectedJobId(null);
                  }}
                  className={`w-full ${isRtl ? 'text-right' : 'text-left'} p-3 rounded-xl transition-all flex gap-3 ${
                    activeChatId === room.id 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'hover:bg-muted/50 border border-transparent'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${room.type === 'group' ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground'}`}>
                      {room.display_avatar ? (
                        <img src={room.display_avatar} alt="avatar" className="w-full h-full rounded-full object-cover" />
                      ) : room.type === 'group' ? (
                        <Hash size={20} />
                      ) : (
                        <User size={20} />
                      )}
                    </div>
                    {room.has_unread && (
                      <div className={`absolute top-0 ${isRtl ? 'left-0' : 'right-0'} w-3 h-3 bg-red-500 rounded-full border-2 border-card`}></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-bold text-sm text-foreground truncate">{room.display_name}</h3>
                      {room.last_message && (
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {format(new Date(room.last_message.created_at), 'hh:mm a')}
                        </span>
                      )}
                    </div>
                    {room.last_message ? (
                      <p className={`text-xs truncate ${room.has_unread ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                        {room.last_message.sender_id === profile?.id ? (isRtl ? 'أنت: ' : 'You: ') : ''}
                        {room.last_message.content}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">{isRtl ? 'لا توجد رسائل بعد' : 'No messages yet'}</p>
                    )}
                  </div>
                </button>
              ))
            )
          )}
        </div>
      </div>

      {/* ── Main Area: Chat Window ── */}
      <div className={`flex-1 flex-col bg-background relative ${activeChatId || selectedJobId ? 'flex' : 'hidden md:flex'} font-sans`}>
        {selectedJobId && jobDetail ? (
          <div className="flex-1 flex flex-col h-full bg-card overflow-hidden">
            <div className="md:hidden p-4 border-b border-border flex items-center gap-3">
               <button onClick={() => setSelectedJobId(null)} className={`p-2 ${isRtl ? '-mr-2 ml-0' : '-ml-2 mr-0'} hover:bg-muted rounded-full`}>
                  <ArrowLeft size={20} className={isRtl ? 'rotate-180' : ''} />
               </button>
               <span className="font-bold text-sm">{isRtl ? 'العودة إلى الرسائل' : 'Back to Messages'}</span>
            </div>
            <MessagesTab jobId={selectedJobId} messages={jobDetail.messages || []} isAdmin={false} currentUserType="employee" scope="staff_client" />
          </div>
        ) : activeChatId && activeRoom ? (
          <>
            <div className="h-20 border-b border-border bg-card/50 flex items-center justify-between px-4 md:px-8 shrink-0">
              <div className="flex items-center gap-2 md:gap-4">
                <button 
                  onClick={() => setActiveChatId(null)} 
                  className="md:hidden p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground"
                >
                  <ArrowLeft size={20} className={isRtl ? 'rotate-180' : ''} />
                </button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeRoom.type === 'group' ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground'}`}>
                   {activeRoom.display_avatar ? (
                      <img src={activeRoom.display_avatar} alt="avatar" className="w-full h-full rounded-full object-cover" />
                    ) : activeRoom.type === 'group' ? (
                      <Hash size={18} />
                    ) : (
                      <User size={18} />
                    )}
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-start">{activeRoom.display_name}</h2>
                  <p className="text-xs text-muted-foreground text-start">
                    {activeRoom.type === 'group' 
                      ? `${activeRoom.participants.length} ${isRtl ? 'أعضاء' : 'members'}` 
                      : activeRoom.other_participants[0]?.profiles?.role}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors">
                  <Settings size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 flex flex-col">
              {loadingMessages ? (
                <div className="m-auto"><Loader2 className="animate-spin text-primary" /></div>
              ) : messages.length === 0 ? (
                <div className="m-auto text-center">
                  <MessageSquare size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">{isRtl ? 'ابدأ المحادثة' : 'Start the conversation'}</p>
                </div>
              ) : (
                messages.map((msg: any) => {
                  const isMe = msg.sender_id === profile?.id;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-end gap-2 max-w-[70%]">
                        {!isMe && activeRoom.type === 'group' && (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mb-5">
                            {msg.sender?.avatar_url ? (
                              <img src={msg.sender.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <User size={14} className="text-muted-foreground" />
                            )}
                          </div>
                        )}
                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && activeRoom.type === 'group' && (
                            <span className="text-[10px] text-muted-foreground ml-1 mb-1">{msg.sender?.full_name}</span>
                          )}
                          <div className={`p-3 rounded-2xl ${
                            isMe 
                              ? 'bg-primary text-primary-foreground rounded-br-sm' 
                              : 'bg-card border border-border text-foreground rounded-bl-sm'
                          }`}>
                            {renderMessageContent(msg.content, isMe)}
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1 mx-1">
                            {format(new Date(msg.created_at), 'hh:mm a')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-6 bg-card/50 border-t border-border shrink-0">
              {attachmentFile && (
                <div className="mb-3 flex items-center gap-2 p-2 bg-muted/50 rounded-lg w-fit border border-border">
                  <div className="w-8 h-8 bg-card rounded flex items-center justify-center">
                    {attachmentFile.type.startsWith('image/') ? <ImageIcon size={14} className="text-primary" /> : <Paperclip size={14} className="text-primary" />}
                  </div>
                  <div className="flex flex-col mr-4">
                    <span className="text-xs font-bold text-foreground max-w-[150px] truncate">{attachmentFile.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{(attachmentFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <button onClick={() => setAttachmentFile(null)} className="p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground">
                    <X size={14} />
                  </button>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="relative flex gap-2">
                <label className="shrink-0 w-12 h-12 bg-background border border-border rounded-full flex items-center justify-center cursor-pointer hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shadow-sm">
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={e => setAttachmentFile(e.target.files?.[0] || null)}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  />
                  <Paperclip size={18} />
                </label>
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={isRtl ? 'اكتب رسالة...' : 'Type a message...'}
                    className={`w-full bg-background border border-border rounded-full py-3.5 ${isRtl ? 'pr-6 pl-14' : 'pl-6 pr-14'} text-sm focus:outline-none focus:border-primary/50 transition-colors shadow-sm h-12`}
                  />
                  <button 
                    type="submit"
                    disabled={(!messageInput.trim() && !attachmentFile) || sendMutation.isPending || isUploading}
                    className={`absolute ${isRtl ? 'left-1' : 'right-1'} top-1 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:brightness-110 transition-all disabled:opacity-50 disabled:hover:brightness-100`}
                  >
                    {(sendMutation.isPending || isUploading) ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className={isRtl ? 'rotate-180' : ''} />}
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="m-auto text-center max-w-sm">
            <div className="w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-6">
              <MessageSquare size={40} className="text-primary/40" />
            </div>
            <h2 className="text-2xl font-syne font-bold text-foreground mb-2">{isRtl ? 'رسائلك' : 'Your Messages'}</h2>
            <p className="text-muted-foreground">{isRtl ? 'اختر محادثة من الشريط الجانبي أو ابدأ محادثة جديدة للتواصل مع فريقك وعملائك.' : 'Select a conversation from the sidebar or start a new one to connect with your team and clients.'}</p>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <NewChatModal 
          onClose={() => setShowNewChat(false)} 
          onSuccess={(chatId) => {
            setShowNewChat(false);
            setActiveChatId(chatId);
          }}
        />
      )}
    </div>
  );
}

// ─── New Chat Modal Subcomponent ──────────────────────────────────────────────

function NewChatModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: (id: string) => void }) {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const createDirect = useCreateDirectChat();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['all_users_for_chat', search, profile?.id],
    queryFn: async () => {
      let q = (supabase as any).from('profiles').select('id, full_name, email, role, avatar_url').neq('id', profile?.id);
      if (search) {
        q = q.ilike('full_name', `%${search}%`);
      }
      const { data, error } = await q.limit(30);
      if (error) console.error(error);
      return data || [];
    }
  });

  const handleCreate = async () => {
    if (!selectedId) return;
    try {
      const chatId = await createDirect.mutateAsync(selectedId);
      onSuccess(chatId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create conversation');
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-card w-full max-w-md rounded-3xl border border-border shadow-2xl flex flex-col font-sans" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20 shrink-0">
          <h2 className="text-lg font-bold font-syne">{isRtl ? 'رسالة جديدة' : 'New Message'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 overflow-y-auto no-scrollbar flex-1 flex flex-col gap-6">
          <div className="flex-1 min-h-[200px] flex flex-col">
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2 text-start">
              {isRtl ? 'اختر المستخدم' : 'Select User'}
            </label>
            <div className="relative mb-3">
              <Search size={16} className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
              <input 
                type="text" 
                placeholder={isRtl ? 'البحث بالاسم...' : 'Search by name...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`w-full bg-background border border-border rounded-xl py-2 ${isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'} text-sm focus:outline-none focus:border-primary/50`}
              />
            </div>
            
            <div className="space-y-2 overflow-y-auto flex-1">
              {isLoading ? (
                <div className="flex justify-center p-4"><Loader2 className="animate-spin text-primary" size={20} /></div>
              ) : users.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-4">{isRtl ? 'لم يتم العثور على مستخدمين' : 'No users found'}</div>
              ) : (
                users.map((user: any) => {
                  const isSelected = selectedId === user.id;
                  return (
                    <button
                      key={user.id}
                      onClick={() => setSelectedId(user.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border ${isRtl ? 'text-right' : 'text-left'} transition-all ${
                        isSelected ? 'bg-primary/5 border-primary/30' : 'bg-card border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        {user.avatar_url ? (
                           <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                           <User size={16} className="text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-foreground">{user.full_name || (isRtl ? 'مستخدم بدون اسم' : 'Unnamed User')}</div>
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">{user.role === 'admin' ? (isRtl ? 'مسؤول' : 'admin') : user.role === 'employee' ? (isRtl ? 'موظف' : 'employee') : user.role}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-border bg-muted/20 shrink-0">
          <button 
            onClick={handleCreate}
            disabled={!selectedId || createDirect.isPending}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createDirect.isPending ? <Loader2 className="animate-spin" size={20} /> : null}
            {isRtl ? 'بدء المحادثة' : 'Start Conversation'}
          </button>
        </div>
      </div>
    </div>
  );
}
