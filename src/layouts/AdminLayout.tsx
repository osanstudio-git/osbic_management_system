import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AdminSidebar from '../components/admin/AdminSidebar';
import AdminTopBar from '../components/admin/AdminTopBar';
import KBarWrapper from '../components/admin/KBarWrapper';
import { GlobalNotificationListener } from '../components/shared/GlobalNotificationListener';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { supabase } from '../lib/supabase';

const AdminLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { i18n } = useTranslation();
  const location = useLocation();
  const { profile } = useAuth();
  const isRtl = i18n.dir() === 'rtl';

  useRealtime(profile?.id);

  useEffect(() => {
    const syncDatabaseServiceFees = async () => {
      // Use version v5 flag to force a run immediately for layouts
      if (localStorage.getItem('osan_fees_synced_v5') === 'true') return;
      
      console.log('Admin session initialized. Synchronizing default & actual services fees...');
      const servicesToUpdate = [
        { id: 'b28c89de-0e0e-473d-9d41-9a74288b8e01', name: 'KYC', ministry_fee: 0, timeline: 1 },
        { id: 'b28c89de-0e0e-473d-9d41-9a74288b8e02', name: 'CR Registration', ministry_fee: 81.3, timeline: 2 },
        { id: 'b28c89de-0e0e-473d-9d41-9a74288b8e03', name: 'OCCI', ministry_fee: 0, timeline: 1 },
        { id: 'b28c89de-0e0e-473d-9d41-9a74288b8e04', name: 'Activity License', ministry_fee: 78.5, timeline: 1 },
        { id: 'b28c89de-0e0e-473d-9d41-9a74288b8e05', name: 'Feasibility Study', ministry_fee: 25, timeline: 1 },
        { id: 'b28c89de-0e0e-473d-9d41-9a74288b8e06', name: 'Tax Card', ministry_fee: 10, timeline: 2 },
        { id: 'b28c89de-0e0e-473d-9d41-9a74288b8e07', name: 'Investment License', ministry_fee: 0.9, timeline: 4 },
        { id: 'b28c89de-0e0e-473d-9d41-9a74288b8e08', name: 'Authorization', ministry_fee: 0, timeline: 1 },
        { id: 'b28c89de-0e0e-473d-9d41-9a74288b8e09', name: 'Medical Attestation', ministry_fee: 5, timeline: 1 },
        { id: 'b28c89de-0e0e-473d-9d41-9a74288b8e10', name: 'Clearance for Visa', ministry_fee: 316, timeline: 4 },
        { id: 'b28c89de-0e0e-473d-9d41-9a74288b8e11', name: 'Visa Processing', ministry_fee: 20, timeline: 5 },
        { id: 'b28c89de-0e0e-473d-9d41-9a74288b8e12', name: 'Medical', ministry_fee: 30, timeline: 2 }
      ];

      try {
        for (const s of servicesToUpdate) {
          const { error } = await supabase
            .from('services')
            .update({
              default_ministry_fee: s.ministry_fee,
              ministry_fee: s.ministry_fee,
              default_work_fee: 0.000,
              work_fee: 0.000,
              estimated_days: s.timeline
            })
            .eq('id', s.id);
            
          if (error) console.error(`Failed to sync ${s.name}:`, error.message);
        }
        localStorage.setItem('osan_fees_synced_v5', 'true');
        console.log('Services fees synchronization complete.');
      } catch (err) {
        console.error('Failed to sync service fees:', err);
      }
    };
    
    syncDatabaseServiceFees();
  }, []);

  return (
    <KBarWrapper>
      <GlobalNotificationListener />
      <div className="flex h-screen w-full bg-background overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
        <AdminSidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
        
        <div className="flex-1 flex flex-col h-full overflow-hidden relative w-full max-w-full">
          <AdminTopBar setMobileMenuOpen={setMobileMenuOpen} />
          
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 scroll-smooth lg:px-12 w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="h-full max-w-[1600px] mx-auto"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </KBarWrapper>
  );
};

export default AdminLayout;
