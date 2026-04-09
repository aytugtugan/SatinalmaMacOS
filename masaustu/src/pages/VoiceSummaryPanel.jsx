/**
 * VoiceSummaryPanel — Masaüstü Sesli Özet Paneli
 * Tüm rapor bölümlerini kapsayan kapsamlı sesli raporlama (web Speech API).
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Button, Select, Checkbox, Card, Tag, Progress, Spin,
  Typography, Space, Divider, message, Tooltip,
} from 'antd';
import {
  PlayCircleOutlined, PauseOutlined, StopOutlined,
  MailOutlined, SoundOutlined, ReloadOutlined,
  CheckSquareOutlined, MinusSquareOutlined,
} from '@ant-design/icons';
import {
  getRaporOzet, getRaporLokasyon, getRaporTedarikci,
  getRaporRekabet, getRaporTrend,
} from '../api/ihaleApi';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// ─── Formatters ───────────────────────────────────────
function fmtCurrency(val, currency = 'TRY') {
  if (!val && val !== 0) return '—';
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'decimal', maximumFractionDigits: 0 }).format(val) + ' ' + currency;
  } catch { return String(val); }
}
function fmtNumber(val) {
  if (!val && val !== 0) return '0';
  return new Intl.NumberFormat('tr-TR').format(val);
}

// ─── Constants ───────────────────────────────────────
const PERIOD_LABELS = {
  daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık', yearly: 'Yıllık',
};

const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const CATEGORY_META = {
  genel:         { color: '#0a6ed1', label: 'Genel Özet' },
  teslimat:      { color: '#107e3e', label: 'Teslimat' },
  siparis:       { color: '#6366f1', label: 'Sipariş Analizi' },
  tedarikci:     { color: '#e9730c', label: 'Tedarikçi' },
  masraf:        { color: '#7c3aed', label: 'Masraf Merkezi' },
  finans:        { color: '#1e88e5', label: 'Finansal' },
  trend:         { color: '#43a047', label: 'Trend' },
  talep:         { color: '#bb0000', label: 'Talep' },
  karsilastirma: { color: '#8B5CF6', label: 'Fabrika Karşılaştırma' },
  ihale:         { color: '#d97706', label: 'İhale Raporları' },
};

const REPORT_CATEGORY_MAP = {
  dashboard:         ['genel', 'teslimat', 'trend', 'masraf', 'tedarikci', 'finans', 'talep'],
  dashboard_compare: ['karsilastirma'],
  ihale:             ['ihale'],
  talep:             ['talep', 'masraf'],
  siparis:           ['siparis', 'teslimat', 'trend'],
  tedarikci:         ['tedarikci'],
  finansal:          ['finans', 'masraf'],
};

const REPORT_OPTIONS = [
  { key: 'dashboard',         label: 'Ana Sayfa (Dashboard)' },
  { key: 'dashboard_compare', label: 'Fabrika Karşılaştırma' },
  { key: 'ihale',             label: 'İhale Raporları' },
  { key: 'talep',             label: 'Talep Analizi' },
  { key: 'siparis',           label: 'Sipariş Analizi' },
  { key: 'tedarikci',         label: 'Tedarikçi Analizi' },
  { key: 'finansal',          label: 'Finansal Analiz' },
];

// ─── Item builder ────────────────────────────────────
let _id = 0;
function item(category, title, text, priority = 5) {
  return { id: ++_id, category, title, text, priority, selected: true };
}

async function safeFetch(fn, fallback = null) {
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ]);
  } catch (e) {
    console.warn('[VoiceSummaryPanel] safeFetch:', e?.message);
    return fallback;
  }
}

// ─── Core generator (async) ──────────────────────────
async function generateItems(dashboardData, comparisonData, selectedReports) {
  _id = 0;
  const items = [];

  const includedCategories = new Set();
  const reports = Array.isArray(selectedReports) && selectedReports.length > 0
    ? selectedReports : Object.keys(REPORT_CATEGORY_MAP);
  reports.forEach((r) => (REPORT_CATEGORY_MAP[r] || []).forEach((c) => includedCategories.add(c)));
  const need = (cat) => includedCategories.has(cat);

  const data = dashboardData;
  if (!data || !data.summary) {
    return [item('genel', 'Veri Yok', 'Şu an için gösterilecek veri bulunmamaktadır.', 1)];
  }

  const {
    summary,
    monthlyTrend  = [],
    tedarikci     = [],
    masrafMerkezi = [],
    durum         = [],
    paraBirimi    = [],
    odemeVadesi   = [],
    talepEden     = [],
  } = data;

  // Genel
  if (need('genel')) {
    items.push(item('genel', 'Genel Satınalma Özeti',
      `Toplam ${fmtNumber(summary.totalSiparis)} sipariş, ` +
      `${fmtCurrency(summary.toplamTutarTRY || summary.toplamTutar)} toplam tutar. ` +
      `${fmtNumber(summary.totalTalep || 0)} talep, ${fmtNumber(summary.totalTedarikci)} tedarikçi.`,
      1));
  }

  // Teslimat
  if (need('teslimat')) {
    const teslim = summary.totalTeslimat || 0;
    const bekleyen = summary.bekleyenTeslimat || 0;
    const total = teslim + bekleyen;
    const oran = total > 0 ? Math.round((teslim / total) * 100) : 0;
    items.push(item('teslimat', 'Teslimat Durumu',
      `${fmtNumber(total)} siparişin ${fmtNumber(teslim)} adedi teslim (yüzde ${oran}). ` +
      `${fmtNumber(bekleyen)} adet beklemede.`, 2));
    if (bekleyen > 0)
      items.push(item('teslimat', 'Bekleyen Teslimatlar',
        `Dikkat: ${fmtNumber(bekleyen)} bekleyen sipariş var. Takip önerilir.`, 2));
  }

  // Siparis
  if (need('siparis')) {
    items.push(item('siparis', 'Sipariş Analizi Özeti',
      `${fmtNumber(summary.totalSiparis)} sipariş, ${fmtNumber(summary.totalTalep || 0)} talep. ` +
      `Toplam ${fmtCurrency(summary.toplamTutarTRY || summary.toplamTutar)}, ` +
      `ortalama ${fmtCurrency(summary.ortalamaTutar || 0)} / sipariş.`, 3));

    const validDurum = durum.filter((d) => (d.siparisAdedi || 0) > 0);
    if (validDurum.length > 0) {
      const str = validDurum.slice()
        .sort((a, b) => (b.siparisAdedi || 0) - (a.siparisAdedi || 0))
        .map((d) => `${d.durum}: ${fmtNumber(d.siparisAdedi)}`)
        .join(', ');
      items.push(item('siparis', 'Sipariş Durum Dağılımı', `Durum dağılımı: ${str}.`, 3));
    }
  }

  // Tedarikci
  if (need('tedarikci')) {
    items.push(item('tedarikci', 'Tedarikçi Özeti',
      `Toplam ${fmtNumber(summary.totalTedarikci)} farklı tedarikçi.`, 4));

    const top5 = tedarikci.slice(0, 5);
    if (top5.length > 0) {
      const str = top5.map((t, i) =>
        `${i + 1}. ${t.tedarikci}: ${fmtCurrency(t.toplamTutar)} (${fmtNumber(t.siparisAdedi)} sipariş)`
      ).join('. ');
      items.push(item('tedarikci', 'En Büyük 5 Tedarikçi', str, 4));
    }

    const byAdet = tedarikci.slice().sort((a, b) => (b.siparisAdedi || 0) - (a.siparisAdedi || 0)).slice(0, 3);
    if (byAdet.length > 0) {
      const str = byAdet.map((t, i) =>
        `${i + 1}. ${t.tedarikci}: ${fmtNumber(t.siparisAdedi)} sipariş`
      ).join('. ');
      items.push(item('tedarikci', 'En Fazla Sipariş Verilen 3 Tedarikçi', str, 4));
    }
  }

  // Masraf
  if (need('masraf')) {
    const topM = masrafMerkezi.slice(0, 5);
    if (topM.length > 0) {
      const str = topM.map((m, i) =>
        `${i + 1}. ${m.masrafMerkezi}: ${fmtCurrency(m.toplamTutar)}`
      ).join('. ');
      items.push(item('masraf', 'Masraf Merkezi Dağılımı (İlk 5)', str, 5));
    }
  }

  // Finans
  if (need('finans')) {
    const validPB = paraBirimi.filter((p) => p.paraBirimi && p.paraBirimi !== 'Belirsiz');
    if (validPB.length > 0) {
      const str = validPB.slice().sort((a, b) => (b.toplamTutar || 0) - (a.toplamTutar || 0))
        .map((p) => `${p.paraBirimi}: ${fmtCurrency(p.toplamTutar)}`).join(', ');
      items.push(item('finans', 'Para Birimi Dağılımı', str, 6));
    }
    const topVade = odemeVadesi.filter((v) => v.odemeVadesi !== 'Belirtilmemiş').slice(0, 4);
    if (topVade.length > 0) {
      const str = topVade.map((v) =>
        `${v.odemeVadesi}: ${fmtCurrency(v.toplamTutar)}`
      ).join('. ');
      items.push(item('finans', 'Ödeme Vadesi Dağılımı', str, 6));
    }
  }

  // Trend
  if (need('trend')) {
    const recent = monthlyTrend.slice(0, 4);
    if (recent.length > 0) {
      const str = recent.map((m) => {
        const [yr, mo] = m.ay.split('-');
        return `${MONTH_NAMES_TR[parseInt(mo, 10) - 1]} ${yr}: ${fmtCurrency(m.toplamTutar)}`;
      }).join('. ');
      items.push(item('trend', 'Aylık Trend (Son 4 Ay)', str, 7));

      if (recent.length >= 2 && recent[1].toplamTutar > 0) {
        const curr = recent[0];
        const prev = recent[1];
        const ch = ((curr.toplamTutar - prev.toplamTutar) / prev.toplamTutar * 100).toFixed(1);
        const dir = Number(ch) >= 0 ? 'artış' : 'azalış';
        items.push(item('trend', 'Aylık Karşılaştırma',
          `Önceki aya göre yüzde ${Math.abs(Number(ch))} ${dir}. ` +
          `${fmtCurrency(prev.toplamTutar)} → ${fmtCurrency(curr.toplamTutar)}.`, 7));
      }
    }
  }

  // Talep
  if (need('talep')) {
    const top5T = talepEden.filter((t) => t.talepEden && t.talepEden !== 'Belirsiz').slice(0, 5);
    if (top5T.length > 0) {
      const str = top5T.map((t, i) =>
        `${i + 1}. ${t.talepEden}: ${fmtCurrency(t.toplamTutar)}`
      ).join('. ');
      items.push(item('talep', 'En Çok Talep Edenler (İlk 5)', str, 8));
    }
    const tt = summary.totalTalep || 0;
    if (tt > 0 && summary.totalSiparis > 0) {
      const oran = ((summary.totalSiparis / tt) * 100).toFixed(0);
      items.push(item('talep', 'Talep-Sipariş Dönüşümü',
        `${fmtNumber(tt)} talepten ${fmtNumber(summary.totalSiparis)} sipariş. Oran: yüzde ${oran}.`, 8));
    }
  }

  // Karsilastirma
  if (need('karsilastirma')) {
    const comp = comparisonData || {};
    const entries = Object.entries(comp)
      .map(([name, d]) => ({ name, ...d }))
      .filter((d) => (d.siparisAdedi || 0) > 0);

    if (entries.length > 0) {
      const total = entries.reduce((s, d) => s + (d.toplamTutar || 0), 0);
      items.push(item('karsilastirma', 'Fabrika Karşılaştırma Özeti',
        `${entries.length} aktif fabrika toplamında ${fmtCurrency(total)}.`, 9));

      const byT = entries.slice().sort((a, b) => b.toplamTutar - a.toplamTutar).slice(0, 5);
      const str = byT.map((d, i) =>
        `${i + 1}. ${d.name}: ${fmtCurrency(d.toplamTutar)} (${fmtNumber(d.siparisAdedi)} sipariş)`
      ).join('. ');
      items.push(item('karsilastirma', 'Fabrika Bazında Tutar (İlk 5)', str, 9));

      const byOran = entries.slice().sort((a, b) => (b.teslimOrani || 0) - (a.teslimOrani || 0)).slice(0, 5);
      if (byOran.length > 0) {
        const str2 = byOran.map((d) =>
          `${d.name}: yüzde ${d.teslimOrani || 0} teslim`
        ).join(', ');
        items.push(item('karsilastirma', 'Fabrika Teslim Oranları', str2, 9));
      }
    }
  }

  // İhale
  if (need('ihale')) {
    try {
      const [ozetRes, lokRes, tedRes, rekRes, trendRes] = await Promise.all([
        safeFetch(() => getRaporOzet()),
        safeFetch(() => getRaporLokasyon()),
        safeFetch(() => getRaporTedarikci()),
        safeFetch(() => getRaporRekabet()),
        safeFetch(() => getRaporTrend()),
      ]);

      if (ozetRes?.success && ozetRes.data) {
        const oz = ozetRes.data;
        const cnt  = oz.toplamIhaleSayisi || oz.toplam_ihale_sayisi || 0;
        const kazanc = oz.toplamKazancTl || oz.toplam_kazanc_tl || 0;
        const ort = oz.ortalamaKazancTl || oz.ortalama_kazanc_tl || 0;
        items.push(item('ihale', 'İhale Özeti',
          `Toplam ${fmtNumber(cnt)} ihale. Toplam getiri ${fmtCurrency(kazanc)}, ` +
          `ortalama ${fmtCurrency(ort)}.`, 10));
      } else {
        items.push(item('ihale', 'İhale Raporları', 'İhale verileri alınamadı. Sunucu bağlantısını kontrol edin.', 10));
      }

      if (lokRes?.success && lokRes.data?.length > 0) {
        const top5 = lokRes.data.slice()
          .sort((a, b) => (b.toplamKazancTl || b.toplam_kazanc_tl || 0) - (a.toplamKazancTl || a.toplam_kazanc_tl || 0))
          .slice(0, 5);
        const str = top5.map((l, i) =>
          `${i + 1}. ${l.lokasyon || 'Belirsiz'}: ${fmtCurrency(l.toplamKazancTl || l.toplam_kazanc_tl || 0)}`
        ).join('. ');
        items.push(item('ihale', 'İhale Lokasyon Dağılımı', str, 10));
      }

      if (tedRes?.success && tedRes.data?.length > 0) {
        const top5 = tedRes.data.slice()
          .sort((a, b) => (b.toplamKazancTl || b.toplam_kazanc_tl || 0) - (a.toplamKazancTl || a.toplam_kazanc_tl || 0))
          .slice(0, 5);
        const str = top5.map((t, i) => {
          const ad = t.kazananTedarikci || t.kazanan_tedarikci || 'Bilinmiyor';
          return `${i + 1}. ${ad}: ${fmtCurrency(t.toplamKazancTl || t.toplam_kazanc_tl || 0)}`;
        }).join('. ');
        items.push(item('ihale', 'İhale Tedarikçi Sıralaması', str, 10));
      }

      if (trendRes?.success && trendRes.data?.length > 0) {
        const AY = ['', 'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
        const str = trendRes.data
          .map((d) => `${AY[d.ay || d.month] || '?'}: ${fmtCurrency(d.toplamKazancTl || d.toplam_kazanc_tl || 0)}`)
          .join(', ');
        items.push(item('ihale', 'İhale Aylık Trend', str, 10));
      }

      if (rekRes?.success && rekRes.data?.length > 0) {
        const stats = {};
        rekRes.data.forEach((r) => {
          const a = r.firmaA || r.firma_a || '';
          const b = r.firmaB || r.firma_b || '';
          const c = r.kacIhaledeKarsilastilar || r.kac_ihalede_karsilastilar || 0;
          if (a) stats[a] = (stats[a] || 0) + c;
          if (b) stats[b] = (stats[b] || 0) + c;
        });
        const top3 = Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 3);
        if (top3.length > 0) {
          const str = top3.map(([f, c], i) => `${i + 1}. ${f}: ${c} ihalede`).join('. ');
          items.push(item('ihale', 'Rekabet Analizi', str, 10));
        }
      }
    } catch (err) {
      console.warn('[VoiceSummaryPanel] ihale error:', err?.message);
      items.push(item('ihale', 'İhale Raporları', 'İhale verileri alınırken hata oluştu.', 10));
    }
  }

  return items.filter((it) => includedCategories.has(it.category));
}

// ═══════════════════════════════════════════════════
// PANEL BİLEŞENİ
// ═══════════════════════════════════════════════════
const VoiceSummaryPanel = ({ dashboardData, comparisonData, selectedAmbar, ambarList = [] }) => {
  const [items, setItems]                   = useState([]);
  const [loading, setLoading]               = useState(false);
  const [selectedReports, setSelectedReports] = useState(['dashboard']);
  const [currentIndex, setCurrentIndex]     = useState(-1);
  const [isSpeaking, setIsSpeaking]         = useState(false);
  const [isPaused, setIsPaused]             = useState(false);
  const [selectedIds, setSelectedIds]       = useState(new Set());
  const [catFilter, setCatFilter]           = useState(null);
  const [speechRate, setSpeechRate]         = useState(1);

  const synthRef     = useRef(null);
  const stopRef      = useRef(false);
  const playingRef   = useRef(false);
  const indexRef     = useRef(-1);

  // Load data
  const loadData = useCallback(async (reports) => {
    setLoading(true);
    stopRef.current = true;
    if (synthRef.current) { window.speechSynthesis.cancel(); synthRef.current = null; }
    playingRef.current = false;
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentIndex(-1);
    indexRef.current = -1;

    try {
      const result = await generateItems(dashboardData, comparisonData, reports);
      setItems(result);
      setSelectedIds(new Set(result.map((i) => i.id)));
    } catch (err) {
      console.warn('VoiceSummaryPanel load error:', err);
      message.error('Veri yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [dashboardData, comparisonData]);

  useEffect(() => {
    loadData(selectedReports);
  }, [dashboardData, comparisonData]);  // eslint-disable-line

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRef.current = true;
      window.speechSynthesis?.cancel();
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (!catFilter) return items;
    return items.filter((it) => it.category === catFilter);
  }, [items, catFilter]);

  const categories = useMemo(() => [...new Set(items.map((i) => i.category))], [items]);
  const selectedCount = useMemo(() => items.filter((i) => selectedIds.has(i.id)).length, [items, selectedIds]);

  // TTS
  const speakText = useCallback((text) => new Promise((resolve) => {
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'tr-TR';
    utt.rate = speechRate;
    utt.onend = resolve;
    utt.onerror = resolve;
    synthRef.current = utt;
    window.speechSynthesis.speak(utt);
  }), [speechRate]);

  const playFromIndex = useCallback(async (startIdx) => {
    if (playingRef.current) return;
    playingRef.current = true;
    stopRef.current = false;
    setIsSpeaking(true);
    setIsPaused(false);
    setCurrentIndex(-1);
    indexRef.current = -1;

    await speakText(`Satınalma raporu. Toplam ${filteredItems.length} madde.`);
    if (stopRef.current) { playingRef.current = false; setIsSpeaking(false); return; }

    for (let i = startIdx; i < filteredItems.length; i++) {
      if (stopRef.current) break;
      setCurrentIndex(i);
      indexRef.current = i;
      const it = filteredItems[i];
      if (!selectedIds.has(it.id)) continue;
      await speakText(`${it.title}. ${it.text}`);
      if (stopRef.current) break;
    }

    if (!stopRef.current) { setCurrentIndex(-1); indexRef.current = -1; }
    playingRef.current = false;
    setIsSpeaking(false);
    setIsPaused(false);
  }, [filteredItems, speakText, selectedIds]);

  const handlePlay = useCallback(() => {
    if (isSpeaking && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    } else if (isSpeaking && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      playFromIndex(0);
    }
  }, [isSpeaking, isPaused, playFromIndex]);

  const handleStop = useCallback(() => {
    stopRef.current = true;
    window.speechSynthesis.cancel();
    synthRef.current = null;
    playingRef.current = false;
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentIndex(-1);
    indexRef.current = -1;
  }, []);

  const handleReportChange = (vals) => {
    setSelectedReports(vals);
    loadData(vals);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((i) => i.id)));
  };

  const handleEmail = () => {
    const sel = items.filter((i) => selectedIds.has(i.id));
    if (!sel.length) { message.warning('Lütfen en az bir madde seçin.'); return; }
    const subject = `Satınalma Rapor Özeti`;
    const groups = {};
    sel.forEach((it) => { (groups[it.category] = groups[it.category] || []).push(it); });
    let body = `SATINALMA KAPSAMLI RAPOR ÖZETİ\n${'='.repeat(50)}\n\n`;
    Object.entries(CATEGORY_META).forEach(([key, meta]) => {
      const grp = groups[key];
      if (!grp || !grp.length) return;
      body += `${meta.label.toUpperCase()}\n${'-'.repeat(40)}\n`;
      grp.forEach((it) => { body += `  • ${it.title}\n    ${it.text}\n\n`; });
    });
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, '_blank');
  };

  const playIconName = isSpeaking && !isPaused ? 'pause' : 'play';

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto', background: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SoundOutlined style={{ fontSize: 24, color: '#0a6ed1' }} />
          <Title level={3} style={{ margin: 0 }}>Sesli Özet</Title>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadData(selectedReports)}>Yenile</Button>
          <Button icon={<MailOutlined />} onClick={handleEmail} disabled={!selectedCount}>
            E-posta ({selectedCount})
          </Button>
        </Space>
      </div>

      {/* Controls */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          {/* Report selector */}
          <div style={{ flex: '1 1 300px' }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Rapor Bölümleri</Text>
            <Checkbox.Group
              style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}
              value={selectedReports}
              onChange={handleReportChange}
            >
              {REPORT_OPTIONS.map((r) => (
                <Checkbox key={r.key} value={r.key}>{r.label}</Checkbox>
              ))}
            </Checkbox.Group>
          </div>

          {/* Speed + Playback */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Text strong>Okuma Hızı</Text>
            <Select
              value={speechRate}
              onChange={setSpeechRate}
              style={{ width: 120 }}
              options={[
                { value: 0.7, label: '0.7x Yavaş' },
                { value: 0.85, label: '0.85x' },
                { value: 1.0, label: '1x Normal' },
                { value: 1.2, label: '1.2x Hızlı' },
                { value: 1.5, label: '1.5x Çok Hızlı' },
              ]}
            />
            <Space>
              <Tooltip title={isSpeaking && !isPaused ? 'Duraklat' : isSpeaking ? 'Devam' : 'Oynat'}>
                <Button
                  type="primary"
                  icon={isSpeaking && !isPaused ? <PauseOutlined /> : <PlayCircleOutlined />}
                  onClick={handlePlay}
                  disabled={loading || !filteredItems.length}
                  style={{ minWidth: 48 }}
                />
              </Tooltip>
              <Tooltip title="Durdur">
                <Button
                  icon={<StopOutlined />}
                  onClick={handleStop}
                  disabled={!isSpeaking}
                  danger
                  style={{ minWidth: 48 }}
                />
              </Tooltip>
            </Space>
          </div>
        </div>

        {/* Now playing progress */}
        {isSpeaking && (
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {isPaused ? '⏸ Duraklatıldı' : '▶ Oynatılıyor'} — Madde {Math.max(0, currentIndex + 1)} / {filteredItems.length}
            </Text>
            <Progress
              percent={filteredItems.length > 0 ? Math.round(((currentIndex + 1) / filteredItems.length) * 100) : 0}
              size="small"
              style={{ marginTop: 4 }}
              showInfo={false}
            />
            {currentIndex >= 0 && filteredItems[currentIndex] && (
              <Text strong style={{ fontSize: 13, color: '#0a6ed1' }}>
                {filteredItems[currentIndex].title}
              </Text>
            )}
          </div>
        )}
      </Card>

      {/* Category filter */}
      <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <Text strong style={{ marginRight: 4 }}>Kategori:</Text>
        <Tag
          color={!catFilter ? '#0a6ed1' : 'default'}
          style={{ cursor: 'pointer' }}
          onClick={() => setCatFilter(null)}
        >
          Tümü ({items.length})
        </Tag>
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat];
          const cnt = items.filter((i) => i.category === cat).length;
          return (
            <Tag
              key={cat}
              color={catFilter === cat ? meta.color : 'default'}
              style={{ cursor: 'pointer' }}
              onClick={() => setCatFilter(catFilter === cat ? null : cat)}
            >
              {meta?.label || cat} ({cnt})
            </Tag>
          );
        })}

        <div style={{ marginLeft: 'auto' }}>
          <Button
            size="small"
            icon={selectedIds.size === items.length ? <MinusSquareOutlined /> : <CheckSquareOutlined />}
            onClick={toggleSelectAll}
          >
            {selectedIds.size === items.length ? 'Temizle' : 'Tümünü Seç'}
          </Button>
        </div>
      </div>

      {/* Items list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" tip="Rapor oluşturuluyor..." /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredItems.length === 0 ? (
            <Card><Text type="secondary">Seçilen raporlar için gösterilecek veri yok.</Text></Card>
          ) : (
            filteredItems.map((it, idx) => {
              const meta = CATEGORY_META[it.category] || CATEGORY_META.genel;
              const isPlaying = isSpeaking && currentIndex === idx;
              const isSelected = selectedIds.has(it.id);
              return (
                <Card
                  key={it.id}
                  size="small"
                  style={{
                    borderLeft: `4px solid ${meta.color}`,
                    background: isPlaying ? meta.color + '11' : isSelected ? '#fff' : '#fafafa',
                    opacity: isSelected ? 1 : 0.6,
                    transition: 'all 0.3s',
                  }}
                  extra={
                    <Space size={4}>
                      <Tooltip title={isPlaying ? 'Şu an okunuyor' : 'Bu maddeden oynat'}>
                        <Button
                          size="small"
                          type={isPlaying ? 'primary' : 'default'}
                          icon={isPlaying ? <PauseOutlined /> : <PlayCircleOutlined />}
                          onClick={() => { if (!isPlaying) { handleStop(); setTimeout(() => playFromIndex(idx), 300); } else handleStop(); }}
                        />
                      </Tooltip>
                      <Checkbox
                        checked={isSelected}
                        onChange={() => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(it.id)) next.delete(it.id);
                            else next.add(it.id);
                            return next;
                          });
                        }}
                      />
                    </Space>
                  }
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Tag color={meta.color} style={{ margin: 0, fontSize: 11 }}>{meta.label}</Tag>
                      <Text strong style={{ fontSize: 13 }}>{it.title}</Text>
                      {isPlaying && <Tag color="processing" style={{ fontSize: 10 }}>▶ OKUNUYOR</Tag>}
                    </div>
                    <Paragraph
                      style={{ margin: 0, fontSize: 12, color: '#444' }}
                      ellipsis={{ rows: 3, expandable: true }}
                    >
                      {it.text}
                    </Paragraph>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceSummaryPanel;
