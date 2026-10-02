import React, { useState } from 'react';
import { Plus, Coins, ArrowUpRight, ArrowDownRight, History, Trash2, Edit2, Calendar, Filter, Sparkles } from 'lucide-react';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { GroupFilterBar } from '../common/GroupFilterBar';
import { db } from '../../db/db';
import { formatTRY, formatNumber, parseUserInputNumber, formatForInput } from '../../services/portfolioService';
import type { Account, AssetTransaction, MarketRate, Group, AssetSubType } from '../../types/finance';

interface GoldTrackerProps {
  groups: Group[];
  accounts: Account[];
  transactions: AssetTransaction[];
  rates: MarketRate[];
  hideValues: boolean;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

type GoldTypeTab = 'BANK_GRAM' | 'PHYSICAL_GRAM' | 'CEYREK' | 'YARIM' | 'TAM' | 'CUMHURIYET';
type HistoryFilter = 'ALL' | '1M' | '3M' | '6M' | 'THIS_YEAR' | 'PREV_YEAR';

export const GoldTracker: React.FC<GoldTrackerProps> = ({
  groups,
  accounts,
  transactions,
  rates,
  hideValues
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [activeGoldType, setActiveGoldType] = useState<GoldTypeTab>('BANK_GRAM');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ALL');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('ALL');
  const [historyYearFilter, setHistoryYearFilter] = useState<string>('ALL');
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');
  const [historyPage, setHistoryPage] = useState<number>(1);
  const itemsPerPage = 10;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  // New Transaction Form
  const [targetGroupId, setTargetGroupId] = useState<string>(groups[0]?.id || '');
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [txType, setTxType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('');
  const [totalTRY, setTotalTRY] = useState('');
  const [unitTRY, setUnitTRY] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  // Edit Transaction Form State
  const [editingTx, setEditingTx] = useState<AssetTransaction | null>(null);
  const [editTxType, setEditTxType] = useState<'BUY' | 'SELL'>('BUY');
  const [editGroupId, setEditGroupId] = useState<string>('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editTotalTRY, setEditTotalTRY] = useState('');
  const [editUnitTRY, setEditUnitTRY] = useState('');
  const [editTxDate, setEditTxDate] = useState('');
  const [editNote, setEditNote] = useState('');

  // Confirm delete dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Rates
  const physGramRate = rates.find(r => r.symbol === 'XAU_GR_PHYSICAL')?.rateTRY || 6710.00;
  const bankGramRate = rates.find(r => r.symbol === 'XAU_GR_BANK')?.rateTRY || 6561.65;
  const ceyrekRate = rates.find(r => r.symbol === 'XAU_CEYREK')?.rateTRY || 10980.00;
  const yarimRate = rates.find(r => r.symbol === 'XAU_YARIM')?.rateTRY || (ceyrekRate * 2);
  const tamRate = rates.find(r => r.symbol === 'XAU_TAM')?.rateTRY || (ceyrekRate * 4);
  const cumhuriyetRate = rates.find(r => r.symbol === 'XAU_CUMHURIYET')?.rateTRY || Math.round((ceyrekRate * (7.216 / 1.75)) * 100) / 100;
  
  const currentRate = 
    activeGoldType === 'PHYSICAL_GRAM' ? physGramRate :
    activeGoldType === 'BANK_GRAM' ? bankGramRate :
    activeGoldType === 'CEYREK' ? ceyrekRate :
    activeGoldType === 'YARIM' ? yarimRate :
    activeGoldType === 'TAM' ? tamRate : cumhuriyetRate;

  // CONSOLIDATED GOLD CALCULATION IN GRAMS ACROSS ALL TYPES
  const calcTotalGoldEquivalent = () => {
    const physAccounts = accounts.filter(a => a.subType === 'GOLD_GRAM_PHYSICAL' && (selectedGroupId === 'ALL' || a.groupId === selectedGroupId));
    const bankAccounts = accounts.filter(a => a.subType === 'GOLD_GRAM_BANK' && (selectedGroupId === 'ALL' || a.groupId === selectedGroupId));
    const ceyrekAccounts = accounts.filter(a => a.subType === 'GOLD_CEYREK' && (selectedGroupId === 'ALL' || a.groupId === selectedGroupId));
    const yarimAccounts = accounts.filter(a => a.subType === 'GOLD_YARIM' && (selectedGroupId === 'ALL' || a.groupId === selectedGroupId));
    const tamAccounts = accounts.filter(a => a.subType === 'GOLD_TAM' && (selectedGroupId === 'ALL' || a.groupId === selectedGroupId));
    const cumhuriyetAccounts = accounts.filter(a => a.subType === 'GOLD_CUMHURIYET' && (selectedGroupId === 'ALL' || a.groupId === selectedGroupId));

    const physIds = new Set(physAccounts.map(a => a.id));
    const bankIds = new Set(bankAccounts.map(a => a.id));
    const ceyrekIds = new Set(ceyrekAccounts.map(a => a.id));
    const yarimIds = new Set(yarimAccounts.map(a => a.id));
    const tamIds = new Set(tamAccounts.map(a => a.id));
    const cumhuriyetIds = new Set(cumhuriyetAccounts.map(a => a.id));

    let physQty = 0;
    let bankQty = 0;
    let ceyrekQty = 0;
    let yarimQty = 0;
    let tamQty = 0;
    let cumhuriyetQty = 0;

    for (const t of transactions) {
      if (physIds.has(t.accountId)) {
        physQty += (t.type === 'BUY' ? t.quantity : -t.quantity);
      } else if (bankIds.has(t.accountId)) {
        bankQty += (t.type === 'BUY' ? t.quantity : -t.quantity);
      } else if (ceyrekIds.has(t.accountId)) {
        ceyrekQty += (t.type === 'BUY' ? t.quantity : -t.quantity);
      } else if (yarimIds.has(t.accountId)) {
        yarimQty += (t.type === 'BUY' ? t.quantity : -t.quantity);
      } else if (tamIds.has(t.accountId)) {
        tamQty += (t.type === 'BUY' ? t.quantity : -t.quantity);
      } else if (cumhuriyetIds.has(t.accountId)) {
        cumhuriyetQty += (t.type === 'BUY' ? t.quantity : -t.quantity);
      }
    }

    physQty = Math.max(0, physQty);
    bankQty = Math.max(0, bankQty);
    ceyrekQty = Math.max(0, ceyrekQty);
    yarimQty = Math.max(0, yarimQty);
    tamQty = Math.max(0, tamQty);
    cumhuriyetQty = Math.max(0, cumhuriyetQty);

    // 1 Çeyrek = 1.75 gr, 1 Yarım = 3.50 gr, 1 Tam = 7.00 gr, 1 Cumhuriyet = 7.216 gr
    const ceyrekInGrams = ceyrekQty * 1.75;
    const yarimInGrams = yarimQty * 3.50;
    const tamInGrams = tamQty * 7.00;
    const cumhuriyetInGrams = cumhuriyetQty * 7.216;
    const totalGrams = physQty + bankQty + ceyrekInGrams + yarimInGrams + tamInGrams + cumhuriyetInGrams;
    const totalValueTRY = (physQty * physGramRate) + (bankQty * bankGramRate) + (ceyrekQty * ceyrekRate) + (yarimQty * yarimRate) + (tamQty * tamRate) + (cumhuriyetQty * cumhuriyetRate);

    return { physQty, bankQty, ceyrekQty, yarimQty, tamQty, cumhuriyetQty, ceyrekInGrams, yarimInGrams, tamInGrams, cumhuriyetInGrams, totalGrams, totalValueTRY };
  };

  const goldSummary = calcTotalGoldEquivalent();

  // Filter groups: only show groups that have gold accounts with at least one transaction
  const goldSubTypes = new Set(['GOLD_GRAM_PHYSICAL', 'GOLD_GRAM_BANK', 'GOLD_CEYREK', 'GOLD_YARIM', 'GOLD_TAM', 'GOLD_CUMHURIYET']);
  const groupsWithGold = groups.filter(g => {
    const gAccounts = accounts.filter(a => a.groupId === g.id && goldSubTypes.has(a.subType));
    if (gAccounts.length === 0) return false;
    const gAccIds = new Set(gAccounts.map(a => a.id));
    return transactions.some(t => gAccIds.has(t.accountId));
  });

  // Determine current asset subType
  const currentSubType: AssetSubType = 
    activeGoldType === 'PHYSICAL_GRAM' ? 'GOLD_GRAM_PHYSICAL' :
    activeGoldType === 'BANK_GRAM' ? 'GOLD_GRAM_BANK' :
    activeGoldType === 'CEYREK' ? 'GOLD_CEYREK' :
    activeGoldType === 'YARIM' ? 'GOLD_YARIM' :
    activeGoldType === 'TAM' ? 'GOLD_TAM' : 'GOLD_CUMHURIYET';

  const isPieceGold = activeGoldType === 'CEYREK' || activeGoldType === 'YARIM' || activeGoldType === 'TAM' || activeGoldType === 'CUMHURIYET';
  const isPhysicalGold = activeGoldType !== 'BANK_GRAM';

  // Filter accounts for this gold subType, respecting group filter
  const matchingAccounts = accounts.filter(a => {
    const isType = a.subType === currentSubType;
    const isGroup = selectedGroupId === 'ALL' || a.groupId === selectedGroupId;
    return isType && isGroup;
  });

  const matchingAccountIds = new Set(matchingAccounts.map(a => a.id));

  // Transactions for matching accounts
  const assetTxs = transactions.filter(t => matchingAccountIds.has(t.accountId));

  // Dynamic years from asset transactions: only include years with transactions!
  const uniqueYears = Array.from(new Set(assetTxs.map(t => t.year))).sort((a, b) => a - b);
  const dynamicYears = uniqueYears;

  // Multi-Year Monthly Matrix calculations
  const getMatrixCell = (year: number, month: number) => {
    const mtx = assetTxs.filter(t => t.year === year && t.month === month);
    let net = 0;
    for (const t of mtx) {
      if (t.type === 'BUY') net += t.quantity;
      else net -= t.quantity;
    }
    return net;
  };

  const getYearTotal = (year: number) => {
    const ytx = assetTxs.filter(t => t.year === year);
    let net = 0;
    for (const t of ytx) {
      if (t.type === 'BUY') net += t.quantity;
      else net -= t.quantity;
    }
    return net;
  };

  const getMonthTotalAcrossYears = (month: number) => {
    let net = 0;
    for (const y of dynamicYears) {
      net += getMatrixCell(y, month);
    }
    return net;
  };

  // Monthly aggregates for selectedYear (Months 1-12)
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const mtx = assetTxs.filter(t => t.year === selectedYear && t.month === month);
    let qty = 0;
    let cost = 0;
    for (const t of mtx) {
      if (t.type === 'BUY') {
        qty += t.quantity;
        cost += t.totalAmountTRY;
      } else {
        qty -= t.quantity;
        cost -= t.totalAmountTRY;
      }
    }
    const avgCost = qty > 0 ? cost / qty : 0;
    return { month, qty, cost, avgCost };
  });

  // Overall holdings across all time for this gold type
  let totalBoughtQty = 0;
  let totalBoughtCostTRY = 0;
  let totalSoldQty = 0;

  for (const t of assetTxs) {
    if (t.type === 'BUY') {
      totalBoughtQty += t.quantity;
      totalBoughtCostTRY += t.totalAmountTRY;
    } else {
      totalSoldQty += t.quantity;
    }
  }

  const currentHoldingQty = Math.max(0, totalBoughtQty - totalSoldQty);
  const avgUnitCost = totalBoughtQty > 0 ? totalBoughtCostTRY / totalBoughtQty : 0;
  const currentCostBasisTRY = currentHoldingQty * avgUnitCost;
  const currentValueTRY = currentHoldingQty * currentRate;
  const profitLossTRY = currentValueTRY - currentCostBasisTRY;
  const profitLossPct = currentCostBasisTRY > 0 ? (profitLossTRY / currentCostBasisTRY) * 100 : 0;
  const isProfit = profitLossTRY >= 0;

  // Date Range, Year & Custom Filter logic for Transaction History
  const filteredTxs = assetTxs.filter((tx) => {
    if (historyYearFilter !== 'ALL' && tx.year !== Number(historyYearFilter)) return false;
    if (historyStartDate && tx.date < historyStartDate) return false;
    if (historyEndDate && tx.date > historyEndDate) return false;

    if (historyFilter === 'ALL') return true;
    const txTime = new Date(tx.date).getTime();
    const now = Date.now();
    const msInDay = 86400000;

    if (historyFilter === '1M') return (now - txTime) <= 30 * msInDay;
    if (historyFilter === '3M') return (now - txTime) <= 90 * msInDay;
    if (historyFilter === '6M') return (now - txTime) <= 180 * msInDay;
    if (historyFilter === 'THIS_YEAR') return tx.year === 2026;
    if (historyFilter === 'PREV_YEAR') return tx.year === 2025;
    return true;
  }).sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  const totalPages = Math.max(1, Math.ceil(filteredTxs.length / itemsPerPage));
  const currentPage = Math.min(historyPage, totalPages);
  const paginatedTxs = filteredTxs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Inputs sync
  const handleQuantityChange = (qVal: string) => {
    let cleanVal = qVal;
    if (isPhysicalGold) {
      cleanVal = qVal.replace(/[^\d]/g, '');
    }
    setQuantity(cleanVal);
    const q = parseUserInputNumber(cleanVal);
    const u = parseUserInputNumber(unitTRY);
    if (q > 0 && u > 0) {
      setTotalTRY(formatForInput(Math.round(q * u * 100) / 100));
    }
  };

  const handleUnitChange = (uVal: string) => {
    setUnitTRY(uVal);
    const q = parseUserInputNumber(quantity);
    const u = parseUserInputNumber(uVal);
    if (q > 0 && u > 0) {
      setTotalTRY(formatForInput(Math.round(q * u * 100) / 100));
    }
  };

  const handleTotalChange = (tVal: string) => {
    setTotalTRY(tVal);
    const q = parseUserInputNumber(quantity);
    const t = parseUserInputNumber(tVal);
    if (q > 0 && t > 0) {
      setUnitTRY(formatForInput(Math.round((t / q) * 100) / 100));
    }
  };

  const handleOpenAddModal = () => {
    // If a group is selected in the filter, pre-select it
    const targetGrp = selectedGroupId !== 'ALL' ? selectedGroupId : (groups[0]?.id || '');
    setTargetGroupId(targetGrp);

    const existingAcc = accounts.find(a => a.groupId === targetGrp && a.subType === currentSubType);
    setTargetAccountId(existingAcc?.id || '');
    setUnitTRY(formatForInput(currentRate));
    setQuantity('');
    setTotalTRY('');
    setNote('');
    setIsModalOpen(true);
  };

  const handleSaveTransaction = async () => {
    let finalAccountId = targetAccountId;

    if (!finalAccountId) {
      const existingAcc = accounts.find(a => a.groupId === targetGroupId && a.subType === currentSubType);
      if (existingAcc) {
        finalAccountId = existingAcc.id;
      } else {
        const groupObj = groups.find(g => g.id === targetGroupId);
        const typeTitle = 
          activeGoldType === 'PHYSICAL_GRAM' ? 'Fiziki Gram Altın' :
          activeGoldType === 'BANK_GRAM' ? 'Banka Gram Altın' :
          activeGoldType === 'CEYREK' ? 'Çeyrek Altın' :
          activeGoldType === 'YARIM' ? 'Yarım Altın' :
          activeGoldType === 'TAM' ? 'Tam Altın' : 'Cumhuriyet Altını';

        const newAcc: Account = {
          id: `acc-gold-${Date.now()}`,
          groupId: targetGroupId,
          name: `${groupObj?.name || ''} ${typeTitle}`.trim(),
          type: 'ASSET',
          subType: currentSubType,
          symbol: activeGoldType === 'PHYSICAL_GRAM' ? 'XAU_GR_PHYSICAL' :
                  activeGoldType === 'BANK_GRAM' ? 'XAU_GR_BANK' :
                  activeGoldType === 'CEYREK' ? 'XAU_CEYREK' :
                  activeGoldType === 'YARIM' ? 'XAU_YARIM' :
                  activeGoldType === 'TAM' ? 'XAU_TAM' : 'XAU_CUMHURIYET',
          currency: 'TRY',
          order: accounts.length + 1,
          createdAt: new Date().toISOString()
        };
        await db.accounts.add(newAcc);
        finalAccountId = newAcc.id;
      }
    }

    let q = parseUserInputNumber(quantity);
    if (isPhysicalGold) {
      q = Math.round(q);
    }
    const t = parseUserInputNumber(totalTRY);
    const u = parseUserInputNumber(unitTRY) || (q > 0 ? t / q : 0);

    if (q <= 0 || t <= 0) return;

    const dateObj = new Date(txDate);
    const newTx: AssetTransaction = {
      id: `tx-${Date.now()}`,
      accountId: finalAccountId,
      groupId: targetGroupId,
      date: txDate,
      year: dateObj.getFullYear(),
      month: dateObj.getMonth() + 1,
      type: txType,
      quantity: q,
      totalAmountTRY: t,
      unitPriceTRY: u,
      note: note.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    await db.transactions.add(newTx);
    setIsModalOpen(false);
    setQuantity('');
    setTotalTRY('');
    setUnitTRY('');
    setNote('');
  };

  const handleOpenEditTx = (tx: AssetTransaction) => {
    const defaultGid = tx.groupId || accounts.find(a => a.id === tx.accountId)?.groupId || groups[0]?.id || '';
    setEditingTx(tx);
    setEditTxType(tx.type);
    setEditGroupId(defaultGid);
    setEditQuantity(formatForInput(tx.quantity));
    setEditUnitTRY(formatForInput(tx.unitPriceTRY));
    setEditTotalTRY(formatForInput(tx.totalAmountTRY));
    setEditTxDate(tx.date);
    setEditNote(tx.note || '');
  };

  const handleEditQuantityChange = (qVal: string) => {
    let cleanVal = qVal;
    if (isPhysicalGold) {
      cleanVal = qVal.replace(/[^\d]/g, '');
    }
    setEditQuantity(cleanVal);
    const q = parseUserInputNumber(cleanVal);
    const u = parseUserInputNumber(editUnitTRY);
    if (q > 0 && u > 0) {
      setEditTotalTRY(formatForInput(Math.round(q * u * 100) / 100));
    }
  };

  const handleEditUnitChange = (uVal: string) => {
    setEditUnitTRY(uVal);
    const q = parseUserInputNumber(editQuantity);
    const u = parseUserInputNumber(uVal);
    if (q > 0 && u > 0) {
      setEditTotalTRY(formatForInput(Math.round(q * u * 100) / 100));
    }
  };

  const handleEditTotalChange = (tVal: string) => {
    setEditTotalTRY(tVal);
    const q = parseUserInputNumber(editQuantity);
    const t = parseUserInputNumber(tVal);
    if (q > 0 && t > 0) {
      setEditUnitTRY(formatForInput(Math.round((t / q) * 100) / 100));
    }
  };

  const handleSaveEditTransaction = async () => {
    if (!editingTx) return;
    let q = parseUserInputNumber(editQuantity);
    if (isPhysicalGold) {
      q = Math.round(q);
    }
    const t = parseUserInputNumber(editTotalTRY);
    const u = parseUserInputNumber(editUnitTRY) || (q > 0 ? t / q : 0);

    if (q <= 0 || t <= 0) return;

    let finalAccountId = editingTx.accountId;
    if (editGroupId !== editingTx.groupId) {
      const existingAcc = accounts.find(a => a.groupId === editGroupId && a.subType === currentSubType);
      if (existingAcc) {
        finalAccountId = existingAcc.id;
      } else {
        const groupObj = groups.find(g => g.id === editGroupId);
        const typeTitle = 
          activeGoldType === 'PHYSICAL_GRAM' ? 'Fiziki Gram Altın' :
          activeGoldType === 'BANK_GRAM' ? 'Banka Gram Altın' :
          activeGoldType === 'CEYREK' ? 'Çeyrek Altın' :
          activeGoldType === 'YARIM' ? 'Yarım Altın' :
          activeGoldType === 'TAM' ? 'Tam Altın' : 'Cumhuriyet Altını';

        const newAcc: Account = {
          id: `acc-gold-${Date.now()}`,
          groupId: editGroupId,
          name: `${groupObj?.name || ''} ${typeTitle}`.trim(),
          type: 'ASSET',
          subType: currentSubType,
          symbol: activeGoldType === 'PHYSICAL_GRAM' ? 'XAU_GR_PHYSICAL' :
                  activeGoldType === 'BANK_GRAM' ? 'XAU_GR_BANK' :
                  activeGoldType === 'CEYREK' ? 'XAU_CEYREK' :
                  activeGoldType === 'YARIM' ? 'XAU_YARIM' :
                  activeGoldType === 'TAM' ? 'XAU_TAM' : 'XAU_CUMHURIYET',
          currency: 'TRY',
          order: accounts.length + 1,
          createdAt: new Date().toISOString()
        };
        await db.accounts.add(newAcc);
        finalAccountId = newAcc.id;
      }
    }

    const dateObj = new Date(editTxDate);
    await db.transactions.update(editingTx.id, {
      accountId: finalAccountId,
      groupId: editGroupId,
      date: editTxDate,
      year: dateObj.getFullYear(),
      month: dateObj.getMonth() + 1,
      type: editTxType,
      quantity: q,
      totalAmountTRY: t,
      unitPriceTRY: u,
      note: editNote.trim() || undefined
    });

    setEditingTx(null);
  };

  const handleSelectGoldType = (type: GoldTypeTab) => {
    setActiveGoldType(type);
    setSelectedTxIds(new Set());
  };

  const handleToggleSelectTx = (id: string) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllSelected = filteredTxs.length > 0 && filteredTxs.every(t => selectedTxIds.has(t.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTxs.map(t => t.id)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedTxIds.size === 0) return;
    const count = selectedTxIds.size;
    setConfirmDialog({
      isOpen: true,
      title: 'Seçilen İşlemleri Sil',
      message: `${count} adet altın hareket kaydını kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      onConfirm: async () => {
        await db.transactions.bulkDelete(Array.from(selectedTxIds));
        setSelectedTxIds(new Set());
      }
    });
  };

  const handleDeleteTx = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'İşlemi Sil',
      message: 'Bu altın alış/satış kaydını silmek istediğinize emin misiniz?',
      onConfirm: async () => {
        await db.transactions.delete(id);
        setSelectedTxIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  };

  const unitLabel = isPieceGold ? 'Adet' : 'Gram';

  return (
    <div className="space-y-4">
      {/* CONSOLIDATED GOLD IN GRAMS BANNER */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-slate-900 border border-amber-500/30 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider block">
                Toplam Altın Varlığı (Gram Karşılığı)
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-white font-mono">
                  {hideValues ? '••••' : `${formatNumber(goldSummary.totalGrams, 2)} gr`}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ≈ {formatTRY(goldSummary.totalValueTRY, hideValues)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick breakdown tags */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="px-2.5 py-1 rounded-xl bg-slate-950/60 border border-white/10 text-slate-300">
              <span className="text-slate-500 mr-1.5">Banka:</span>
              <span className="font-bold text-amber-300 font-mono">{formatNumber(goldSummary.bankQty, 2, hideValues)} gr</span>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-slate-950/60 border border-white/10 text-slate-300">
              <span className="text-slate-500 mr-1.5">Fiziki:</span>
              <span className="font-bold text-amber-300 font-mono">{formatNumber(goldSummary.physQty, 2, hideValues)} gr</span>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-slate-950/60 border border-white/10 text-slate-300">
              <span className="text-slate-500 mr-1.5">Çeyrek:</span>
              <span className="font-bold text-amber-300 font-mono">{formatNumber(goldSummary.ceyrekQty, 0, hideValues)} Adet</span>
            </div>
            {goldSummary.yarimQty > 0 && (
              <div className="px-2.5 py-1 rounded-xl bg-slate-950/60 border border-white/10 text-slate-300">
                <span className="text-slate-500 mr-1.5">Yarım:</span>
                <span className="font-bold text-amber-300 font-mono">{formatNumber(goldSummary.yarimQty, 0, hideValues)} Adet</span>
              </div>
            )}
            {goldSummary.tamQty > 0 && (
              <div className="px-2.5 py-1 rounded-xl bg-slate-950/60 border border-white/10 text-slate-300">
                <span className="text-slate-500 mr-1.5">Tam:</span>
                <span className="font-bold text-amber-300 font-mono">{formatNumber(goldSummary.tamQty, 0, hideValues)} Adet</span>
              </div>
            )}
            {goldSummary.cumhuriyetQty > 0 && (
              <div className="px-2.5 py-1 rounded-xl bg-slate-950/60 border border-white/10 text-slate-300">
                <span className="text-slate-500 mr-1.5">Cumhuriyet:</span>
                <span className="font-bold text-amber-300 font-mono">{formatNumber(goldSummary.cumhuriyetQty, 0, hideValues)} Adet</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-Type Switcher Tabs & Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-white/5">
        <div className="flex flex-wrap p-1 rounded-xl bg-slate-800 border border-white/5">
          <button
            onClick={() => handleSelectGoldType('BANK_GRAM')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeGoldType === 'BANK_GRAM' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Banka Gram Altın</span>
          </button>
          <button
            onClick={() => handleSelectGoldType('PHYSICAL_GRAM')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeGoldType === 'PHYSICAL_GRAM' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Fiziki Gram Altın</span>
          </button>
          <button
            onClick={() => handleSelectGoldType('CEYREK')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeGoldType === 'CEYREK' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Çeyrek Altın</span>
          </button>
          <button
            onClick={() => handleSelectGoldType('YARIM')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeGoldType === 'YARIM' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Yarım Altın</span>
          </button>
          <button
            onClick={() => handleSelectGoldType('TAM')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeGoldType === 'TAM' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Tam Altın</span>
          </button>
          <button
            onClick={() => handleSelectGoldType('CUMHURIYET')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeGoldType === 'CUMHURIYET' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Cumhuriyet Altını</span>
          </button>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Altın Al / Bozdur</span>
        </button>
      </div>

      {/* Group Filter Bar: Only show groups that have gold assets */}
      <GroupFilterBar
        groups={groupsWithGold.length > 0 ? groupsWithGold : groups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={(g) => {
          setSelectedGroupId(g);
          setSelectedTxIds(new Set());
        }}
        title="Hesap"
      />

      {/* METRIC HEADER */}
      {(() => {
        const activeGroup = selectedGroupId !== 'ALL' ? groups.find(g => g.id === selectedGroupId) : undefined;
        return (
          <div 
            className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-4 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg transition-all"
            style={{
              borderTop: activeGroup ? `3px solid ${activeGroup.color}` : undefined,
              boxShadow: activeGroup ? `0 10px 25px -8px ${activeGroup.color}25` : undefined
            }}
          >
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-slate-400 uppercase flex items-center gap-1.5">
                {activeGroup && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: activeGroup.color }} />}
                <span>Toplam Değer</span>
              </span>
              <span className="text-base sm:text-lg font-bold text-white mt-1 font-mono">
                {formatTRY(currentValueTRY, hideValues)}
              </span>
              <span className="text-[10px] text-slate-500">
                {formatNumber(currentHoldingQty, isPieceGold ? 0 : 2, hideValues)} {unitLabel}
              </span>
            </div>

            <div className="flex flex-col border-l border-white/10 pl-2.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Maliyet</span>
              <span className="text-base sm:text-lg font-bold text-slate-200 mt-1 font-mono">
                {formatTRY(currentCostBasisTRY, hideValues)}
              </span>
              <span className="text-[10px] text-slate-500">Mevcut Varlık Maliyeti</span>
            </div>

            <div className="flex flex-col border-l border-white/10 pl-2.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Kâr / Zarar</span>
              <span className={`text-base sm:text-lg font-bold mt-1 font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isProfit ? '+' : ''}{formatTRY(profitLossTRY, hideValues)}
              </span>
              <span className="text-[10px] text-slate-500">Net Getiri</span>
            </div>

            <div className="flex flex-col border-l border-white/10 pl-2.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Kâr / Zarar %</span>
              <div className={`flex items-center gap-0.5 text-base sm:text-lg font-bold mt-1 font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isProfit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                <span>%{formatNumber(Math.abs(profitLossPct), 2)}</span>
              </div>
              <span className="text-[10px] text-slate-500">Yüzdesel Oran</span>
            </div>

            <div className="flex flex-col col-span-2 sm:col-span-1 border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-2.5">
              <span className="text-[11px] font-semibold text-amber-400 uppercase">Ort. Brm. Mlyt.</span>
              <span className="text-base sm:text-lg font-bold text-amber-300 mt-1 font-mono">
                {formatTRY(avgUnitCost, hideValues)}
              </span>
              <span className="text-[10px] text-slate-500">
                Güncel: {formatTRY(currentRate, hideValues)}
              </span>
            </div>
          </div>
        );
      })()}

      {/* MULTI-YEAR MONTHLY MOVEMENT MATRIX (Yıllar x Aylar) */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
        <div className="p-3 bg-slate-950/80 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200">
            {activeGoldType === 'PHYSICAL_GRAM' ? 'Fiziki Gram Altın' : activeGoldType === 'BANK_GRAM' ? 'Banka Gram Altın' : 'Çeyrek Altın'} Yıllık Hareket Matrisi (Giriş / Çıkış)
          </span>
          <span className="text-[10px] text-slate-400">Net {unitLabel} değişimi (Satışlar eksi olarak gösterilir)</span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/90 border-b border-white/10 text-slate-400 font-semibold">
              <th className="py-2.5 px-3 min-w-[70px] sticky left-0 z-20 bg-slate-950/95 border-r border-white/10">
                Yıl
              </th>
              {MONTH_NAMES.map((m, idx) => (
                <th key={idx} className="py-2.5 px-2 min-w-[65px] text-right font-medium">
                  {m.slice(0, 3)}
                </th>
              ))}
              <th className="py-2.5 px-3 min-w-[90px] text-right font-bold text-amber-400 bg-slate-950/95">
                Genel Toplam
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {dynamicYears.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-8 text-center text-slate-400 font-sans text-xs">
                  Bu altın türünde henüz hareket kaydı bulunmuyor. Yeni işlem eklediğinizde yıllık hareket matrisi burada oluşacaktır.
                </td>
              </tr>
            ) : (
              <>
                {dynamicYears.map((year) => {
                  const yearTotal = getYearTotal(year);
                  return (
                    <tr key={year} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 px-3 text-slate-300 font-sans font-bold sticky left-0 z-10 bg-slate-900/95 border-r border-white/10">
                        {year}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const val = getMatrixCell(year, month);
                        return (
                          <td
                            key={month}
                            className={`py-2 px-2 text-right ${
                              val > 0 ? 'text-slate-200' : val < 0 ? 'text-rose-400 font-bold' : 'text-slate-600'
                            }`}
                          >
                            {val !== 0 ? formatNumber(val, isPieceGold ? 0 : 2, hideValues) : '-'}
                          </td>
                        );
                      })}
                      <td className={`py-2 px-3 text-right font-bold bg-slate-900/90 ${yearTotal < 0 ? 'text-rose-400' : 'text-amber-300'}`}>
                        {yearTotal !== 0 ? formatNumber(yearTotal, isPieceGold ? 0 : 2, hideValues) : '-'}
                      </td>
                    </tr>
                  );
                })}

                <tr className="bg-slate-950/95 font-bold text-amber-300 border-t-2 border-white/10">
                  <td className="py-2.5 px-3 sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                    Genel Toplam
                  </td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                    const monthTotal = getMonthTotalAcrossYears(month);
                    return (
                      <td key={month} className={`py-2.5 px-2 text-right ${monthTotal < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                        {monthTotal !== 0 ? formatNumber(monthTotal, isPieceGold ? 0 : 2, hideValues) : '-'}
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3 text-right font-extrabold text-amber-400 text-sm bg-slate-950">
                    {formatNumber(currentHoldingQty, isPieceGold ? 0 : 2, hideValues)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* SINGLE YEAR DETAILED METRICS BREAKDOWN (Clean Turkish, no "SUM") */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
        <div className="p-3 bg-slate-950/80 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-200">
              Aylık Detay Göstergeleri ({selectedYear})
            </span>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800 border border-white/10">
            <Calendar className="w-3.5 h-3.5 text-amber-400 ml-1.5" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-white font-bold text-xs focus:outline-none pr-2 cursor-pointer"
            >
              {dynamicYears.map((y) => (
                <option key={y} value={y} className="bg-slate-900 text-white">
                  {y} Yılı
                </option>
              ))}
            </select>
          </div>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/80 border-b border-white/10 text-slate-400 font-semibold">
              <th className="py-2.5 px-3 min-w-[170px] sticky left-0 z-20 bg-slate-950/95 border-r border-white/10">
                Ay / Göstergeler ({selectedYear})
              </th>
              {monthlyData.map((d) => (
                <th key={d.month} className="py-2.5 px-2.5 min-w-[80px] text-right font-medium">
                  {MONTH_NAMES[d.month - 1].slice(0, 3)}
                </th>
              ))}
              <th className="py-2.5 px-3 min-w-[95px] text-right font-bold text-amber-400 bg-slate-950/95">
                Genel Toplam
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {/* Row 1: Toplam Miktar */}
            <tr className="hover:bg-white/[0.02]">
              <td className="py-2 px-3 text-slate-300 font-sans font-medium sticky left-0 z-10 bg-slate-900/95 border-r border-white/10">
                Toplam Miktar ({unitLabel})
              </td>
              {monthlyData.map((d) => (
                <td key={d.month} className="py-2 px-2 text-right text-slate-300">
                  {d.qty > 0 ? formatNumber(d.qty, isPieceGold ? 0 : 2, hideValues) : '-'}
                </td>
              ))}
              <td className="py-2 px-3 text-right font-bold text-amber-300 bg-slate-900/90">
                {formatNumber(monthlyData.reduce((s, d) => s + d.qty, 0), isPieceGold ? 0 : 2, hideValues)}
              </td>
            </tr>

            {/* Row 2: Toplam Maliyet */}
            <tr className="hover:bg-white/[0.02]">
              <td className="py-2 px-3 text-slate-300 font-sans font-medium sticky left-0 z-10 bg-slate-900/95 border-r border-white/10">
                Toplam Maliyet (TL)
              </td>
              {monthlyData.map((d) => (
                <td key={d.month} className="py-2 px-2 text-right text-slate-300">
                  {d.cost > 0 ? formatNumber(d.cost, 0, hideValues) : '-'}
                </td>
              ))}
              <td className="py-2 px-3 text-right font-bold text-amber-300 bg-slate-900/90">
                {formatNumber(monthlyData.reduce((s, d) => s + d.cost, 0), 0, hideValues)}
              </td>
            </tr>

            {/* Row 3: Ortalama Birim Maliyet */}
            <tr className="bg-amber-500/5 font-semibold text-amber-200">
              <td className="py-2 px-3 font-sans sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                Ortalama Birim Maliyet (TL)
              </td>
              {monthlyData.map((d) => (
                <td key={d.month} className="py-2 px-2 text-right">
                  {d.avgCost > 0 ? formatNumber(d.avgCost, 0, hideValues) : '-'}
                </td>
              ))}
              <td className="py-2 px-3 text-right font-bold text-amber-400 bg-slate-950/95">
                {formatNumber(avgUnitCost, 0, hideValues)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* TRANSACTION HISTORY WITH DATE FILTERS & PAGINATION */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(el) => {
                if (el) {
                  el.indeterminate = selectedTxIds.size > 0 && !isAllSelected;
                }
              }}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 rounded border-white/20 bg-slate-950 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
              title={isAllSelected ? 'Tüm seçimleri kaldır' : 'Tüm filtrelenmiş işlemleri seç'}
            />
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span>Alış & Satış Hareket Geçmişi</span>
              <span className="text-[10px] text-slate-400 font-normal">({filteredTxs.length} İşlem)</span>
            </h4>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <Filter className="w-3 h-3 text-slate-500 mr-1 flex-shrink-0" />
            {[
              { id: 'ALL' as const, label: 'Tümü' },
              { id: '1M' as const, label: 'Son 1 Ay' },
              { id: '3M' as const, label: 'Son 3 Ay' },
              { id: '6M' as const, label: 'Son 6 Ay' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setHistoryFilter(f.id);
                  setHistoryPage(1);
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors flex-shrink-0 ${
                  historyFilter === f.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Batch Selection Action Bar */}
        {selectedTxIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-300">
                {selectedTxIds.size} işlem seçildi
              </span>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-[11px] text-slate-400 hover:text-white underline ml-1"
              >
                {isAllSelected ? 'Seçimi Kaldır' : `Tümünü Seç (${filteredTxs.length})`}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedTxIds(new Set())}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] transition-colors shadow-sm active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Seçilenleri Sil ({selectedTxIds.size})</span>
              </button>
            </div>
          </div>
        )}

        {/* Extended Filter Bar: Year & Custom Date Range */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5 text-xs">
          {/* Year Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400">Yıl:</span>
            <select
              value={historyYearFilter}
              onChange={(e) => {
                setHistoryYearFilter(e.target.value);
                setHistoryPage(1);
              }}
              className="px-2 py-1 rounded-lg bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="ALL">Tüm Yıllar</option>
              {uniqueYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Custom Date Range */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400">Tarih:</span>
            <input
              type="date"
              value={historyStartDate}
              onChange={(e) => {
                setHistoryStartDate(e.target.value);
                setHistoryPage(1);
              }}
              className="px-2 py-1 rounded-lg bg-slate-950 border border-white/10 text-white text-[11px] focus:outline-none"
              title="Başlangıç Tarihi"
            />
            <span className="text-slate-500">-</span>
            <input
              type="date"
              value={historyEndDate}
              onChange={(e) => {
                setHistoryEndDate(e.target.value);
                setHistoryPage(1);
              }}
              className="px-2 py-1 rounded-lg bg-slate-950 border border-white/10 text-white text-[11px] focus:outline-none"
              title="Bitiş Tarihi"
            />
          </div>

          {(historyYearFilter !== 'ALL' || historyStartDate || historyEndDate || historyFilter !== 'ALL') && (
            <button
              onClick={() => {
                setHistoryFilter('ALL');
                setHistoryYearFilter('ALL');
                setHistoryStartDate('');
                setHistoryEndDate('');
                setHistoryPage(1);
              }}
              className="text-[10px] text-amber-400 hover:underline ml-auto"
            >
              Filtreleri Temizle
            </button>
          )}
        </div>

        {filteredTxs.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">Bu filtreye uygun işlem kaydı bulunamadı.</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {paginatedTxs.map((tx) => {
              const acc = accounts.find(a => a.id === tx.accountId);
              const grp = groups.find(g => g.id === acc?.groupId || g.id === tx.groupId);
              const isSelected = selectedTxIds.has(tx.id);

              return (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                      : 'bg-slate-950/50 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectTx(tx.id)}
                      className="w-4 h-4 rounded border-white/20 bg-slate-950 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500 flex-shrink-0"
                      title="İşlemi seç"
                    />
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      tx.type === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                    }`}>
                      {tx.type === 'BUY' ? 'ALIŞ' : 'SATIŞ'}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-200 font-medium">
                          {formatNumber(tx.quantity, isPieceGold ? 0 : 2, hideValues)} {unitLabel}
                        </span>
                        {grp && (
                          <span
                            className="text-[9px] px-1.5 py-0.2 rounded font-semibold"
                            style={{ backgroundColor: `${grp.color}20`, color: grp.color }}
                          >
                            {grp.name}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 text-[10px] font-mono">
                        @ {formatTRY(tx.unitPriceTRY, hideValues)} {tx.note ? `• ${tx.note}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-bold font-mono text-white block">
                        {formatTRY(tx.totalAmountTRY, hideValues)}
                      </span>
                      <span className="text-[10px] text-slate-500">{tx.date}</span>
                    </div>
                    <button
                      onClick={() => handleOpenEditTx(tx)}
                      className="p-1 text-slate-500 hover:text-amber-400 transition-colors"
                      title="İşlemi Düzenle"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTx(tx.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="İşlemi Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-slate-400">
            <button
              onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white font-medium transition-colors"
            >
              Önceki
            </button>
            <span className="font-mono text-[11px]">
              Sayfa {currentPage} / {totalPages} ({filteredTxs.length} işlem)
            </span>
            <button
              onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white font-medium transition-colors"
            >
              Sonraki
            </button>
          </div>
        )}
      </div>

      {/* ADD TRANSACTION MODAL WITH GROUP SELECTION */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          activeGoldType === 'PHYSICAL_GRAM' ? 'Fiziki Gram Altın İşlemi' :
          activeGoldType === 'BANK_GRAM' ? 'Banka Gram Altın İşlemi' :
          activeGoldType === 'CEYREK' ? 'Çeyrek Altın İşlemi' :
          activeGoldType === 'YARIM' ? 'Yarım Altın İşlemi' :
          activeGoldType === 'TAM' ? 'Tam Altın İşlemi' : 'Cumhuriyet Altını İşlemi'
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-white/10">
            <button
              type="button"
              onClick={() => setTxType('BUY')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                txType === 'BUY' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Alış (+)
            </button>
            <button
              type="button"
              onClick={() => setTxType('SELL')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                txType === 'SELL' ? 'bg-rose-500 text-white' : 'text-slate-400'
              }`}
            >
              Satış / Bozdurma (-)
            </button>
          </div>

          {/* Account Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Hangi Hesaba Ait?
            </label>
            {groups.length === 0 ? (
              <p className="text-xs text-amber-400">Henüz kayıtlı bir hesap bulunmuyor. Önce yukarıdan 'Yeni Hesap' eklemelisiniz.</p>
            ) : (
              <select
                value={targetGroupId}
                onChange={(e) => {
                  setTargetGroupId(e.target.value);
                  setTargetAccountId('');
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Miktar ({unitLabel}) {isPhysicalGold && <span className="text-amber-400 font-semibold">(Tam Sayı)</span>}
              </label>
              <input
                type="text"
                inputMode={isPhysicalGold ? 'numeric' : 'decimal'}
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                placeholder={isPhysicalGold ? 'Örn: 5' : 'Örn: 5,50'}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
              {isPhysicalGold && (
                <p className="text-[10px] text-amber-400/80 mt-1">
                  * Fiziki altın miktarında küsurat/ondalık girilemez.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Birim Fiyat (TL)</label>
              <input
                type="text"
                value={unitTRY}
                onChange={(e) => handleUnitChange(e.target.value)}
                placeholder={`Örn: ${currentRate}`}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Toplam Tutar (TL)</label>
            <input
              type="text"
              value={totalTRY}
              onChange={(e) => handleTotalChange(e.target.value)}
              placeholder="Örn: 33500"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono font-bold text-base focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-400 mb-1">İşlem Tarihi</label>
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full min-w-0 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-400 mb-1">Açıklama / Not</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full min-w-0 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Vazgeç
            </button>
            <button
              onClick={handleSaveTransaction}
              className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
            >
              İşlemi Kaydet
            </button>
          </div>
        </div>
      </Modal>

      {/* EDIT TRANSACTION MODAL */}
      <Modal
        isOpen={!!editingTx}
        onClose={() => setEditingTx(null)}
        title="Altın İşlemini Düzenle"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-white/10">
            <button
              type="button"
              onClick={() => setEditTxType('BUY')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                editTxType === 'BUY' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Alış (+)
            </button>
            <button
              type="button"
              onClick={() => setEditTxType('SELL')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                editTxType === 'SELL' ? 'bg-rose-500 text-white' : 'text-slate-400'
              }`}
            >
              Satış / Bozdurma (-)
            </button>
          </div>

          {/* Group Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Hangi Hesaba Ait?
            </label>
            <select
              value={editGroupId}
              onChange={(e) => setEditGroupId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Miktar ({unitLabel}) {isPhysicalGold && <span className="text-amber-400 font-semibold">(Tam Sayı)</span>}
              </label>
              <input
                type="text"
                inputMode={isPhysicalGold ? 'numeric' : 'decimal'}
                value={editQuantity}
                onChange={(e) => handleEditQuantityChange(e.target.value)}
                placeholder={isPhysicalGold ? 'Örn: 5' : 'Örn: 5,50'}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
              {isPhysicalGold && (
                <p className="text-[10px] text-amber-400/80 mt-1">
                  * Fiziki altın miktarında küsurat/ondalık girilemez.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Birim Fiyat (TL)</label>
              <input
                type="text"
                value={editUnitTRY}
                onChange={(e) => handleEditUnitChange(e.target.value)}
                placeholder="Birim Fiyat"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Toplam Tutar (TL)</label>
            <input
              type="text"
              value={editTotalTRY}
              onChange={(e) => handleEditTotalChange(e.target.value)}
              placeholder="Toplam Tutar"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono font-bold text-base focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-400 mb-1">İşlem Tarihi</label>
              <input
                type="date"
                value={editTxDate}
                onChange={(e) => setEditTxDate(e.target.value)}
                className="w-full min-w-0 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-400 mb-1">Açıklama / Not</label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="w-full min-w-0 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setEditingTx(null)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Vazgeç
            </button>
            <button
              onClick={handleSaveEditTransaction}
              className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
            >
              Değişiklikleri Kaydet
            </button>
          </div>
        </div>
      </Modal>

      {/* Modern Confirm Dialog for Deletion */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  );
};
