import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, QrCode, Download, Building2 } from 'lucide-react';
import { type Asset } from '../../../hooks/employee/useAssets';

interface AssetStickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
}

export const AssetStickerModal: React.FC<AssetStickerModalProps> = ({
  isOpen,
  onClose,
  asset
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !asset) return null;

  const handlePrint = () => {
    window.print();
  };

  // QR Code URL pointing to quick-lookup in portal
  const qrData = `${window.location.origin}/employee/assets?lookup=${asset.asset_tag}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(qrData)}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col"
        >
          {/* Header */}
          <div className="p-5 border-b border-border flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary font-bold">
                <QrCode size={18} />
              </div>
              <div>
                <h3 className="font-syne font-bold text-foreground text-base">Print Asset Label</h3>
                <p className="text-[11px] text-muted-foreground">Permanent hardware QR sticker</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* The Printable Label Preview */}
            <div 
              ref={printRef}
              className="bg-white text-black p-5 rounded-2xl border-2 border-dashed border-gray-300 shadow-sm flex items-center justify-between gap-4 font-sans select-none max-w-[380px] mx-auto print:m-0 print:border-none print:shadow-none"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-black text-white text-[8px] font-black flex items-center justify-center">
                    O
                  </div>
                  <span className="text-[10px] font-black tracking-widest uppercase text-gray-800">
                    OSBIC OMAN
                  </span>
                </div>
                
                <h2 className="text-xl font-mono font-black text-black tracking-wider leading-none">
                  {asset.asset_tag}
                </h2>
                
                <p className="text-[11px] font-bold text-gray-900 truncate">
                  {asset.name}
                </p>

                <div className="text-[9px] text-gray-600 font-mono space-y-0.5">
                  {asset.serial_number && (
                    <p className="truncate">S/N: {asset.serial_number}</p>
                  )}
                  <p>{asset.branch?.name || 'Sultanate HQ'} • {asset.category.replace('_', ' ').toUpperCase()}</p>
                </div>
              </div>

              {/* QR Code */}
              <div className="shrink-0 p-1 bg-white border border-gray-300 rounded-lg">
                <img 
                  src={qrCodeUrl} 
                  alt={asset.asset_tag}
                  className="w-24 h-24 object-contain"
                />
              </div>
            </div>

            <p className="text-[11px] text-center text-muted-foreground">
              Stick this label on the back or bottom of the equipment. Scan with camera to look up details or reassign instantly.
            </p>

            {/* Actions */}
            <div className="pt-2 border-t border-border flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md shadow-primary/20 flex items-center gap-2"
              >
                <Printer size={15} /> Print Physical Label
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
