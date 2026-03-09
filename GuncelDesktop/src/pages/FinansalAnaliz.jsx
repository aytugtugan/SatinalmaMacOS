import React from 'react';
import { SwitchableChart, formatNumber, formatCurrency } from '../components/SwitchableChart';
import {
  DollarOutlined,
  GlobalOutlined,
  FieldTimeOutlined,
  BankOutlined,
} from '@ant-design/icons';

const FinansalAnaliz = ({ data, fabrikaKarsilastirma = false, onChartClick }) => {
  if (!data) return null;

  const { paraBirimi, odemeVadesi, summary, monthlyTrend, ambar } = data;

  // Para birimine gore dagilim
  // Prefer converted TRY amounts when available
  const paraBirimiData = (data.paraBirimiConverted && data.paraBirimiConverted.length)
    ? data.paraBirimiConverted.map(p => ({ name: p.paraBirimi || 'TRY', value: p.convertedTRY || p.toplam || 0, adet: p.kayitAdedi || 0 }))
    : (paraBirimi || []).map(item => ({ name: item.paraBirimi || 'TRY', value: item.toplamTutar, adet: item.kayitAdedi }));

  // Para birimine gore adet
  const paraBirimiAdetData = (data.paraBirimiConverted && data.paraBirimiConverted.length)
    ? data.paraBirimiConverted.map(p => ({ name: p.paraBirimi || 'TRY', value: p.kayitAdedi || 0 }))
    : (paraBirimi || []).map(item => ({ name: item.paraBirimi || 'TRY', value: item.kayitAdedi }));

  // Odeme vadesine gore dagilim - siparisAdedi veya kayitAdedi kullan
  const odemeVadesiDataGrouped = (odemeVadesi || [])
    .filter(item => item.odemeVadesi && item.odemeVadesi !== 'Belirsiz')
    .reduce((acc, item) => {
      const key = String(item.odemeVadesi).trim();
      const existing = acc.find(x => x.name === key);
      if (existing) {
        existing.value += (item.siparisAdedi || item.kayitAdedi || item.talepAdedi || 0);
      } else {
        acc.push({ name: key, value: item.siparisAdedi || item.kayitAdedi || item.talepAdedi || 0 });
      }
      return acc;
    }, []);
  const odemeVadesiData = odemeVadesiDataGrouped;

  // Odeme vadesine gore tutar
  const odemeVadesiTutarDataGrouped = (odemeVadesi || [])
    .filter(item => item.odemeVadesi && item.odemeVadesi !== 'Belirsiz')
    .reduce((acc, item) => {
      const key = String(item.odemeVadesi).trim();
      const existing = acc.find(x => x.name === key);
      if (existing) {
        existing.value += (item.toplamTutar || 0);
      } else {
        acc.push({ name: key, value: item.toplamTutar || 0 });
      }
      return acc;
    }, []);
  const odemeVadesiTutarData = odemeVadesiTutarDataGrouped;

  // Aylik harcama trendi
  const aylikHarcamaData = (monthlyTrend || []).slice(0, 12).reverse().map(item => ({
    name: item.ay,
    value: item.toplamTutar || 0,
  }));

  // Ortalama siparis tutari
  const ortalamaTutar = summary?.ortalamaTutar || 0;

  // Fabrikaya gore tutar
  const fabrikaTutarData = (ambar || [])
    .slice()
    .sort((a, b) => (b.toplamTutar || 0) - (a.toplamTutar || 0))
    .map(item => ({
      name: item.ambar || 'Belirsiz',
      value: item.toplamTutar || 0,
    }));

  // Fabrikaya gore siparis adedi
  const fabrikaAdetData = (ambar || [])
    .slice()
    .sort((a, b) => (b.siparisAdedi || 0) - (a.siparisAdedi || 0))
    .map(item => ({
      name: item.ambar || 'Belirsiz',
      value: item.siparisAdedi || item.kayitAdedi || 0,
    }));

  return (
    <div>
      <div className="page-header">
        <h2>Finansal Analiz</h2>
        <p>Harcama ve ödeme analizleri, bütçe takibi</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon blue">
            <DollarOutlined />
          </div>
          <div className="kpi-value">{formatCurrency(summary?.toplamTutarTRY ?? summary?.toplamTutar ?? 0)}</div>
          <div className="kpi-label">Toplam Harcama</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green">
            <GlobalOutlined />
          </div>
          <div className="kpi-value">{paraBirimi?.length || 0}</div>
          <div className="kpi-label">Para Birimi Çeşidi</div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {fabrikaKarsilastirma ? (
          <>
            <SwitchableChart
              title="Fabrikalara Göre Harcama Tutarı"
              data={fabrikaTutarData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={320}
              onClick={onChartClick}
              filterField="AMBAR"
            />

            <SwitchableChart
              title="Fabrikalara Göre İşlem Adedi"
              data={fabrikaAdetData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={320}
              onClick={onChartClick}
              filterField="AMBAR"
            />

            <SwitchableChart
              title="Aylık Harcama Tutarı"
              data={aylikHarcamaData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={320}
              onClick={onChartClick}
              filterField="ay"
            />

            <SwitchableChart
              title="Para Birimine Göre Tutar Dağılımı"
              data={paraBirimiData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={320}
              onClick={onChartClick}
              filterField="PARA_BIRIMI"
            />

            <SwitchableChart
              title="Ödeme Vadesine Göre Tutar"
              data={odemeVadesiTutarData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={320}
              onClick={onChartClick}
              filterField="ODEME_VADESI"
            />
          </>
        ) : (
          <>
            <SwitchableChart
              title="Aylık Harcama Tutarı"
              data={aylikHarcamaData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={320}
              onClick={onChartClick}
              filterField="ay"
            />

            <SwitchableChart
              title="Para Birimine Göre Tutar Dağılımı"
              data={paraBirimiData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={320}
              onClick={onChartClick}
              filterField="PARA_BIRIMI"
            />

            <SwitchableChart
              title="Para Birimine Göre İşlem Adedi"
              data={paraBirimiAdetData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={320}
              onClick={onChartClick}
              filterField="PARA_BIRIMI"
            />

            <SwitchableChart
              title="Ödeme Vadesine Göre İşlem Adedi"
              data={odemeVadesiData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={320}
              onClick={onChartClick}
              filterField="ODEME_VADESI"
            />

            <SwitchableChart
              title="Ödeme Vadesine Göre Tutar"
              data={odemeVadesiTutarData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={320}
              onClick={onChartClick}
              filterField="ODEME_VADESI"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default FinansalAnaliz;
