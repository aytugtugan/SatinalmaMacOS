import React from 'react';
import { SwitchableChart, formatNumber, formatCurrency } from '../components/SwitchableChart';
import {
  FileTextOutlined,
  ShoppingCartOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  DollarOutlined,
  UserOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';

const Dashboard = ({ data, fabrikaKarsilastirma = false, onChartClick }) => {
  if (!data) return null;

  const { summary, monthlyTrend, tedarikci, durum, masrafMerkezi, isyeri, paraBirimi, paraBirimiConverted, odemeVadesi, talepEden, ambar } = data;

  // Aylik trend verilerini son 12 aya duzenle (zaman siralamasini koru)
  const trendData = (monthlyTrend || []).slice(0, 12).reverse().map(item => ({
    name: item.ay,
    'Toplam Tutar': item.toplamTutar,
    'Sipariş Adedi': item.siparisAdedi,
  }));

  // Teslim durumu (TESLIM EVRAK NO'ya gore) - en cokten aza
  const durumData = (durum || [])
    .slice()
    .sort((a, b) => (b.siparisAdedi || 0) - (a.siparisAdedi || 0))
    .map(item => ({
      name: item.durum,
      value: item.siparisAdedi,
    }));

  // Masraf merkezi dagilimi - en cokten aza, top 8
  const masrafMerkeziData = (masrafMerkezi || [])
    .slice()
    .sort((a, b) => (b.toplamTutar || 0) - (a.toplamTutar || 0))
    .slice(0, 8)
    .map(item => ({
      name: item.masrafMerkezi?.substring(0, 20) || 'Belirsiz',
      value: item.toplamTutar,
    }));

  // Tedarikci dagilimi (top 5) - en cokten aza
  const tedarikciData = (tedarikci || [])
    .slice()
    .sort((a, b) => (b.toplamTutar || 0) - (a.toplamTutar || 0))
    .slice(0, 5)
    .map(item => ({
      name: item.tedarikci?.substring(0, 20) || 'Belirsiz',
      value: item.toplamTutar,
    }));

  // Para birimi dagilimi - use converted TRY amounts when available
  let paraBirimiData = [];
  if (paraBirimiConverted && Array.isArray(paraBirimiConverted) && paraBirimiConverted.length) {
    paraBirimiData = paraBirimiConverted
      .slice()
      .sort((a, b) => (b.convertedTRY || 0) - (a.convertedTRY || 0))
      .map(item => ({
        name: item.paraBirimi || 'TRY',
        value: item.convertedTRY || 0,
        raw: item.toplam || 0,
      }));
  } else {
    paraBirimiData = (paraBirimi || [])
      .slice()
      .sort((a, b) => (b.toplamTutar || 0) - (a.toplamTutar || 0))
      .map(item => ({
        name: item.paraBirimi || 'TRY',
        value: item.toplamTutar,
      }));
  }

  // Odeme vadesi dagilimi - en cokten aza, top 6
  const odemeVadesiDataGrouped = (odemeVadesi || [])
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
    }, [])
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  const odemeVadesiData = odemeVadesiDataGrouped;

  // Talep eden dagilimi - en cokten aza, top 6
  const talepEdenData = (talepEden || [])
    .slice()
    .sort((a, b) => (b.toplamTutar || 0) - (a.toplamTutar || 0))
    .slice(0, 6)
    .map(item => ({
      name: item.talepEden?.substring(0, 15) || 'Belirsiz',
      value: item.toplamTutar,
    }));

  // Fabrika (Ambar) karsilastirma verileri - en coktan aza
  const fabrikaData = (ambar || [])
    .slice()
    .sort((a, b) => (b.toplamTutar || 0) - (a.toplamTutar || 0))
    .map(item => ({
      name: item.ambar || 'Belirsiz',
      value: item.toplamTutar,
      siparisAdedi: item.siparisAdedi || 0,
    }));

  // Fabrikaya gore siparis adedi
  const fabrikaAdetData = (ambar || [])
    .slice()
    .sort((a, b) => (b.siparisAdedi || 0) - (a.siparisAdedi || 0))
    .map(item => ({
      name: item.ambar || 'Belirsiz',
      value: item.siparisAdedi || 0,
    }));

  return (
    <div>
      <div className="page-header">
        <h2>Satınalma Verilerinin Gösterim Alanı</h2>
        <p>Satın alma süreçlerinizin genel görünümü ve temel metrikleri</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon blue">
            <ShoppingCartOutlined />
          </div>
          <div className="kpi-value">{formatNumber(summary?.totalSiparis || 0)}</div>
          <div className="kpi-label">Toplam Sipariş</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon blue">
            <DollarOutlined />
          </div>
          <div className="kpi-value">{formatCurrency(summary?.toplamTutarTRY ?? summary?.toplamTutar ?? 0)}</div>
          <div className="kpi-label">Sipariş Tutarı (TRY)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green">
            <CheckCircleOutlined />
          </div>
          <div className="kpi-value">{formatNumber(summary?.totalTeslimat || 0)}</div>
          <div className="kpi-label">Teslim Edilen</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon red">
            <CloseCircleOutlined />
          </div>
          <div className="kpi-value">{formatNumber(summary?.bekleyenTeslimat || 0)}</div>
          <div className="kpi-label">Teslim Bekleyen</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple">
            <TeamOutlined />
          </div>
          <div className="kpi-value">{formatNumber(summary?.totalTedarikci || 0)}</div>
          <div className="kpi-label">Tedarikçi Sayısı</div>
        </div>

        

        

        <div className="kpi-card">
          <div className="kpi-icon green">
            <ClockCircleOutlined />
          </div>
          <div className="kpi-value">{data.teslimatSuresi?.ortalamaTeslimatSuresi || 0} Gün</div>
          <div className="kpi-label">Ort. Teslimat Süresi</div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {fabrikaKarsilastirma ? (
          <>
            <SwitchableChart
              title="Fabrikalara Göre Toplam Tutar"
              data={fabrikaData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={300}
              onClick={onChartClick}
              filterField="AMBAR"
            />

            <SwitchableChart
              title="Fabrikalara Göre Sipariş Adedi"
              data={fabrikaAdetData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={300}
              onClick={onChartClick}
              filterField="AMBAR"
            />

            <SwitchableChart
              title="Aylık Sipariş Tutarı"
              data={trendData}
              dataKey="Toplam Tutar"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={300}
              onClick={onChartClick}
              filterField="ay"
            />

            <SwitchableChart
              title="Teslim Durumu (Evrak No'ya Göre)"
              data={durumData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={300}
              onClick={onChartClick}
              filterField="TESLIM_DURUMU"
            />

            <SwitchableChart
              title="Para Birimi Dağılımı (TRY'ye Çevrildi)"
              data={paraBirimiData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={300}
              onClick={onChartClick}
              filterField="PARA_BIRIMI"
            />

            <SwitchableChart
              title="Ödeme Vadesi Dağılımı"
              data={odemeVadesiData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={300}
              onClick={onChartClick}
              filterField="ODEME_VADESI"
            />
          </>
        ) : (
          <>
            <SwitchableChart
              title="Aylık Sipariş Tutarı"
              data={trendData}
              dataKey="Toplam Tutar"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={300}
              onClick={onChartClick}
              filterField="ay"
            />

            <SwitchableChart
              title="Teslim Durumu (Evrak No'ya Göre)"
              data={durumData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={300}
              onClick={onChartClick}
              filterField="TESLIM_DURUMU"
            />

            <SwitchableChart
              title="Masraf Merkezine Göre Sipariş Tutarı"
              data={masrafMerkeziData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={300}
              onClick={onChartClick}
              filterField="MASRAF_MERKEZI"
            />

            <SwitchableChart
              title="Top 5 Tedarikçi (Tutarına Göre)"
              data={tedarikciData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={300}
              onClick={onChartClick}
              filterField="CARI_UNVANI"
            />

            <SwitchableChart
              title="Para Birimi Dağılımı (TRY'ye Çevrildi)"
              data={paraBirimiData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={300}
              onClick={onChartClick}
              filterField="PARA_BIRIMI"
            />

            <SwitchableChart
              title="Ödeme Vadesi Dağılımı"
              data={odemeVadesiData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={300}
              onClick={onChartClick}
              filterField="ODEME_VADESI"
            />

            <SwitchableChart
              title="Talep Edenlere Göre Tutar"
              data={talepEdenData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={300}
              onClick={onChartClick}
              filterField="TALEP_EDEN"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
