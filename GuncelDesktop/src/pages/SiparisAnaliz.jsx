import React from 'react';
import { SwitchableChart, formatNumber, formatCurrency } from '../components/SwitchableChart';
import {
  ShoppingCartOutlined,
  CalendarOutlined,
  UserSwitchOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';

const SiparisAnaliz = ({ data, fabrikaKarsilastirma = false, onChartClick }) => {
  if (!data) return null;

  const { monthlyTrend, onaylayan, durum, summary, teslimatSuresi, ambar } = data;

  // Aylik siparis trendi - siparisAdedi veya kayitAdedi kullan
  const trendData = (monthlyTrend || []).slice(0, 12).reverse().map(item => ({
    name: item.ay,
    value: item.siparisAdedi || item.kayitAdedi || 0,
  }));

  // Aylik tutar trendi
  const tutarTrendData = (monthlyTrend || []).slice(0, 12).reverse().map(item => ({
    name: item.ay,
    value: item.toplamTutar || 0,
  }));

  // Onaylayan kisilere gore - siparisAdedi veya talepAdedi kullan
  const onaylayanData = (onaylayan || []).map(item => ({
    name: item.onaylayan?.substring(0, 15) || 'Belirsiz',
    value: item.siparisAdedi || item.talepAdedi || item.kayitAdedi || 0,
  }));

  // Onaylayan kisilere gore tutar
  const onaylayanTutarData = (onaylayan || []).map(item => ({
    name: item.onaylayan?.substring(0, 15) || 'Belirsiz',
    value: item.toplamTutar || 0,
  }));

  // Durum dagilimi - siparisAdedi veya kayitAdedi kullan
  const durumData = (durum || []).map(item => ({
    name: item.durum,
    value: item.siparisAdedi || item.kayitAdedi || 0,
  }));

  // Fabrikaya gore siparis adedi
  const fabrikaAdetData = (ambar || [])
    .slice()
    .sort((a, b) => (b.siparisAdedi || 0) - (a.siparisAdedi || 0))
    .map(item => ({
      name: item.ambar || 'Belirsiz',
      value: item.siparisAdedi || item.kayitAdedi || 0,
    }));

  // Fabrikaya gore siparis tutari
  const fabrikaTutarData = (ambar || [])
    .slice()
    .sort((a, b) => (b.toplamTutar || 0) - (a.toplamTutar || 0))
    .map(item => ({
      name: item.ambar || 'Belirsiz',
      value: item.toplamTutar || 0,
    }));

  return (
    <div>
      <div className="page-header">
        <h2>Sipariş Analizi</h2>
        <p>Sipariş süreçlerinin detaylı analizi ve performans takibi</p>
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
          <div className="kpi-icon green">
            <CalendarOutlined />
          </div>
          <div className="kpi-value">{trendData.length}</div>
          <div className="kpi-label">Aktif Ay Sayısı</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon orange">
            <UserSwitchOutlined />
          </div>
          <div className="kpi-value">{onaylayan?.length || 0}</div>
          <div className="kpi-label">Onaylayan Kişi Sayısı</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple">
            <ClockCircleOutlined />
          </div>
          <div className="kpi-value">{teslimatSuresi?.ortalamaTeslimatSuresi || 0} Gün</div>
          <div className="kpi-label">Ort. Teslimat Süresi</div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {fabrikaKarsilastirma ? (
          <>
            <SwitchableChart
              title="Fabrikalara Göre Sipariş Adedi"
              data={fabrikaAdetData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={320}
              onClick={onChartClick}
              filterField="AMBAR"
            />

            <SwitchableChart
              title="Fabrikalara Göre Sipariş Tutarı"
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
              title="Aylık Sipariş Adedi Trendi"
              data={trendData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={320}
              onClick={onChartClick}
              filterField="ay"
            />

            <SwitchableChart
              title="Aylık Sipariş Tutarı"
              data={tutarTrendData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={320}
              onClick={onChartClick}
              filterField="ay"
            />

            <SwitchableChart
              title="Sipariş Durumu Dağılımı"
              data={durumData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={320}
              onClick={onChartClick}
              filterField="TESLIM_DURUMU"
            />
          </>
        ) : (
          <>
            <SwitchableChart
              title="Aylık Sipariş Adedi Trendi"
              data={trendData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={320}
              onClick={onChartClick}
              filterField="ay"
            />

            <SwitchableChart
              title="Aylık Sipariş Tutarı"
              data={tutarTrendData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={320}
              onClick={onChartClick}
              filterField="ay"
            />

            

            <SwitchableChart
              title="Sipariş Durumu Dağılımı"
              data={durumData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={320}
              onClick={onChartClick}
              filterField="TESLIM_DURUMU"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default SiparisAnaliz;
