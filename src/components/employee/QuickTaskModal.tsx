import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, DollarSign, User, FileText, Phone, Activity, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export const QuickTaskModal = ({ isOpen, onClose, onJobCreated }: { isOpen: boolean, onClose: () => void, onJobCreated: () => void }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    description: '',
    amount: '',
    paymentMethod: 'cash',
    status: 'completed'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;

    setLoading(true);
    try {
      // Call the RPC function we created in the migration
      const { data, error } = await (supabase.rpc as any)('create_quick_task', {
        p_employee_id: profile?.id,
        p_task_description: formData.description,
        p_amount: parseFloat(formData.amount),
        p_payment_method: formData.paymentMethod,
        p_customer_name: formData.customerName || null,
        p_customer_phone: formData.customerPhone || null,
        p_status: formData.status
      });

      if (error) throw error;
      
      // Reset and close
      setFormData({ customerName: '', customerPhone: '', description: '', amount: '', paymentMethod: 'cash', status: 'completed' });
      onJobCreated();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to create Quick Task. Please ensure the backend SQL migration was run.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-8 bg-black/50 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="w-full max-w-md bg-card rounded-[2rem] overflow-hidden shadow-2xl relative border border-border"
          >
            <div className="absolute top-4 right-4 z-50">
               <button 
                 onClick={onClose}
                 className="p-2 bg-muted/50 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
               >
                 <X size={16} />
               </button>
            </div>
            
            <div className="p-8">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6">
                <Zap size={24} />
              </div>
              <h2 className="text-2xl font-syne font-bold mb-1 text-foreground">Quick Task (POS)</h2>
              <p className="text-sm text-muted-foreground mb-8">Fast-track walk-in customers and simple jobs.</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><User size={12}/> Walk-in Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Ahmed Ali"
                      value={formData.customerName}
                      onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full bg-muted/30 border border-border text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><Phone size={12}/> Phone (WhatsApp)</label>
                    <input
                      type="tel"
                      placeholder="e.g. 968 1234 5678"
                      value={formData.customerPhone}
                      onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                      className="w-full bg-muted/30 border border-border text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><FileText size={12}/> Task Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Document Typing"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-muted/30 border border-border text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><DollarSign size={12}/> Amount (OMR)</label>
                    <input
                      type="number"
                      required
                      min="0.1"
                      step="0.001"
                      placeholder="0.000"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full bg-muted/30 border border-border text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><CreditCard size={12}/> Payment Method</label>
                    <select
                      value={formData.paymentMethod}
                      onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                      className="w-full bg-muted/30 border border-border text-foreground rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-colors"
                    >
                      <option value="cash">Cash</option>
                      <option value="pos">POS / Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="online">Online Link</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><Activity size={12}/> Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-muted/30 border border-border text-foreground rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-colors font-bold"
                  >
                    <option value="draft">Draft (Payment Pending)</option>
                    <option value="active">Active (In Progress)</option>
                    <option value="completed">Completed (Done & Paid)</option>
                  </select>
                  {formData.status !== 'completed' && (
                    <p className="text-xs text-amber-500 mt-2 font-medium">Note: Payment will NOT be logged until status is Completed.</p>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 py-4 bg-amber-500 text-amber-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-colors flex items-center justify-center gap-2 uppercase tracking-widest text-sm disabled:opacity-50"
                >
                  {loading ? 'Processing...' : (
                    <>
                      <Zap size={18} /> 
                      {formData.status === 'completed' ? 'Complete Quick Task' : `Save as ${formData.status}`}
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
