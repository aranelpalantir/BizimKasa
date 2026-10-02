import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  Check, 
  AlertCircle, 
  Trash2, 
  ArrowDownRight, 
  ArrowUpRight, 
  Sparkles
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { db } from '../../db/db';
import { formatTRY, formatNumber, parseUserInputNumber, formatForInput } from '../../services/portfolioService';
import { lookupTefasFund, searchTefasFunds, syncTefasFundRatesWithAssets } from '../../services/ratesService';
import type { Group, Account, AssetTransaction, AssetSubType } from '../../types/finance';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  accounts: Account[];
  defaultCategory?: 'gold' | 'currency' | 'funds';
  defaultAssetKey?: string;
  defaultGroupId?: string;
}

interface PredefinedAsset {
  key: string;
  name: string;
  subType: AssetSubType;
  symbol: string;
  category: 'GOLD' | 'CURRENCY';
  unit: string;
  isPhysical: boolean;
  samplePrice: number;
  sampleQty: number;
}

const PREDEFINED_ASSETS: PredefinedAsset[] = [
  // Altın
  { key: 'GOLD_GRAM_BANK', name: 'Banka Gram Altın', subType: 'GOLD_GRAM_BANK', symbol: 'XAU_GR_BANK', category: 'GOLD', unit: 'gr', isPhysical: false, samplePrice: 6560, sampleQty: 4.5 },
  { key: 'GOLD_GRAM_PHYSICAL', name: 'Fiziki Gram Altın', subType: 'GOLD_GRAM_PHYSICAL', symbol: 'XAU_GR_PHYSICAL', category: 'GOLD', unit: 'gr', isPhysical: true, samplePrice: 6710, sampleQty: 5 },
  { key: 'GOLD_CEYREK', name: 'Çeyrek Altın', subType: 'GOLD_CEYREK', symbol: 'XAU_CEYREK', category: 'GOLD', unit: 'adet', isPhysical: true, samplePrice: 10980, sampleQty: 2 },
  { key: 'GOLD_YARIM', name: 'Yarım Altın', subType: 'GOLD_YARIM', symbol: 'XAU_YARIM', category: 'GOLD', unit: 'adet', isPhysical: true, samplePrice: 21960, sampleQty: 1 },
  { key: 'GOLD_TAM', name: 'Tam Altın', subType: 'GOLD_TAM', symbol: 'XAU_TAM', category: 'GOLD', unit: 'adet', isPhysical: true, samplePrice: 43920, sampleQty: 1 },
  { key: 'GOLD_CUMHURIYET', name: 'Cumhuriyet Altını', subType: 'GOLD_CUMHURIYET', symbol: 'XAU_CUMHURIYET', category: 'GOLD', unit: 'adet', isPhysical: true, samplePrice: 45200, sampleQty: 1 },

  // Döviz (Yalnızca EUR ve USD)
  { key: 'CURRENCY_EUR', name: 'Euro (EUR)', subType: 'CURRENCY', symbol: 'EUR', category: 'CURRENCY', unit: '€', isPhysical: false, samplePrice: 55.20, sampleQty: 500 },
  { key: 'CURRENCY_USD', name: 'Amerikan Doları (USD)', subType: 'CURRENCY', symbol: 'USD', category: 'CURRENCY', unit: '$', isPhysical: false, samplePrice: 49.00, sampleQty: 1000 },
];

interface ParsedImportRow {
  id: string;
  accountId?: string;
  assetName: string;
  subType: AssetSubType;
  symbol: string;
  unit: string;
  isPhysical: boolean;
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
  accounts,
  defaultCategory = 'gold',
  defaultAssetKey,
  defaultGroupId
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(defaultGroupId || groups[0]?.id || '');
  
  // Initial default asset key
  const getInitialAssetKey = () => {
    if (defaultAssetKey) return defaultAssetKey;
    if (defaultCategory === 'gold') return 'GOLD_GRAM_BANK';
    if (defaultCategory === 'currency') return 'CURRENCY_EUR';
    if (defaultCategory === 'funds') {
      const firstFund = accounts.find(a => a.type === 'ASSET' && (a.subType === 'FUND' || a.subType === 'STOCK') && a.symbol);
      return firstFund?.symbol ? `FUND_${firstFund.symbol.toUpperCase()}` : 'CUSTOM_FUND';
    }
    return 'GOLD_GRAM_BANK';
  };

  const [selectedAssetKey, setSelectedAssetKey] = useState<string>(getInitialAssetKey);
  const [customFundCode, setCustomFundCode] = useState('TI2');
  const [customFundSuggestions, setCustomFundSuggestions] = useState<Array<{ code: string; name: string }>>([]);

  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Unique funds in user's portfolio across all groups
  const portfolioFunds = Array.from(
    new Map(
      accounts
        .filter(a => a.type === 'ASSET' && (a.subType === 'FUND' || a.subType === 'STOCK') && a.symbol)
        .map(a => [a.symbol!.toUpperCase(), a])
    ).values()
  );

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (defaultGroupId && groups.some(g => g.id === defaultGroupId)) {
        setSelectedGroupId(defaultGroupId);
      } else if (groups.length > 0 && (!selectedGroupId || !groups.some(g => g.id === selectedGroupId))) {
        setSelectedGroupId(groups[0].id);
      }
      
      const initKey = defaultAssetKey || getInitialAssetKey();
      setSelectedAssetKey(initKey);

      if (initKey.startsWith('FUND_')) {
        const sym = initKey.replace('FUND_', '').toUpperCase();
        setCustomFundCode(sym);
      } else if (initKey === 'CUSTOM_FUND') {
        setCustomFundCode('TI2');
      }

      setCustomFundSuggestions([]);
      setPasteText('');
      setParsedRows([]);
      setImportStatus(null);
    }
  }, [isOpen, defaultCategory, defaultAssetKey, defaultGroupId, groups]);

  const selectedGroup = groups.find(g => g.id === selectedGroupId) || groups[0];

  // Resolve active asset definition
  const getResolvedAsset = (): { 
    name: string; 
    subType: AssetSubType; 
    symbol: string; 
    unit: string; 
    isPhysical: boolean; 
    samplePrice: number; 
    sampleQty: number; 
    accountId?: string;
  } => {
    // 1. Portföy fonu seçilmişse (FUND_TI2 vb.)
    if (selectedAssetKey.startsWith('FUND_')) {
      const fundSymbol = selectedAssetKey.replace('FUND_', '').toUpperCase();
      const lookedUp = lookupTefasFund(fundSymbol);
      const existingAcc = accounts.find(a => 
        a.type === 'ASSET' && 
        (a.subType === 'FUND' || a.subType === 'STOCK') && 
        a.symbol?.toUpperCase() === fundSymbol
      );
      return {
        name: lookedUp ? lookedUp.name : (existingAcc?.name || `${fundSymbol} Fonu`),
        subType: 'FUND',
        symbol: fundSymbol,
        unit: 'pay',
        isPhysical: false,
        samplePrice: lookedUp?.estimatedPrice || 15.42,
        sampleQty: 1000
      };
    }

    // 2. Özel TEFAS Fonu (CUSTOM_FUND)
    if (selectedAssetKey === 'CUSTOM_FUND') {
      const upper = (customFundCode.trim() || 'TI2').toUpperCase();
      const lookedUp = lookupTefasFund(upper);
      return {
        name: lookedUp ? lookedUp.name : `${upper} Fonu`,
        subType: 'FUND',
        symbol: upper,
        unit: 'pay',
        isPhysical: false,
        samplePrice: lookedUp?.estimatedPrice || 15.42,
        sampleQty: 1000
      };
    }

    // 3. Ön tanımlı altın veya döviz
    const found = PREDEFINED_ASSETS.find(a => a.key === selectedAssetKey);
    if (found) {
      return {
        name: found.name,
        subType: found.subType,
        symbol: found.symbol,
        unit: found.unit,
        isPhysical: found.isPhysical,
        samplePrice: found.samplePrice,
        sampleQty: found.sampleQty
      };
    }

    // 4. Geriye dönük hesap eşleşmesi (ACCOUNT_ ID)
    if (selectedAssetKey.startsWith('ACCOUNT_')) {
      const accId = selectedAssetKey.replace('ACCOUNT_', '');
      const acc = accounts.find(a => a.id === accId);
      const isPhys = acc?.subType ? [
        'GOLD_GRAM_PHYSICAL', 
        'GOLD_CEYREK', 
        'GOLD_YARIM', 
        'GOLD_TAM', 
        'GOLD_CUMHURIYET'
      ].includes(acc.subType) : false;

      let unitStr = 'adet';
      if (acc?.subType === 'GOLD_GRAM_PHYSICAL' || acc?.subType === 'GOLD_GRAM_BANK') unitStr = 'gr';
      else if (acc?.currency === 'USD' || acc?.symbol === 'USD') unitStr = '$';
      else if (acc?.currency === 'EUR' || acc?.symbol === 'EUR') unitStr = '€';
      else if (acc?.subType === 'FUND') unitStr = 'pay';

      return {
        name: acc?.name || 'Varlık Hesabı',
        subType: acc?.subType || 'OTHER',
        symbol: acc?.symbol || 'VARLIK',
        unit: unitStr,
        isPhysical: isPhys,
        samplePrice: 100,
        sampleQty: isPhys ? 2 : 10,
        accountId: acc?.id
      };
    }

    return {
      name: 'Banka Gram Altın',
      subType: 'GOLD_GRAM_BANK',
      symbol: 'XAU_GR_BANK',
      unit: 'gr',
      isPhysical: false,
      samplePrice: 6560,
      sampleQty: 4.5
    };
  };

  const resolvedAsset = getResolvedAsset();

  const cleanCell = (c: string): string => c.trim().replace(/^["']|["']$/g, '').trim();

  // Smart line tokenizer: supports Tab (\t), Semicolon (;), and Comma (,) with unquoted decimal repair
  const parseLineTokens = (line: string): string[] => {
    // 1. Tab separated (Direct copy-paste from Excel or Google Sheets)
    if (line.includes('\t')) {
      return line.split('\t').map(c => cleanCell(c));
    }

    // 2. Semicolon separated (Standard Turkish Excel CSV)
    if (line.includes(';')) {
      return line.split(';').map(c => cleanCell(c));
    }

    // 3. Comma separated with quote support
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' || ch === "'") {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        tokens.push(cleanCell(current));
        current = '';
      } else {
        current += ch;
      }
    }
    tokens.push(cleanCell(current));

    // 4. Smart repair for unquoted decimal comma split:
    // e.g. "15.01.2025, 10, 5, 3150, 25, Açıklama"
    if (tokens.length >= 5 && isValidDateString(tokens[0])) {
      const isNum1 = !isNaN(Number(tokens[1]));
      const isNum2 = !isNaN(Number(tokens[2])) && tokens[2].length <= 3;
      const isNum3 = !isNaN(Number(tokens[3]));
      const isNum4 = !isNaN(Number(tokens[4])) && tokens[4].length <= 3;

      if (isNum1 && isNum2 && isNum3 && isNum4) {
        const recombinedQty = `${tokens[1]}.${tokens[2]}`;
        const recombinedPrice = `${tokens[3]}.${tokens[4]}`;
        const recombinedNote = tokens.slice(5).join(', ');
        return [tokens[0], recombinedQty, recombinedPrice, recombinedNote];
      } else if (isNum1 && isNum2 && isNum3 && !isNum4) {
        const recombinedQty = `${tokens[1]}.${tokens[2]}`;
        const price = tokens[3];
        const note = tokens.slice(4).join(', ');
        return [tokens[0], recombinedQty, price, note];
      }
    }

    return tokens;
  };

  // Robust date validation
  const isValidDateString = (str: string): boolean => {
    if (!str) return false;
    const s = str.trim();
    return /^\d{1,4}[./-]\d{1,2}[./-]\d{1,4}$/.test(s);
  };

  // Robust date parser (DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY)
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

  // Legacy 5-column fallback matcher
  const matchAssetFromType = (rawType: string): { name: string; subType: AssetSubType; symbol: string; unit: string; isPhysical: boolean } => {
    const t = rawType.toLowerCase();
    if (t.includes('fiziki') || t.includes('has alt')) {
      return { name: 'Fiziki Gram Altın', subType: 'GOLD_GRAM_PHYSICAL', symbol: 'XAU_GR_PHYSICAL', unit: 'gr', isPhysical: true };
    }
    if (t.includes('banka') || t.includes('gram')) {
      return { name: 'Banka Gram Altın', subType: 'GOLD_GRAM_BANK', symbol: 'XAU_GR_BANK', unit: 'gr', isPhysical: false };
    }
    if (t.includes('çeyrek') || t.includes('ceyrek')) {
      return { name: 'Çeyrek Altın', subType: 'GOLD_CEYREK', symbol: 'XAU_CEYREK', unit: 'adet', isPhysical: true };
    }
    if (t.includes('yarım') || t.includes('yarim')) {
      return { name: 'Yarım Altın', subType: 'GOLD_YARIM', symbol: 'XAU_YARIM', unit: 'adet', isPhysical: true };
    }
    if (t.includes('cumhuriyet') || t.includes('ata')) {
      return { name: 'Cumhuriyet Altını', subType: 'GOLD_CUMHURIYET', symbol: 'XAU_CUMHURIYET', unit: 'adet', isPhysical: true };
    }
    if (t.includes('tam') || t.includes('ziynet')) {
      return { name: 'Tam Altın', subType: 'GOLD_TAM', symbol: 'XAU_TAM', unit: 'adet', isPhysical: true };
    }
    if (t.includes('euro') || t === 'eur' || t.includes('€')) {
      return { name: 'Euro (EUR)', subType: 'CURRENCY', symbol: 'EUR', unit: '€', isPhysical: false };
    }
    if (t.includes('dolar') || t === 'usd' || t.includes('$')) {
      return { name: 'Amerikan Doları (USD)', subType: 'CURRENCY', symbol: 'USD', unit: '$', isPhysical: false };
    }
    if (t.includes('altın') || t.includes('altin') || t.includes('xau')) {
      return { name: 'Fiziki Gram Altın', subType: 'GOLD_GRAM_PHYSICAL', symbol: 'XAU_GR_PHYSICAL', unit: 'gr', isPhysical: true };
    }
    const sym = rawType.toUpperCase().trim();
    const lookedUp = lookupTefasFund(sym);
    return { name: lookedUp ? lookedUp.name : `${sym} Fonu`, subType: 'FUND', symbol: sym, unit: 'pay', isPhysical: false };
  };

  // Core Parsing Function
  const parseInput = (text: string) => {
    setPasteText(text);
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = text.trim().split(/\r?\n/);
    const rows: ParsedImportRow[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = parseLineTokens(line);
      if (cols.length < 3) continue;

      let dateRaw = '';
      let qtyRaw = '';
      let priceRaw = '';
      let noteCol = '';
      let lineAsset = resolvedAsset;

      if (isValidDateString(cols[0])) {
        // Standart 4 Sütunlu Desen: Tarih, Miktar, Fiyat, [Açıklama]
        dateRaw = cols[0];
        qtyRaw = cols[1];
        priceRaw = cols[2];
        noteCol = cols[3] || '';
      } else if (isValidDateString(cols[1])) {
        // Eski 5 Sütunlu Desen Geriye Dönük Destek: Varlık, Tarih, Miktar, Fiyat, [Açıklama]
        const rawType = cols[0];
        dateRaw = cols[1];
        qtyRaw = cols[2];
        priceRaw = cols[3];
        noteCol = cols[4] || '';
        const matched = matchAssetFromType(rawType);
        if (matched) {
          lineAsset = { ...lineAsset, ...matched, accountId: undefined };
        }
      } else {
        // Başlık satırı (örn: "Tarih;Miktar;Fiyat;Açıklama"), atla
        continue;
      }

      let qtyNum = parseUserInputNumber(qtyRaw);
      const priceNum = parseUserInputNumber(priceRaw);

      if (isNaN(qtyNum) || qtyNum === 0) continue;

      // FİZİKİ ALTIN KURALI: Fiziki altın adet ve gramları asla ondalıklı olamaz, tam sayıya yuvarlanır
      if (lineAsset.isPhysical) {
        qtyNum = Math.round(qtyNum);
      }

      const isBuy = qtyNum > 0;
      const absQty = Math.abs(qtyNum);
      const totalTRY = Math.round((absQty * priceNum) * 100) / 100;
      const { isoDate, year, month } = parseCleanDate(dateRaw);

      rows.push({
        id: `row-${i}-${Date.now()}`,
        accountId: lineAsset.accountId,
        assetName: lineAsset.name,
        subType: lineAsset.subType,
        symbol: lineAsset.symbol,
        unit: lineAsset.unit,
        isPhysical: lineAsset.isPhysical,
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

  // Re-parse when target asset changes
  useEffect(() => {
    if (pasteText) {
      parseInput(pasteText);
    }
  }, [selectedAssetKey, customFundCode]);

  // Dynamic CSV Template Download (Semicolon & Turkish Decimal Format)
  const downloadSampleCSV = () => {
    const q1 = resolvedAsset.isPhysical ? Math.round(resolvedAsset.sampleQty) : resolvedAsset.sampleQty;
    const q2 = resolvedAsset.isPhysical ? Math.max(1, Math.round(q1 * 0.5)) : Math.round(q1 * 0.5 * 100) / 100;
    const q3 = resolvedAsset.isPhysical ? q1 * 2 : q1 * 2;
    const q4 = resolvedAsset.isPhysical ? Math.max(1, Math.round(q1 * 0.4)) : Math.round(q1 * 0.4 * 100) / 100;

    const p1 = resolvedAsset.samplePrice;
    const csvContent = 
`Tarih;Miktar;Fiyat;Açıklama
15.01.2025;${q1};${formatForInput(p1)};Kasa birikimi alımı
22.03.2025;${formatForInput(q2)};${formatForInput(Math.round(p1 * 1.02 * 100) / 100)};Maaş birikimi takviye
10.05.2025;${q3};${formatForInput(Math.round(p1 * 1.05 * 100) / 100)};Yatırım alımı
15.06.2026;-${formatForInput(q4)};${formatForInput(Math.round(p1 * 1.15 * 100) / 100)};İhtiyaç için bozdurma`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanSym = resolvedAsset.symbol.toLowerCase().replace(/[^a-z0-9]/g, '-');
    link.setAttribute('download', `bizimkasa-${cleanSym}-sablon.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick Sample Paste
  const handleFillSample = () => {
    const q1 = resolvedAsset.isPhysical ? Math.round(resolvedAsset.sampleQty) : resolvedAsset.sampleQty;
    const q2 = resolvedAsset.isPhysical ? Math.max(1, Math.round(q1 * 0.5)) : Math.round(q1 * 0.5 * 100) / 100;
    const q3 = resolvedAsset.isPhysical ? q1 * 2 : q1 * 2;
    const q4 = resolvedAsset.isPhysical ? Math.max(1, Math.round(q1 * 0.4)) : Math.round(q1 * 0.4 * 100) / 100;
    const p1 = resolvedAsset.samplePrice;

    const sample = 
`15.01.2025;${q1};${formatForInput(p1)};İlk birikim alımı
22.03.2025;${formatForInput(q2)};${formatForInput(Math.round(p1 * 1.02 * 100) / 100)};Maaş takviyesi
10.05.2025;${q3};${formatForInput(Math.round(p1 * 1.05 * 100) / 100)};Ek alım
15.06.2026;-${formatForInput(q4)};${formatForInput(Math.round(p1 * 1.15 * 100) / 100)};Nakit ihtiyacı bozdurma`;
    parseInput(sample);
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

  // Import Execution
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0 || !selectedGroupId) return;

    try {
      const newTransactions: AssetTransaction[] = [];
      const currentAccounts: Account[] = [...accounts];

      for (const row of parsedRows) {
        let targetAccount: Account | undefined;

        // 1. Doğrudan seçilmiş mevcut hesap ID'si varsa
        if (row.accountId) {
          targetAccount = currentAccounts.find(a => a.id === row.accountId);
        }

        // 2. Grubun içinde kesin eşleşen varlık hesabı ara (Döviz, Fon, Altın)
        if (!targetAccount) {
          targetAccount = currentAccounts.find(a => {
            if (a.groupId !== selectedGroupId || a.type !== 'ASSET') return false;

            // DÖVİZ KURALI: Dolar ile Euro asla birbirine karışamaz!
            if (row.subType === 'CURRENCY') {
              if (a.subType !== 'CURRENCY') return false;
              if (a.symbol === row.symbol || a.currency === row.symbol) return true;
              // İsme göre toleranslı arama (ama diğer döviz türünü içermemeli)
              if (row.symbol === 'USD' && a.name.toLowerCase().includes('dolar') && !a.name.toLowerCase().includes('euro')) return true;
              if (row.symbol === 'EUR' && a.name.toLowerCase().includes('euro') && !a.name.toLowerCase().includes('dolar')) return true;
              return false;
            }

            // FON / BORSA KURALI: Fon kodu tam eşleşmeli (örn: TI2, MAC, AFT)
            if (row.subType === 'FUND' || row.subType === 'STOCK') {
              return (a.subType === 'FUND' || a.subType === 'STOCK') && 
                     a.symbol?.toUpperCase() === row.symbol?.toUpperCase();
            }

            // ALTIN KURALI: Altın alt türü (Fiziki Gram, Banka Gram, Çeyrek vb.) eşleşmeli
            if (row.subType.startsWith('GOLD_')) {
              if (a.subType !== row.subType) return false;
              if (a.symbol && row.symbol && a.symbol !== row.symbol) return false;
              return true;
            }

            // Diğer varlıklar
            return a.subType === row.subType && (!row.symbol || a.symbol === row.symbol);
          });
        }

        // 3. Hesap bulunamadıysa yeni hesap oluştur ve bellek içi listeye ekle
        if (!targetAccount) {
          let cleanAccName = row.assetName;
          if (row.subType !== 'FUND' && row.subType !== 'STOCK') {
            if (!cleanAccName.toLowerCase().includes(selectedGroup.name.toLowerCase())) {
              cleanAccName = `${selectedGroup.name} ${cleanAccName}`.trim();
            }
          } else {
            const tefas = row.symbol ? lookupTefasFund(row.symbol) : null;
            cleanAccName = tefas ? tefas.name : (cleanAccName || `${row.symbol} Fonu`);
          }

          const newAcc: Account = {
            id: `acc-import-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            groupId: selectedGroupId,
            name: cleanAccName,
            type: 'ASSET',
            subType: row.subType,
            symbol: row.symbol,
            currency: (row.symbol === 'EUR' || row.symbol === 'USD') ? (row.symbol as 'EUR' | 'USD') : 'TRY',
            order: currentAccounts.length + 1,
            createdAt: new Date().toISOString()
          };
          await db.accounts.add(newAcc);
          currentAccounts.push(newAcc); // Sonraki satırlar bu hesabı tekrar kullanır
          targetAccount = newAcc;

          // Yeni TEFAS fonu ise marketRate kaydı ekle
          if (row.subType === 'FUND') {
            const existingRate = await db.marketRates.get(row.symbol);
            if (!existingRate) {
              await db.marketRates.put({
                symbol: row.symbol,
                name: row.assetName,
                category: 'FUND',
                rateTRY: row.price > 0 ? row.price : 10,
                changeDailyPct: 0.5,
                source: 'TEFAS İçe Aktarım',
                dataDate: row.date,
                updatedAt: new Date().toISOString(),
                isManualOverride: false
              });
            }
          }
        }

        newTransactions.push({
          id: `tx-imp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
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
      await syncTefasFundRatesWithAssets();
      setImportStatus({
        success: true,
        message: `${parsedRows.length} adet işlem "${selectedGroup.name}" hesabına başarıyla aktarıldı!`
      });

      setTimeout(() => {
        setImportStatus(null);
        setPasteText('');
        setParsedRows([]);
        onClose();
      }, 1300);
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: `Hata oluştu: ${err?.message || 'Bilinmeyen hata'}`
      });
    }
  };

  // Summary figures
  const totalBuyQty = parsedRows.filter(r => r.isBuy).reduce((sum, r) => sum + r.quantity, 0);
  const totalSellQty = parsedRows.filter(r => !r.isBuy).reduce((sum, r) => sum + r.quantity, 0);
  const totalVolumeTRY = parsedRows.reduce((sum, r) => sum + r.totalTRY, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Excel / CSV Varlık Hareketlerini İçe Aktar"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* TOP SELECTORS: 1. Hedef Hesap & 2. Aktarılacak Varlık Türü */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-white/10 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Hedef Hesap (Direct account/group names) */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                1. Hedef Hesap
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => {
                  const newGid = e.target.value;
                  setSelectedGroupId(newGid);
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-medium text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Aktarılacak Varlık Türü */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                2. Aktarılacak Varlık Türü
              </label>
              <select
                value={selectedAssetKey}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedAssetKey(val);
                  if (val.startsWith('FUND_')) {
                    setCustomFundCode(val.replace('FUND_', '').toUpperCase());
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {/* Altın */}
                <optgroup label="🪙 Altın" className="bg-slate-900 text-slate-200">
                  {PREDEFINED_ASSETS.filter(a => a.category === 'GOLD').map(a => (
                    <option key={a.key} value={a.key} className="bg-slate-900 text-white font-medium">
                      {a.name}
                    </option>
                  ))}
                </optgroup>

                {/* Döviz */}
                <optgroup label="💶 Döviz" className="bg-slate-900 text-slate-200">
                  {PREDEFINED_ASSETS.filter(a => a.category === 'CURRENCY').map(a => (
                    <option key={a.key} value={a.key} className="bg-slate-900 text-white font-medium">
                      {a.name}
                    </option>
                  ))}
                </optgroup>

                {/* TEFAS Fonları & Borsa */}
                <optgroup label="📈 TEFAS Yatırım Fonları & Borsa" className="bg-slate-900 text-slate-200">
                  {portfolioFunds.map(f => {
                    const tefas = f.symbol ? lookupTefasFund(f.symbol) : null;
                    let displayName = tefas ? tefas.name : f.name;
                    const grp = groups.find(g => g.id === f.groupId);
                    if (!tefas && grp && displayName.toLowerCase().startsWith(grp.name.toLowerCase() + ' ')) {
                      displayName = displayName.slice(grp.name.length + 1).trim();
                    }
                    return (
                      <option key={`fund_${f.symbol}`} value={`FUND_${f.symbol!.toUpperCase()}`} className="bg-slate-900 text-white font-medium">
                        {f.symbol} - {displayName}
                      </option>
                    );
                  })}
                  <option value="CUSTOM_FUND" className="bg-slate-900 text-amber-300 font-medium">
                    + TEFAS Fon Kodu Gir (örn: TI2, MAC, AFT)...
                  </option>
                </optgroup>
              </select>
            </div>
          </div>

          {/* Conditional Input for TEFAS Fund Code */}
          {selectedAssetKey === 'CUSTOM_FUND' && (
            <div className="pt-2 border-t border-white/5 space-y-1">
              <label className="text-[11px] font-medium text-slate-400 block">
                TEFAS Fon Kodunu Girin (örn: TI2, MAC, AFT, BUY, BIO, NNF):
              </label>
              <input
                type="text"
                value={customFundCode}
                onChange={(e) => {
                  const upper = e.target.value.toUpperCase();
                  setCustomFundCode(upper);
                  if (upper.length >= 2) {
                    setCustomFundSuggestions(searchTefasFunds(upper));
                  } else {
                    setCustomFundSuggestions([]);
                  }
                }}
                placeholder="Örn: TI2"
                className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
              {customFundSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {customFundSuggestions.map(s => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => {
                        setCustomFundCode(s.code);
                        setCustomFundSuggestions([]);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-amber-300 font-mono"
                    >
                      {s.code} - {s.name.slice(0, 24)}...
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Physical Gold Indicator */}
          {resolvedAsset.isPhysical && (
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Fiziki altın alımlarında miktar tam sayı olmalıdır (adet / gr), ondalıklı girişler otomatik tam sayıya yuvarlanır.</span>
            </div>
          )}
        </div>

        {/* 4-COLUMN DATA PATTERN & RULES BANNER */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2.5 text-xs text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Veri Deseni: Sadece 4 Sütun</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFillSample}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-semibold border border-amber-500/30 transition-colors"
                title="Kutuya hemen hazır örnek veri doldurur"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Örnek Veriyi Doldur</span>
              </button>

              <button
                type="button"
                onClick={downloadSampleCSV}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-white/10 transition-colors"
              >
                <Download className="w-3 h-3 text-emerald-400" />
                <span>Şablonu İndir (.csv)</span>
              </button>
            </div>
          </div>

          <div className="p-2 px-3 rounded-xl bg-slate-900 border border-white/5 font-mono text-[11px] text-amber-300 overflow-x-auto flex items-center justify-between">
            <span>Tarih ; Miktar ; Fiyat ; [Açıklama]</span>
            <span className="text-slate-500 text-[10px] font-sans">Hedef: {resolvedAsset.name}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
            <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
              <span className="font-bold text-emerald-400 block">✓ Noktalı Virgül ( ; )</span>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Türkçe Excel standardıdır. Sayılardaki ondalık virgülleri (<code className="text-white">4,5</code>) sütunlarla asla karışmaz.
              </p>
            </div>

            <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
              <span className="font-bold text-blue-400 block">✓ Sekme ( Tab )</span>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Excel veya Google Sheets'ten seçip <strong>Ctrl+C</strong> ile kopyalayıp buraya <strong>Ctrl+V</strong> yapabilirsiniz.
              </p>
            </div>

            <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
              <span className="font-bold text-amber-400 block">✓ Ondalık & Alış/Satış</span>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Alışlar <strong className="text-emerald-400">+</strong>, satışlar <strong className="text-rose-400">-</strong>'dir. {resolvedAsset.isPhysical ? 'Fiziki altın tam sayıdır.' : 'Ondalıkta virgül ve nokta desteklenir.'}
              </p>
            </div>
          </div>
        </div>

        {/* TEXT INPUT / FILE UPLOAD */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">
              Verileri Yapıştırın veya CSV Dosyası Seçin:
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
            placeholder={`Örnek Format (Ctrl + V ile yapıştırın):\n15.01.2025; ${resolvedAsset.isPhysical ? '5' : '5,5'}; ${formatForInput(resolvedAsset.samplePrice)}; İlk birikim alımı\n20.03.2025; ${resolvedAsset.isPhysical ? '2' : '2,5'}; ${formatForInput(Math.round(resolvedAsset.samplePrice * 1.02 * 100) / 100)}; Maaş takviyesi\n12.06.2026; -${resolvedAsset.isPhysical ? '1' : '1,5'}; ${formatForInput(Math.round(resolvedAsset.samplePrice * 1.15 * 100) / 100)}; Bozdurma`}
            className="w-full p-3 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-amber-400 placeholder:text-slate-600"
          />
        </div>

        {/* PARSED PREVIEW TABLE & SUMMARY */}
        {parsedRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-white flex items-center gap-2">
                <span>Önizleme ({parsedRows.length} İşlem)</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                  {selectedGroup.name} • {resolvedAsset.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setParsedRows([]);
                    setPasteText('');
                  }}
                  className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline font-normal ml-1"
                >
                  Listeyi Temizle
                </button>
              </span>

              <div className="flex items-center gap-2 font-mono text-[11px]">
                {totalBuyQty > 0 && (
                  <span className="text-emerald-400">
                    Alış: +{formatNumber(totalBuyQty, resolvedAsset.isPhysical ? 0 : 2)} {resolvedAsset.unit}
                  </span>
                )}
                {totalSellQty > 0 && (
                  <span className="text-rose-400">
                    Satış: -{formatNumber(totalSellQty, resolvedAsset.isPhysical ? 0 : 2)} {resolvedAsset.unit}
                  </span>
                )}
                <span className="text-white font-bold">
                  Hacim: {formatTRY(totalVolumeTRY)}
                </span>
              </div>
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-slate-950 text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 bg-slate-900/60 sticky top-0 z-10">
                    <th className="py-2 px-2.5">Tarih</th>
                    <th className="py-2 px-2 text-center">Tür</th>
                    <th className="py-2 px-2.5 text-right">Miktar</th>
                    <th className="py-2 px-2.5 text-right">Birim Fiyat</th>
                    <th className="py-2 px-2.5 text-right">Toplam Tutar</th>
                    <th className="py-2 px-2.5">Açıklama</th>
                    <th className="py-2 px-2 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {parsedRows.map((r) => (
                    <tr key={r.id} className="hover:bg-white/[0.02]">
                      <td className="py-1.5 px-2.5 text-slate-300 text-[11px]">{r.date}</td>
                      <td className="py-1.5 px-2 text-center">
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          r.isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                        }`}>
                          {r.isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {r.isBuy ? 'ALIŞ' : 'SATIŞ'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-white font-bold">
                        {r.isBuy ? '+' : '-'}{formatNumber(r.quantity, r.isPhysical ? 0 : 2)} {r.unit}
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-slate-400">
                        {formatNumber(r.price, 2)} ₺
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-amber-300 font-bold">
                        {formatTRY(r.totalTRY)}
                      </td>
                      <td className="py-1.5 px-2.5 text-slate-400 font-sans text-[11px] truncate max-w-[120px]">
                        {r.note || '-'}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(r.id)}
                          title="Bu satırı listeden kaldır"
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

        {/* FEEDBACK STATUS */}
        {importStatus && (
          <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
            importStatus.success ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
          }`}>
            {importStatus.success ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{importStatus.message}</span>
          </div>
        )}

        {/* ACTION BUTTONS */}
        <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={parsedRows.length === 0}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20 active:scale-95"
          >
            {parsedRows.length > 0 
              ? `${parsedRows.length} İşlemi "${selectedGroup.name} (${resolvedAsset.name})" İçin Aktar` 
              : 'İçe Aktar'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
