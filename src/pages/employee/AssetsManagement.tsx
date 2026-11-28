import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Barcode, Cpu, Laptop, Monitor, Phone, ShieldCheck, 
  Key, Armchair, HelpCircle, Building2, Plus, Search, 
  Filter, QrCode, UserCheck, RotateCcw, RefreshCw, 
  Printer, Layers, CheckCircle2, AlertTriangle, 
  FileText, ArrowRight, Eye, Calendar, DollarSign,
  PackageCheck, AlertCircle, Sparkles, Globe
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { 
  useAssets, 
  useAssetKits, 
  useAssetAssignmentsHistory, 
  type Asset, 
  type AssetCategory, 
  type AssetStatus 
} from '../../hooks/employee/useAssets';
import { AddAssetModal } from '../../components/employee/assets/AddAssetModal';
import { AssignAssetModal } from '../../components/employee/assets/AssignAssetModal';
import { ReturnAssetModal } from '../../components/employee/assets/ReturnAssetModal';
import { SwapAssetModal } from '../../components/employee/assets/SwapAssetModal';
import { AssetStickerModal } from '../../components/employee/assets/AssetStickerModal';
import { AssetCustodyVoucherModal } from '../../components/employee/assets/AssetCustodyVoucherModal';
import { CreateKitModal } from '../../components/employee/assets/CreateKitModal';
import { format } from 'date-fns';

const CATEGORY_ICONS: Record<AssetCategory, any> = {
  desktop_pc: Cpu,
  laptop: Laptop,
  monitor: Monitor,
  peripheral: HelpCircle,
  sim_mobile: Phone,
  pki_token: ShieldCheck,
  access_card: Key,
  furniture: Armchair,
  other: HelpCircle
};

export default function AssetsManagement() {
  const { profile } = useAuth();
  const { branches } = useBranch();

  // Active state filters
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(profile?.branch_id || null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'kits' | 'history'>('inventory');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [assigningAsset, setAssigningAsset] = useState<Asset | null>(null);
  const [returningAsset, setReturningAsset] = useState<Asset | null>(null);
  const [swappingAsset, setSwappingAsset] = useState<Asset | null>(null);
  const [stickerAsset, setStickerAsset] = useState<Asset | null>(null);
  const [isCreateKitOpen, setIsCreateKitOpen] = useState(false);
  const [custodyTarget, setCustodyTarget] = useState<{ employee: any; assignments: any[] } | null>(null);

  // Queries
  const { data: assets = [], isLoading: loadingAssets, refetch: refetchAssets } = useAssets({
    branchId: selectedBranchId,
    category: categoryFilter,
    status: statusFilter,
    search: searchQuery
  });

  const { data: allAssets = [] } = useAssets({
    branchId: selectedBranchId
  });

  const { data: kits = [], isLoading: loadingKits } = useAssetKits(selectedBranchId);
  const { data: historyLogs = [], isLoading: loadingHistory } = useAssetAssignmentsHistory();

  // KPI Calculations
  const totalCount = allAssets.length;
  const assignedCount = allAssets.filter(a => a.status === 'assigned').length;
  const inStockCount = allAssets.filter(a => a.status === 'in_stock').length;
  const maintenanceCount = allAssets.filter(a => a.status === 'in_repair' || a.status === 'damaged_lost').length;
  const totalAssetValue = allAssets.reduce((sum, a) => sum + (Number(a.purchase_cost) || 0), 0);

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
            <Building2 size={14} />
            <span>IT & Corporate Custody Management • إدارة العهدة والأصول</span>
          </div>
          <h1 className="text-3xl font-syne font-bold text-foreground flex items-center gap-3">
            <Barcode className="w-8 h-8 text-primary" /> Assets & Hardware Portal
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Permanent Asset Tags, Workstation Desk Kits, Handover Custody Vouchers, and QR Stickers
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsCreateKitOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-card border border-border hover:border-primary/40 text-foreground text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
          >
            <Layers size={16} className="text-primary" />
            <span>+ New Desk Kit</span>
          </button>

          <button
            onClick={() => {
              setEditingAsset(null);
              setIsAddOpen(true);
            }}
            className="px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-primary/25 font-black"
          >
            <Plus size={16} />
            <span>Register Asset</span>
          </button>
        </div>
      </div>

      {/* Branch Scope Pill Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card border border-border/80 p-4 rounded-3xl shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground pr-2">
            <Building2 size={15} className="text-primary" />
            <span>Branch Scope:</span>
          </div>
          <button
            onClick={() => setSelectedBranchId(null)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              !selectedBranchId
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 font-black'
                : 'bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Globe size={13} />
            <span>All Branches (Consolidated)</span>
          </button>

          {branches.filter(b => b.is_active).map(b => {
            const isSel = selectedBranchId === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBranchId(b.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  isSel
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 font-black'
                    : 'bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <span className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-mono font-bold ${
                  isSel ? 'bg-black/25 text-white' : 'bg-primary/15 text-primary'
                }`}>
                  {b.code.slice(0, 2)}
                </span>
                <span>{b.name}</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground font-mono">
          Total Valuation: <strong className="text-foreground font-bold">OMR {totalAssetValue.toFixed(3)}</strong>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Assets */}
        <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-1 relative overflow-hidden group">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest">Total Inventory</span>
            <Barcode size={18} className="text-primary" />
          </div>
          <p className="text-3xl font-black font-syne text-foreground">{totalCount}</p>
          <p className="text-xs text-muted-foreground">Permanent asset tags tracked</p>
        </div>

        {/* Assigned */}
        <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-1 relative overflow-hidden group">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">In Custody</span>
            <UserCheck size={18} className="text-emerald-400" />
          </div>
          <p className="text-3xl font-black font-syne text-emerald-400">{assignedCount}</p>
          <p className="text-xs text-muted-foreground">Assigned to active employees</p>
        </div>

        {/* Available in Stock */}
        <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-1 relative overflow-hidden group">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Available Stock</span>
            <PackageCheck size={18} className="text-blue-400" />
          </div>
          <p className="text-3xl font-black font-syne text-blue-400">{inStockCount}</p>
          <p className="text-xs text-muted-foreground">Ready for 1-click deployment</p>
        </div>

        {/* Maintenance / Lost */}
        <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-1 relative overflow-hidden group">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Repair / Lost</span>
            <AlertTriangle size={18} className="text-amber-400" />
          </div>
          <p className="text-3xl font-black font-syne text-amber-400">{maintenanceCount}</p>
          <p className="text-xs text-muted-foreground">Needs IT service or offboarded</p>
        </div>
      </div>

      {/* Master Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-1 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-5 py-3 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'inventory'
                ? 'bg-primary/10 text-primary border-b-2 border-primary font-black'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <Barcode size={15} /> All Hardware Inventory ({assets.length})
          </button>

          <button
            onClick={() => setActiveTab('kits')}
            className={`px-5 py-3 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'kits'
                ? 'bg-primary/10 text-primary border-b-2 border-primary font-black'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <Layers size={15} /> Workstation Desk Kits ({kits.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-5 py-3 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-primary/10 text-primary border-b-2 border-primary font-black'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <FileText size={15} /> Custody Handover Log ({historyLogs.length})
          </button>
        </div>
      </div>

      {/* ─── TAB 1: ALL HARDWARE INVENTORY ───────────────────────────────────── */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-3 rounded-2xl">
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter Dropdown */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-medium focus:border-primary outline-none"
              >
                <option value="all">All Categories</option>
                <option value="desktop_pc">Desktop PC</option>
                <option value="laptop">Laptop / MacBook</option>
                <option value="monitor">External Monitor</option>
                <option value="peripheral">Peripherals (Keyboard/Mouse)</option>
                <option value="sim_mobile">Corporate SIM / Mobile</option>
                <option value="pki_token">PRO PKI Token (Gov Dongle)</option>
                <option value="access_card">Office Keys / Access Cards</option>
                <option value="furniture">Furniture / Chair</option>
                <option value="other">Other Equipment</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-medium focus:border-primary outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="in_stock">Available in Stock</option>
                <option value="assigned">In Custody (Assigned)</option>
                <option value="in_repair">In IT Repair</option>
                <option value="damaged_lost">Damaged / Lost</option>
                <option value="decommissioned">Decommissioned</option>
              </select>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tag, serial, staff, model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Hardware Assets Table */}
          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <th className="px-5 py-4">Asset Tag / Label</th>
                    <th className="px-5 py-4">Item Details</th>
                    <th className="px-5 py-4">Branch Location</th>
                    <th className="px-5 py-4">Current Custodian</th>
                    <th className="px-5 py-4 text-center">Status</th>
                    <th className="px-5 py-4 text-center">Condition</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingAssets ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-xs text-muted-foreground">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        Loading asset inventory...
                      </td>
                    </tr>
                  ) : assets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-xs text-muted-foreground">
                        No hardware assets found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    assets.map((asset) => {
                      const CatIcon = CATEGORY_ICONS[asset.category] || HelpCircle;
                      return (
                        <tr key={asset.id} className="hover:bg-muted/10 transition-colors">
                          {/* Asset Tag & QR Button */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-primary px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
                                {asset.asset_tag}
                              </span>
                              <button
                                onClick={() => setStickerAsset(asset)}
                                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title="Print Physical QR Sticker"
                              >
                                <QrCode size={15} />
                              </button>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono block mt-1">
                              {asset.serial_number ? `S/N: ${asset.serial_number}` : 'No serial recorded'}
                            </span>
                          </td>

                          {/* Item Details */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-muted/30 border border-border flex items-center justify-center text-muted-foreground shrink-0">
                                <CatIcon size={16} />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-foreground text-xs truncate">{asset.name}</h4>
                                <p className="text-[10px] text-muted-foreground">
                                  {asset.brand || ''} {asset.model || ''} • {asset.category.replace('_', ' ').toUpperCase()}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Branch Location */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                              <Building2 size={13} className="text-muted-foreground" />
                              <span>{asset.branch?.name || 'Sultanate HQ'}</span>
                            </div>
                          </td>

                          {/* Current Custodian */}
                          <td className="px-5 py-4">
                            {asset.current_assignment?.employee ? (
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                  {asset.current_assignment.employee.avatar_url ? (
                                    <img src={asset.current_assignment.employee.avatar_url} alt="" className="w-full h-full rounded-lg object-cover" />
                                  ) : (
                                    asset.current_assignment.employee.full_name?.slice(0, 2).toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-foreground truncate">
                                    {asset.current_assignment.employee.full_name}
                                  </p>
                                  <span className="text-[9px] text-muted-foreground block font-mono">
                                    Since {format(new Date(asset.current_assignment.assigned_at), 'MMM d, yyyy')}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">In Storage</span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="px-5 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              asset.status === 'in_stock'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : asset.status === 'assigned'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : asset.status === 'in_repair'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {asset.status.replace('_', ' ')}
                            </span>
                          </td>

                          {/* Condition */}
                          <td className="px-5 py-4 text-center">
                            <span className="text-xs font-mono text-muted-foreground capitalize">
                              {asset.condition.replace('_', ' ')}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {asset.status === 'in_stock' ? (
                                <button
                                  onClick={() => setAssigningAsset(asset)}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white text-xs font-bold transition-all flex items-center gap-1"
                                >
                                  <UserCheck size={12} /> Assign
                                </button>
                              ) : asset.status === 'assigned' ? (
                                <>
                                  <button
                                    onClick={() => setSwappingAsset(asset)}
                                    className="px-2 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-xs font-bold transition-all flex items-center gap-1"
                                    title="1-Click Swap with Stock"
                                  >
                                    <RefreshCw size={12} /> Swap
                                  </button>
                                  <button
                                    onClick={() => setReturningAsset(asset)}
                                    className="px-2 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white text-xs font-bold transition-all flex items-center gap-1"
                                    title="Return to Stock"
                                  >
                                    <RotateCcw size={12} /> Return
                                  </button>
                                </>
                              ) : null}

                              <button
                                onClick={() => {
                                  setEditingAsset(asset);
                                  setIsAddOpen(true);
                                }}
                                className="px-2 py-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-all"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: WORKSTATION DESK KITS ────────────────────────────────────── */}
      {activeTab === 'kits' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {loadingKits ? (
              <div className="col-span-full py-10 text-center text-xs text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                Loading workstation bundles...
              </div>
            ) : kits.length === 0 ? (
              <div className="col-span-full p-12 rounded-3xl bg-card border border-border/60 text-center space-y-3">
                <Layers className="w-12 h-12 text-muted-foreground/40 mx-auto" />
                <h4 className="font-bold text-foreground text-base">No Desk Kits Configured Yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Group standard equipment (PC + Monitor + Keyboard + Mouse) into bundles for 1-click hire provisioning.
                </p>
                <button
                  onClick={() => setIsCreateKitOpen(true)}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
                >
                  Create First Desk Kit
                </button>
              </div>
            ) : (
              kits.map(kit => (
                <div key={kit.id} className="p-6 rounded-3xl bg-card border border-border hover:border-primary/40 transition-all shadow-sm space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-primary px-2.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                        {kit.kit_code}
                      </span>
                      <h4 className="font-bold text-foreground text-base mt-2">{kit.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{kit.description || 'Desk Kit Bundle'}</p>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {kit.items?.length || 0} items
                    </span>
                  </div>

                  {/* Included Items */}
                  <div className="space-y-1.5 pt-2 border-t border-border/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Kit Contents:
                    </span>
                    {(kit.items || []).map(item => (
                      <div key={item.id} className="p-2 rounded-xl bg-muted/20 border border-border/40 flex items-center justify-between text-xs">
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-primary">{item.asset_tag}</span>
                          <span className="font-medium text-foreground truncate">{item.name}</span>
                        </div>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                          item.status === 'in_stock' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: CUSTODY HANDOVER LOG ─────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-syne font-bold text-foreground text-base">Equipment Handover & Return Audit Trail</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Complete historical assignment tracking with condition verification</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <th className="px-5 py-4">Log Code</th>
                  <th className="px-5 py-4">Asset Tag / Hardware</th>
                  <th className="px-5 py-4">Staff Member</th>
                  <th className="px-5 py-4">Assigned At</th>
                  <th className="px-5 py-4">Status / Returned</th>
                  <th className="px-5 py-4">Conditions</th>
                  <th className="px-5 py-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-xs text-muted-foreground">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : historyLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-xs text-muted-foreground">
                      No assignment logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  historyLogs.map(log => (
                    <tr key={log.id} className="hover:bg-muted/10 transition-colors text-xs">
                      <td className="px-5 py-4 font-mono font-bold text-foreground">{log.assignment_code}</td>
                      <td className="px-5 py-4">
                        <span className="font-mono font-bold text-primary block">{log.asset?.asset_tag}</span>
                        <span className="text-foreground">{log.asset?.name}</span>
                      </td>
                      <td className="px-5 py-4 font-bold text-foreground">
                        {log.employee?.full_name || 'Staff Member'}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground font-mono text-[11px]">
                        {format(new Date(log.assigned_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-5 py-4">
                        {log.returned_at ? (
                          <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Returned
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                              {format(new Date(log.returned_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Active Custody
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[11px]">
                        <span>Handover: <strong className="capitalize text-foreground">{log.handover_condition}</strong></span>
                        {log.return_condition && (
                          <span className="block text-muted-foreground">Return: <strong className="capitalize text-foreground">{log.return_condition}</strong></span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground text-[11px] max-w-xs truncate">
                        {log.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddAssetModal
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          setEditingAsset(null);
        }}
        assetToEdit={editingAsset}
      />

      <AssignAssetModal
        isOpen={Boolean(assigningAsset)}
        onClose={() => setAssigningAsset(null)}
        asset={assigningAsset}
      />

      <ReturnAssetModal
        isOpen={Boolean(returningAsset)}
        onClose={() => setReturningAsset(null)}
        asset={returningAsset}
      />

      <SwapAssetModal
        isOpen={Boolean(swappingAsset)}
        onClose={() => setSwappingAsset(null)}
        asset={swappingAsset}
      />

      <AssetStickerModal
        isOpen={Boolean(stickerAsset)}
        onClose={() => setStickerAsset(null)}
        asset={stickerAsset}
      />

      <CreateKitModal
        isOpen={isCreateKitOpen}
        onClose={() => setIsCreateKitOpen(false)}
      />

      {custodyTarget && (
        <AssetCustodyVoucherModal
          isOpen={Boolean(custodyTarget)}
          onClose={() => setCustodyTarget(null)}
          employee={custodyTarget.employee}
          assignments={custodyTarget.assignments}
        />
      )}
    </div>
  );
}
