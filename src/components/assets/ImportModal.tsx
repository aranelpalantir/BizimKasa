import React, { useState } from 'react';
import { Upload, Download, FileSpreadsheet, Check, AlertCircle, Trash2, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Modal } from '../common/Modal';
import { db } from '../../db/db';
import { formatTRY, formatNumber } from '../../services/portfolioService';
import type { Group, Account, AssetTransaction, AssetSubType } from '../../types/finance';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  accounts: Account[];
}

interface ParsedImportRow {
  id: string;
  rawType: string;
  matchedSubType: AssetSubType;
  symbol: string;
  accountName: string;
  date: string;
  year: number;
  month: number;
  quantity: number;
  price: number;
  totalTRY: number;
  isBuy: boolean;
  note?: string;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  groups,
  accounts
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  const selectedGroup = groups.find(g => g.id === selectedGroupId) || groups[0];

  const downloadSampleCSV = () => {
    const csvContent = 
`Varlık Türü,Tarih,Miktar,Fiyat,Açıklama
Banka Gram Altın,15.03.2026,4.5,6500,Maaş birikimi
Fiziki Gram Altın,10.04.2026,5.0,6650,Kuyumcu alımı
Çeyrek Altın,01.05.2026,2,10850,Hediyelik altın
Euro,12.06.2026,500,55.20,Döviz alımı
Euro,20.07.2026,-200,55.50,Tatil harcaması bozdurma
Dolar,15.08.2026,1000,49.00,Dolar birikimi
TI2,05.09.2026,1000,15.40,Fon alımı
MAC,20.09.2026,500,38.50,Fon alımı`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bizimkasa-varlik-sablon.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Robust number parsing (handles 1.250,50 or 1250,50 or 1250.50)
  const parseCleanNumber = (val: string): number => {
    if (!val) return NaN;
    let s = val.trim().replace(/[₺$€TL\s]/gi, '');
    if (s.includes('.') && s.includes(',')) {
      // 1.250,50 -> 1250.50
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
      // 1250,50 -> 1250.50
      s = s.replace(',', '.');
    }
    return parseFloat(s);
  };

  // Robust date parsing (DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY)
  const parseCleanDate = (dateStr: string): { isoDate: string; year: number; month: number } => {
    const trimmed = dateStr.trim();
    let y = 2026;
    let m = 1;
    let d = 1;

    if (trimmed.includes('.') || trimmed.includes('/') || (trimmed.includes('-') && trimmed.split('-')[0].length <= 2)) {
      const parts = trimmed.split(/[./-]/);
      if (parts.length === 3) {
        d = parseInt(parts[0], 10) || 1;
        m = parseInt(parts[1], 10) || 1;
        y = parseInt(parts[2], 10) || 2026;
        if (y < 100) y += 2000;
      }
    } else if (trimmed.includes('-')) {
      // YYYY-MM-DD
      const parts = trimmed.split('-');
      if (parts.length === 3) {
        y = parseInt(parts[0], 10) || 2026;
        m = parseInt(parts[1], 10) || 1;
        d = parseInt(parts[2], 10) || 1;
      }
    }

    const isoDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { isoDate, year: y, month: m };
  };

  const parseInput = (text: string) => {
    setPasteText(text);
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = text.trim().split(/\r?\n/);
    const rows: ParsedImportRow[] = [];

    // Header detection: check if first line has non-numeric in col 3 or col 4
    let startIndex = 0;
    if (lines.length > 0) {
      const firstLineParts = lines[0].split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (firstLineParts.length >= 3) {
        const testNum = parseCleanNumber(firstLineParts[2]);
        if (isNaN(testNum)) {
          startIndex = 1;
        }
      }
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 3) continue;

      // Col 0: Varlık Türü / Fon Kodu
      // Col 1: Tarih
      // Col 2: Miktar
      // Col 3: Fiyat
      // Col 4: Açıklama (veya eğer 6 sütunlu eski format ise Col 5)
      const rawType = cols[0];
      const dateRaw = cols[1];
      const rawQty = cols[2];
      const rawPrice = cols[3] || '0';
      const noteCol = cols[4] || '';

      const qtyNum = parseCleanNumber(rawQty);
      const priceNum = parseCleanNumber(rawPrice) || 0;

      if (isNaN(qtyNum) || qtyNum === 0) continue;

      const isBuy = qtyNum > 0;
      const absQty = Math.abs(qtyNum);
      const totalTRY = Math.round((absQty * priceNum) * 100) / 100;

      // Match SubType & Symbol
      let matchedSubType: AssetSubType = 'FUND';
      let symbol = rawType.toUpperCase();
      let accountName = rawType;
      const typeLower = rawType.toLowerCase();

      if (typeLower.includes('fiziki gram') || typeLower.includes('fiziki alt')) {
        matchedSubType = 'GOLD_GRAM_PHYSICAL';
        symbol = 'XAU_GR_PHYSICAL';
        accountName = 'Fiziki Gram Altın';
      } else if (typeLower.includes('banka') || typeLower.includes('gram alt')) {
        matchedSubType = 'GOLD_GRAM_BANK';
        symbol = 'XAU_GR_BANK';
        accountName = 'Banka Gram Altın';
      } else if (typeLower.includes('çeyrek') || typeLower.includes('ceyrek')) {
        matchedSubType = 'GOLD_CEYREK';
        symbol = 'XAU_CEYREK';
        accountName = 'Çeyrek Altın';
      } else if (typeLower.includes('euro') || typeLower === 'eur') {
        matchedSubType = 'CURRENCY';
        symbol = 'EUR';
        accountName = 'Euro (EUR)';
      } else if (typeLower.includes('dolar') || typeLower === 'usd') {
        matchedSubType = 'CURRENCY';
        symbol = 'USD';
        accountName = 'Dolar (USD)';
      } else if (typeLower.includes('sterlin') || typeLower === 'gbp') {
        matchedSubType = 'CURRENCY';
        symbol = 'GBP';
        accountName = 'Sterlin (GBP)';
      } else {
        matchedSubType = 'FUND';
        symbol = rawType.toUpperCase().trim();
        accountName = `${symbol} Fonu`;
      }

      const { isoDate, year, month } = parseCleanDate(dateRaw);

      rows.push({
        id: `row-${i}-${Date.now()}`,
        rawType,
        matchedSubType,
        symbol,
        accountName,
        date: isoDate,
        year,
        month,
        quantity: absQty,
        price: priceNum,
        totalTRY,
        isBuy,
        note: noteCol || undefined
      });
    }

    setParsedRows(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseInput(content);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleRemoveRow = (id: string) => {
    setParsedRows(prev => prev.filter(r => r.id !== id));
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0 || !selectedGroupId) return;

    try {
      const newTransactions: AssetTransaction[] = [];

      for (const row of parsedRows) {
        // Find existing account for this group & subType/symbol
        let targetAccount = accounts.find(a => 
          a.groupId === selectedGroupId && 
          a.subType === row.matchedSubType && 
          (row.matchedSubType === 'FUND' ? (a.symbol === row.symbol) : true)
        );

        if (!targetAccount) {
          const newAcc: Account = {
            id: `acc-import-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            groupId: selectedGroupId,
            name: row.accountName,
            type: 'ASSET',
            subType: row.matchedSubType,
            symbol: row.symbol,
            currency: (row.symbol === 'EUR' || row.symbol === 'USD') ? row.symbol : 'TRY',
            order: accounts.length + 1,
            createdAt: new Date().toISOString()
          };
          await db.accounts.add(newAcc);
          targetAccount = newAcc;
        }

        newTransactions.push({
          id: `tx-imp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          accountId: targetAccount.id,
          groupId: selectedGroupId,
          date: row.date,
          year: row.year,
          month: row.month,
          type: row.isBuy ? 'BUY' : 'SELL',
          quantity: row.quantity,
          totalAmountTRY: row.totalTRY,
          unitPriceTRY: row.price,
          note: row.note,
          createdAt: new Date().toISOString()
        });
      }

      await db.transactions.bulkAdd(newTransactions);
      setImportStatus({
        success: true,
        message: `${parsedRows.length} adet işlem "${selectedGroup?.name}" grubuna başarıyla aktarıldı!`
      });

      setTimeout(() => {
        setImportStatus(null);
        setPasteText('');
        setParsedRows([]);
        onClose();
      }, 1200);
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: `Hata oluştu: ${err?.message || 'Bilinmeyen hata'}`
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Excel / CSV Varlık Hareketlerini İçe Aktar"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* GROUP SELECTOR: Crucial feature requested by user */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/20 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <label className="text-xs font-bold text-white block">
                İçe Aktarılacak Ana Grup
              </label>
              <p className="text-[11px] text-slate-400">
                Excel tablonuzda grup sütununa gerek yoktur; seçtiğiniz grubun hesabına kaydedilir.
              </p>
            </div>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold text-xs focus:outline-none cursor-pointer"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id} className="bg-slate-900 text-white font-normal">
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Instructions & Template Download */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2 text-xs text-slate-300">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Sütun Sırası & Kurallar</span>
            </span>
            <button
              onClick={downloadSampleCSV}
              className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Örnek Şablonu İndir (.csv)</span>
            </button>
          </div>
          <div className="p-2 rounded-xl bg-slate-900 font-mono text-[11px] text-amber-300 border border-white/5 overflow-x-auto">
            1: Varlık Türü / Kodu | 2: Tarih | 3: Miktar (+/-) | 4: Fiyat | [5: Açıklama]
          </div>
          <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
            <li>Başlık satırınızın olup olmaması fark etmez, sistem otomatik tanır.</li>
            <li>Alışlar pozitif (<strong className="text-emerald-400">+</strong> örn: 5.5), satışlar negatif (<strong className="text-rose-400">-</strong> örn: -2) girilmelidir.</li>
            <li>Tarihlerde nokta (<code className="text-slate-200">15.03.2026</code>) veya tire (<code className="text-slate-200">2026-03-15</code>) desteklenir.</li>
          </ul>
        </div>

        {/* File Upload or Text Paste */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">
              Excel'den Kopyala-Yapıştır veya CSV Dosyası Yükle:
            </label>
            <label className="flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer border border-white/10 transition-colors">
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Dosyadan Yükle</span>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <textarea
            rows={4}
            value={pasteText}
            onChange={(e) => parseInput(e.target.value)}
            placeholder="Excel'den kopyaladığınız satırları buraya yapıştırın (Ctrl + V)..."
            className="w-full p-3 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Parsed Rows Preview Table */}
        {parsedRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-white">
                Önizleme ({parsedRows.length} İşlem) • Hedef: <span className="text-amber-300">{selectedGroup?.name}</span>
              </span>
              <span className="text-[11px] text-emerald-400">Kontrol edip onaylayabilirsiniz</span>
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-slate-950 text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 bg-slate-900/60 sticky top-0 z-10">
                    <th className="py-2 px-2.5">Varlık</th>
                    <th className="py-2 px-2">Tarih</th>
                    <th className="py-2 px-2 text-center">İşlem</th>
                    <th className="py-2 px-2.5 text-right">Miktar</th>
                    <th className="py-2 px-2.5 text-right">Birim Fiyat</th>
                    <th className="py-2 px-2.5 text-right">Toplam</th>
                    <th className="py-2 px-2 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {parsedRows.map((r) => (
                    <tr key={r.id} className="hover:bg-white/[0.02]">
                      <td className="py-1.5 px-2.5 text-slate-200 font-sans font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{r.accountName}</span>
                          {r.note && <span className="text-[10px] text-slate-500 font-normal">({r.note})</span>}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-slate-400 text-[11px]">{r.date}</td>
                      <td className="py-1.5 px-2 text-center">
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          r.isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                        }`}>
                          {r.isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {r.isBuy ? 'ALIŞ' : 'SATIŞ'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-white font-bold">{formatNumber(r.quantity, 2)}</td>
                      <td className="py-1.5 px-2.5 text-right text-slate-400">{formatNumber(r.price, 2)} ₺</td>
                      <td className="py-1.5 px-2.5 text-right text-amber-300 font-bold">{formatTRY(r.totalTRY)}</td>
                      <td className="py-1.5 px-2 text-center">
                        <button
                          onClick={() => handleRemoveRow(r.id)}
                          title="Bu satırı listeden çıkar"
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Feedback message */}
        {importStatus && (
          <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
            importStatus.success ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
          }`}>
            {importStatus.success ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{importStatus.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors"
          >
            Vazgeç
          </button>
          <button
            onClick={handleExecuteImport}
            disabled={parsedRows.length === 0}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20 active:scale-95"
          >
            {parsedRows.length > 0 ? `${parsedRows.length} İşlemi "${selectedGroup?.name}" İçin İçe Aktar` : 'İçe Aktar'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
