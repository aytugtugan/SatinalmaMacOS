import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import {
  TrophyOutlined, BarChartOutlined, PieChartFilled, LineChartOutlined,
  LeftOutlined, RightOutlined,
  SwapOutlined, DollarOutlined, ThunderboltOutlined, CrownOutlined,
  FireOutlined, AimOutlined, ReloadOutlined,
} from '@ant-design/icons';
import {
  getRaporOzet, getRaporLokasyon, getRaporTedarikci,
  getRaporRekabet, getRaporTrend, getRaporTasarruf,
  getLokasyonlar,
} from '../api/ihaleApi';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
];

const fmtCurrency = (val) => {
  if (!val && val !== 0) return '0 TL';
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val) + ' TL';
};

const fmtShort = (val) => {
  if (!val && val !== 0) return '0';
  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (val >= 1000) return (val / 1000).toFixed(0) + 'K';
  return val.toLocaleString('tr-TR');
};

const ChartTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', padding: '10px 14px', borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
      <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>{label || payload[0]?.name}</div>
      {payload.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fff', fontSize: 13 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.color, display: 'inline-block' }} />
          <span>{e.name || 'Deger'}:</span>
          <span style={{ fontWeight: 600 }}>{formatter ? formatter(e.value) : e.value?.toLocaleString('tr-TR')}</span>
        </div>
      ))}
    </div>
  );
};

const ChartSwitch = ({ mode, setMode, types = ['bar', 'pie', 'line'] }) => (
  <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
    {types.includes('bar') && (
      <button onClick={() => setMode('bar')}
        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14,
          background: mode === 'bar' ? '#3b82f6' : 'transparent', color: mode === 'bar' ? '#fff' : '#64748b' }}>
        <BarChartOutlined />
      </button>
    )}
    {types.includes('pie') && (
      <button onClick={() => setMode('pie')}
        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14,
          background: mode === 'pie' ? '#3b82f6' : 'transparent', color: mode === 'pie' ? '#fff' : '#64748b' }}>
        <PieChartFilled />
      </button>
    )}
    {types.includes('line') && (
      <button onClick={() => setMode('line')}
        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14,
          background: mode === 'line' ? '#3b82f6' : 'transparent', color: mode === 'line' ? '#fff' : '#64748b' }}>
        <LineChartOutlined />
      </button>
    )}
  </div>
);

const AY_ISIM = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/* ============ KPI Cards ============ */
const KpiCards = ({ ozet }) => {
  const cards = [
    { icon: <TrophyOutlined />, color: '#3b82f6', value: ozet?.toplam_ihale_sayisi?.toLocaleString('tr-TR') || '0', label: 'Toplam İhale' },
    { icon: <DollarOutlined />, color: '#10b981', value: fmtCurrency(ozet?.toplam_kazanc_tl), label: 'Toplam Getiri' },
    { icon: <ThunderboltOutlined />, color: '#f59e0b', value: fmtCurrency(ozet?.ortalama_kazanc_tl), label: 'Ortalama' },
    { icon: <CrownOutlined />, color: '#8b5cf6', value: fmtCurrency(ozet?.en_yuksek_kazanc?.tutar), label: 'En Yüksek' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
      {cards.map((c, i) => (
        <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: c.color + '15', color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{c.icon}</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{c.value}</div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ============ Chart Card Wrapper ============ */
const ChartCard = ({ title, icon, children, style, headerRight }) => (
  <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', ...style }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>{icon} {title}</h3>
      {headerRight}
    </div>
    <div style={{ padding: '16px 20px' }}>{children}</div>
  </div>
);

/* ============ Legend Table ============ */
const LegendTable = ({ headers, rows }) => (
  <div style={{ padding: '0 20px 16px', fontSize: 13 }}>
    <div style={{ display: 'grid', gridTemplateColumns: `2fr ${headers.slice(1).map(() => '1fr').join(' ')}`, gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
      {headers.map((h, i) => <span key={i}>{h}</span>)}
    </div>
    {rows.map((row, i) => (
      <div key={i} style={{ display: 'grid', gridTemplateColumns: `2fr ${headers.slice(1).map(() => '1fr').join(' ')}`, gap: 8, padding: '8px 0', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}>
        {row.map((cell, j) => <span key={j}>{cell}</span>)}
      </div>
    ))}
  </div>
);

/* ============ Generic Chart Renderer ============ */
const RenderChart = ({ data, mode, dataKey, nameKey, height = 280 }) => {
  if (!data?.length) return <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Veri bulunamadı</div>;

  if (mode === 'pie') {
    const pieTotal = data.reduce((s, d) => s + (parseFloat(d[dataKey]) || 0), 0);
    return (
      <>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={data} dataKey={dataKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={0}
              label={({ name, percent }) => percent > 0.04 ? `${name ? String(name).substring(0, 12) : ''} ${(percent * 100).toFixed(0)}%` : ''} labelLine={true}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" strokeWidth={0} />)}
            </Pie>
            <Tooltip content={<ChartTooltip formatter={fmtShort} />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 12, padding: '4px 8px 8px', borderTop: '1px solid #f1f5f9', marginTop: 4 }}>
          {data.map((item, i) => {
            const val = parseFloat(item[dataKey]) || 0;
            const pct = pieTotal > 0 ? (val / pieTotal) * 100 : 0;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: i < data.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: COLORS[i % COLORS.length] }} />
                <span style={{ flex: 1, fontSize: 11, color: '#44474a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item[nameKey]}</span>
                <div style={{ width: 80, background: '#f1f5f9', borderRadius: 4, height: 6, flexShrink: 0, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', width: 38, textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(1)}%</span>
                <span style={{ fontSize: 11, color: '#6a6d70', width: 90, textAlign: 'right', flexShrink: 0 }}>{fmtShort(val)}</span>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  if (mode === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey={nameKey} tick={{ fontSize: 11, fill: '#6a6d70' }} angle={-45} textAnchor="end" height={70} tickLine={false} />
          <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6a6d70' }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip formatter={fmtShort} />} />
          <Line type="monotone" dataKey={dataKey} name="Getiri" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // bar (default)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey={nameKey} tick={{ fontSize: 11, fill: '#6a6d70' }} angle={-45} textAnchor="end" height={70} tickLine={false} />
        <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#6a6d70' }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip formatter={fmtShort} />} />
        <Bar dataKey={dataKey} name="Getiri" radius={[4, 4, 0, 0]} maxBarSize={45}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

/* ============ OZET TAB ============ */
const OzetTab = ({ ozet, lokasyonData, tedarikciData, trendData, trendYil, setTrendYil }) => {
  const [lokMode, setLokMode] = useState('bar');
  const [tedMode, setTedMode] = useState('bar');
  const [trendMode, setTrendMode] = useState('line');
  const sortedTedarikci = (tedarikciData || []).slice().sort((a, b) => (b.toplam_kazanc_tl || 0) - (a.toplam_kazanc_tl || 0));

  return (
    <div>
      <KpiCards ozet={ozet} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 20, marginBottom: 20 }}>
        {/* Lokasyon */}
        <ChartCard title="Lokasyon Getiri Dağılımı" headerRight={<ChartSwitch mode={lokMode} setMode={setLokMode} />}>
          <RenderChart data={lokasyonData} mode={lokMode} dataKey="toplam_kazanc_tl" nameKey="lokasyon" />
          {lokasyonData?.length > 0 && (
            <LegendTable headers={['Lokasyon', 'İhale', 'Getiri']}
              rows={lokasyonData.map((item, i) => [
                <span key="n" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                  {i + 1}. {item.lokasyon}
                </span>,
                item.ihale_sayisi,
                <strong key="v">{fmtCurrency(item.toplam_kazanc_tl)}</strong>,
              ])}
            />
          )}
        </ChartCard>

        {/* Tedarikçi */}
          <ChartCard title="Tedarikçi Getiri Dağılımı" headerRight={<ChartSwitch mode={tedMode} setMode={setTedMode} />}>
          <RenderChart data={sortedTedarikci.slice(0, 10)} mode={tedMode} dataKey="toplam_kazanc_tl" nameKey="kazanan_tedarikci" />
          {sortedTedarikci?.length > 0 && (
            <LegendTable headers={['Tedarikçi', 'Kazandığı', 'Getiri']}
              rows={sortedTedarikci.slice(0, 10).map((item, i) => [
                <span key="n" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                  {i + 1}. {item.kazanan_tedarikci}
                </span>,
                item.kazandigi_ihale_sayisi,
                <strong key="v">{fmtCurrency(item.toplam_kazanc_tl)}</strong>,
              ])}
            />
          )}
        </ChartCard>
      </div>

      {/* Trend */}
      <ChartCard title="Aylık Trend" icon={<LineChartOutlined />}
        headerRight={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={() => setTrendYil(y => y - 1)} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}><LeftOutlined /></button>
              <span style={{ minWidth: 50, textAlign: 'center', fontWeight: 600, fontSize: 14 }}>{trendYil}</span>
              <button onClick={() => setTrendYil(y => y + 1)} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}><RightOutlined /></button>
            </div>
            <ChartSwitch mode={trendMode} setMode={setTrendMode} />
          </div>
        }
      >
        <RenderChart data={trendData} mode={trendMode} dataKey="toplam_kazanc_tl" nameKey="ay_isim" height={300} />
        {trendData?.length > 0 && (
          <LegendTable headers={['Ay', 'İhale', 'Getiri', 'Değişim']}
            rows={trendData.map((item, i) => [
              <span key="n" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                {item.ay_isim}
              </span>,
              item.ihale_sayisi,
              <strong key="v">{fmtCurrency(item.toplam_kazanc_tl)}</strong>,
              <span key="c" style={{ color: item.bir_onceki_aya_gore_degisim_yuzdesi == null ? '#94a3b8' : item.bir_onceki_aya_gore_degisim_yuzdesi >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                {item.bir_onceki_aya_gore_degisim_yuzdesi == null ? '-' : (item.bir_onceki_aya_gore_degisim_yuzdesi >= 0 ? '+' : '') + item.bir_onceki_aya_gore_degisim_yuzdesi.toFixed(1) + '%'}
              </span>,
            ])}
          />
        )}
      </ChartCard>
    </div>
  );
};

/* ============ REKABET TAB ============ */
const RekabeTab = ({ rekabeData }) => {
  const pairs = rekabeData || [];
  const chartData = pairs.slice(0, 10).map(p => ({
    isim: (p.firma_a?.length > 12 ? p.firma_a.substring(0, 12) + '..' : p.firma_a) + ' vs ' + (p.firma_b?.length > 12 ? p.firma_b.substring(0, 12) + '..' : p.firma_b),
    sayi: p.kac_ihalede_karsilastilar,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ChartCard title="En Çok Karşılaşan Firmalar" icon={<BarChartOutlined />}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="isim" tick={{ fontSize: 10, fill: '#6a6d70' }} angle={-35} textAnchor="end" height={80} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6a6d70' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="sayi" name="Karşılaşma" radius={[4, 4, 0, 0]} maxBarSize={45}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Veri bulunamadı</div>}
      </ChartCard>

      <ChartCard title="İkili Firma Karşılaşmaları" icon={<SwapOutlined />}>
        <div style={{ fontSize: 13 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 2fr 2fr 1fr', gap: 8, padding: '10px 0', borderBottom: '2px solid #e2e8f0', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
            <span>#</span><span>Firma A</span><span>Firma B</span><span>Karşılaşma</span>
          </div>
          {pairs.length > 0 ? pairs.map((p, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 2fr 2fr 1fr', gap: 8, padding: '10px 0', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>{i + 1}.</span>
              <span style={{ fontWeight: 500, color: '#1e293b' }}>{p.firma_a}</span>
              <span style={{ fontWeight: 500, color: '#1e293b' }}>{p.firma_b}</span>
              <span><span style={{ background: '#eff6ff', color: '#3b82f6', padding: '3px 10px', borderRadius: 12, fontWeight: 700, fontSize: 13 }}>{p.kac_ihalede_karsilastilar}</span></span>
            </div>
          )) : <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Veri bulunamadı</div>}
        </div>
      </ChartCard>
    </div>
  );
};

/* ============ TASARRUF TAB ============ */
const TasarrufTab = ({ tasarrufData }) => (
  <div>
    <ChartCard title="Tasarruf Analizi" icon={<AimOutlined />}>
      {tasarrufData?.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tasarrufData.slice(0, 10)} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="malzeme_hizmet" tick={{ fontSize: 10, fill: '#6a6d70' }} angle={-45} textAnchor="end" height={80} tickLine={false}
                tickFormatter={v => v?.length > 20 ? v.substring(0, 20) + '...' : v} />
              <YAxis tick={{ fontSize: 11, fill: '#6a6d70' }} axisLine={false} tickLine={false} tickFormatter={v => '%' + v} />
              <Tooltip content={<ChartTooltip formatter={v => '%' + v} />} />
              <Bar dataKey="tasarruf_orani_yuzde" name="Tasarruf Oranı %" radius={[4, 4, 0, 0]} maxBarSize={45}>
                {tasarrufData.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div style={{ fontSize: 13, marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '35px 2fr 1.5fr 1fr 1fr 80px', gap: 8, padding: '10px 0', borderBottom: '2px solid #e2e8f0', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
              <span>#</span><span>Malzeme/Hizmet</span><span>Kazanan</span><span>En Yüksek Teklif</span><span>Kazanç</span><span>Tasarruf</span>
            </div>
            {tasarrufData.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '35px 2fr 1.5fr 1fr 1fr 80px', gap: 8, padding: '10px 0', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>{i + 1}.</span>
                <span style={{ fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.malzeme_hizmet}>
                  {item.malzeme_hizmet}
                </span>
                <span style={{ color: '#64748b' }}>{item.kazanan_tedarikci || '-'}</span>
                <span style={{ color: '#64748b' }}>{fmtCurrency(item.en_yuksek_teklif_tl)}</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{fmtCurrency(item.kazanc_tutari_tl)}</span>
                <span style={{
                  fontWeight: 700, fontSize: 13,
                  color: item.tasarruf_orani_yuzde > 20 ? '#10b981' : item.tasarruf_orani_yuzde > 10 ? '#f59e0b' : '#64748b',
                }}>
                  %{item.tasarruf_orani_yuzde}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Veri bulunamadı</div>}
    </ChartCard>
  </div>
);

/* ============ MAIN COMPONENT ============ */
const IhaleRaporlari = ({ selectedAmbar = '' }) => {
  const [activeTab, setActiveTab] = useState('ozet');
  const [loading, setLoading] = useState(false);
  const [trendYil, setTrendYil] = useState(new Date().getFullYear());

  const [ozet, setOzet] = useState(null);
  const [lokasyonData, setLokasyonData] = useState([]);
  const [tedarikciData, setTedarikciData] = useState([]);
  const [rekabeData, setRekabeData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [tasarrufData, setTasarrufData] = useState([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (selectedAmbar && selectedAmbar !== 'all') params.lokasyon = selectedAmbar;
    try {
      const [ozetRes, lokRes, tedRes, rekRes, trendRes, tasRes] = await Promise.all([
        getRaporOzet(params).catch(e => { console.error('ozet err', e); return { data: {} }; }),
        getRaporLokasyon(params).catch(e => { console.error('lok err', e); return { data: [] }; }),
        getRaporTedarikci(params).catch(e => { console.error('ted err', e); return { data: [] }; }),
        getRaporRekabet(params).catch(e => { console.error('rek err', e); return { data: [] }; }),
        getRaporTrend({ ...params, yil: trendYil }).catch(e => { console.error('trend err', e); return { data: [] }; }),
        getRaporTasarruf(params).catch(e => { console.error('tas err', e); return { data: [] }; }),
      ]);

      console.log('=== RAPOR API RAW ===', { ozetRes, lokRes, tedRes, rekRes, trendRes, tasRes });

      setOzet(ozetRes.data || ozetRes || {});
      setLokasyonData(Array.isArray(lokRes.data) ? lokRes.data : (Array.isArray(lokRes) ? lokRes : []));
      setTedarikciData(Array.isArray(tedRes.data) ? tedRes.data : (Array.isArray(tedRes) ? tedRes : []));
      const rekRaw = rekRes.data || rekRes;
      setRekabeData(Array.isArray(rekRaw) ? rekRaw : (Array.isArray(rekRaw?.pairs) ? rekRaw.pairs : []));

      const rawTrend = Array.isArray(trendRes.data) ? trendRes.data : (Array.isArray(trendRes) ? trendRes : []);
      setTrendData(rawTrend.map(t => ({
        ...t,
        ay_isim: t.ay_isim || AY_ISIM[(t.ay || 1) - 1] || ('Ay ' + t.ay),
      })));

      setTasarrufData(Array.isArray(tasRes.data) ? tasRes.data : (Array.isArray(tasRes) ? tasRes : []));
    } catch (err) {
      console.error('Rapor yukleme hatasi:', err);
    } finally {
      setLoading(false);
    }
  }, [trendYil, selectedAmbar]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const tabs = [
    { key: 'ozet', icon: <BarChartOutlined />, label: 'Özet' },
    { key: 'rekabet', icon: <FireOutlined />, label: 'Rekabet' },
    { key: 'tasarruf', icon: <AimOutlined />, label: 'Tasarruf' },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BarChartOutlined style={{ fontSize: 28, color: '#3b82f6' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>İhale Raporları</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>İhale kazanç takip, analiz ve raporları</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={loadAll} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#64748b' }}>
            <ReloadOutlined spin={loading} /> Yenile
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, transition: 'all 0.2s',
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? '#3b82f6' : '#64748b',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && !ozet ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, color: '#94a3b8', gap: 16 }}>
          <ReloadOutlined spin style={{ fontSize: 32 }} />
          <span>Raporlar yükleniyor...</span>
        </div>
      ) : (
        <>
          {activeTab === 'ozet' && (
            <OzetTab ozet={ozet} lokasyonData={lokasyonData} tedarikciData={tedarikciData}
              trendData={trendData} trendYil={trendYil} setTrendYil={setTrendYil} />
          )}
          {activeTab === 'rekabet' && <RekabeTab rekabeData={rekabeData} />}
          {activeTab === 'tasarruf' && <TasarrufTab tasarrufData={tasarrufData} />}
        </>
      )}
    </div>
  );
};

export default IhaleRaporlari;
