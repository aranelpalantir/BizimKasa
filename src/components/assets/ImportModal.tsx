import React, { useState } from 'react';
import { Upload, Download, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { db } from '../../db/db';
import { formatTRY } from '../../services/portfolioService';
import type { Group, Account, AssetTransaction, AssetSubType } from '../../types/finance';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  accounts: Account[];
}

interface ParsedImportRow {
  rawType: string;
  matchedSubType: AssetSubType;
  symbol: string;
  groupName: string;
  groupId: string;
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
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  const downloadSampleCSV = () => {
    const csvContent = 
`Varlık Türü,Tarih,Miktar,Fiyat,Ana Grup,Açıklama
Banka Gram Altın,2026-03-15,4.5,5200,Mert,Şubat birikimi
Fiziki Gram Altın,2026-04-10,5.0,6100,Aylin,Kuyumcu alımı
Çeyrek Altın,2026-05-01,2,9800,Çocuk,Bayram hediyesi
Euro,2026-06-12,500,52.5,Aylin,Döviz birikim
Euro,2026-07-20,-200,53.0,Aylin,Tatil harcaması
Dolar,2026-08-15,1000,47.8,Ortak Kasa,Acil durum
TI2,2026-09-05,1000,14.5,Mert,Fon alımı
MAC,2026-09-20,500,36.0,Aylin,Fon alımı`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bizimkasa-ornek-sablon.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseInput = (text: string) => {
    setPasteText(text);
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = text.trim().split(/\r?\n/);
    const rows: ParsedImportRow[] = [];

    // Check if line 0 is header
    let startIndex = 0;
    const firstLineLower = lines[0].toLowerCase();
    if (firstLineLower.includes('varlık') || firstLineLower.includes('tür') || firstLineLower.includes('tarih')) {
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split by comma or tab or semicolon
      const cols = line.split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 4) continue;

      const rawType = cols[0];
      const dateStr = cols[1];
      const rawQty = cols[2];
      const rawPrice = cols[3];
      const groupCol = cols[4] || '';
      const noteCol = cols[5] || '';

      const qtyNum = parseFloat(rawQty.replace(',', '.'));
      const priceNum = parseFloat(rawPrice.replace(',', '.'));

      if (isNaN(qtyNum) || isNaN(priceNum) || qtyNum === 0) continue;

      const isBuy = qtyNum > 0;
      const absQty = Math.abs(qtyNum);
      const totalTRY = Math.round((absQty * priceNum) * 100) / 100;

      // Match Group
      let matchedGroup = groups.find(g => 
        groupCol && g.name.toLowerCase().includes(groupCol.toLowerCase())
      );
      if (!matchedGroup) {
        matchedGroup = groups[0] || { id: 'group-mert', name: 'Mert' };
      }

      // Match SubType & Symbol
      let matchedSubType: AssetSubType = 'FUND';
      let symbol = rawType.toUpperCase();
      const typeLower = rawType.toLowerCase();

      if (typeLower.includes('fiziki gram') || typeLower.includes('fiziki alt')) {
        matchedSubType = 'GOLD_GRAM_PHYSICAL';
        symbol = 'XAU_GR_PHYSICAL';
      } else if (typeLower.includes('banka') || typeLower.includes('gram alt')) {
        matchedSubType = 'GOLD_GRAM_BANK';
        symbol = 'XAU_GR_BANK';
      } else if (typeLower.includes('çeyrek') || typeLower.includes('ceyrek')) {
        matchedSubType = 'GOLD_CEYREK';
        symbol = 'XAU_CEYREK';
      } else if (typeLower.includes('euro') || typeLower === 'eur') {
        matchedSubType = 'CURRENCY';
        symbol = 'EUR';
      } else if (typeLower.includes('dolar') || typeLower === 'usd') {
        matchedSubType = 'CURRENCY';
        symbol = 'USD';
      } else if (typeLower.includes('sterlin') || typeLower === 'gbp') {
        matchedSubType = 'CURRENCY';
        symbol = 'GBP';
      } else {
        matchedSubType = 'FUND';
        symbol = rawType.toUpperCase();
      }

      // Parse date
      let parsedDate = dateStr;
      if (dateStr.includes('.')) {
        // DD.MM.YYYY
        const parts = dateStr.split('.');
        if (parts.length === 3) {
          parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      const dObj = new Date(parsedDate);
      const year = isNaN(dObj.getFullYear()) ? 2026 : dObj.getFullYear();
      const month = isNaN(dObj.getMonth()) ? 1 : dObj.getMonth() + 1;

      rows.push({
        rawType,
        matchedSubType,
        symbol,
        groupName: matchedGroup.name,
        groupId: matchedGroup.id,
        date: parsedDate,
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
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;

    try {
      const newTransactions: AssetTransaction[] = [];

      for (const row of parsedRows) {
        // Find or create account
        let targetAccount = accounts.find(a => 
          a.groupId === row.groupId && 
          (a.subType === row.matchedSubType || a.symbol === row.symbol)
        );

        if (!targetAccount) {
          const newAcc: Account = {
            id: `acc-import-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            groupId: row.groupId,
            name: `${row.groupName} ${row.rawType}`.trim(),
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
          groupId: row.groupId,
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
        message: `${parsedRows.length} adet işlem başarıyla IndexedDB'ye aktarıldı!`
      });

      setTimeout(() => {
        setImportStatus(null);
        setPasteText('');
        setParsedRows([]);
        onClose();
      }, 1500);
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
        {/* Instructions & Template Download */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2 text-xs text-slate-300">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>İçe Aktarma Formatı</span>
            </span>
            <button
              onClick={downloadSampleCSV}
              className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Örnek CSV İndir</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Sütunlar: <span className="font-mono text-slate-200">Varlık Türü, Tarih, Miktar, Fiyat, [Ana Grup], [Açıklama]</span>
          </p>
          <p className="text-[11px] text-slate-400">
            * Alımlarda miktar <strong className="text-emerald-400">+</strong> (örn: 5), satımlarda <strong className="text-rose-400">-</strong> (örn: -2) olmalıdır.
          </p>
        </div>

        {/* File Upload or Text Paste */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">
              Excel'den Kopyala-Yapıştır veya CSV Dosyası Seç:
            </label>
            <label className="flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer border border-white/10 transition-colors">
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Dosya Seç</span>
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
            placeholder="Excel'den hücreleri kopyalayıp buraya yapıştırabilirsiniz..."
            className="w-full p-3 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Parsed Rows Preview */}
        {parsedRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Algılanan Satırlar ({parsedRows.length} İşlem)</span>
              <span className="text-[11px] text-emerald-400">Önizleme hazır</span>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-slate-950 text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 bg-slate-900/50">
                    <th className="py-2 px-2.5">Tür / Kod</th>
                    <th className="py-2 px-2">Grup</th>
                    <th className="py-2 px-2">Tarih</th>
                    <th className="py-2 px-2 text-right">İşlem</th>
                    <th className="py-2 px-2.5 text-right">Miktar</th>
                    <th className="py-2 px-2.5 text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {parsedRows.map((r, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="py-1.5 px-2.5 text-slate-200 font-sans font-medium">{r.rawType}</td>
                      <td className="py-1.5 px-2 text-slate-400 font-sans text-[11px]">{r.groupName}</td>
                      <td className="py-1.5 px-2 text-slate-400 text-[11px]">{r.date}</td>
                      <td className="py-1.5 px-2 text-right">
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          r.isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                        }`}>
                          {r.isBuy ? 'ALIŞ' : 'SATIŞ'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-white font-bold">{r.quantity}</td>
                      <td className="py-1.5 px-2.5 text-right text-slate-300">{formatTRY(r.totalTRY)}</td>
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
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
          >
            Vazgeç
          </button>
          <button
            onClick={handleExecuteImport}
            disabled={parsedRows.length === 0}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20"
          >
            {parsedRows.length > 0 ? `${parsedRows.length} İşlemi İçe Aktar` : 'İçe Aktar'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
