import React from 'react';
import { SwitchableChart, formatNumber, formatCurrency } from '../components/SwitchableChart';
import {
  UserOutlined,
  BankOutlined,
  RiseOutlined,
} from '@ant-design/icons';

const TalepAnaliz = ({ data, fabrikaKarsilastirma = false, onChartClick }) => {
  if (!data) return null;

  const { talepEden, masrafMerkezi, summary, ambar } = data;

  // Talep eden kisilere gore - talepAdedi, siparisAdedi veya kayitAdedi kullan
  const talepEdenAdetData = (talepEden || []).map(item => ({
    name: item.talepEden?.substring(0, 15) || 'Belirsiz',
    value: item.talepAdedi || item.siparisAdedi || item.kayitAdedi || 0,
  }));

  // Talep eden tutar grafigi icin
  const talepEdenTutarData = (talepEden || []).map(item => ({
    name: item.talepEden?.substring(0, 15) || 'Belirsiz',
    value: item.toplamTutar || 0,
  }));

  // Masraf merkezi adet grafigi icin - siparisAdedi veya kayitAdedi kullan
  const masrafMerkeziAdetData = (masrafMerkezi || []).map(item => ({
    name: item.masrafMerkezi?.substring(0, 20) || 'Belirsiz',
    value: item.siparisAdedi || item.kayitAdedi || item.talepAdedi || 0,
  }));

  // Masraf merkezi tutar grafigi icin
  const masrafMerkeziTutarData = (masrafMerkezi || []).map(item => ({
    name: item.masrafMerkezi?.substring(0, 20) || 'Belirsiz',
    value: item.toplamTutar || 0,
  }));

  // Fabrikaya gore talep/kayit adedi
  const fabrikaAdetData = (ambar || [])
    .slice()
    .sort((a, b) => (b.talepAdedi || b.siparisAdedi || 0) - (a.talepAdedi || a.siparisAdedi || 0))
    .map(item => ({
      name: item.ambar || 'Belirsiz',
      value: item.talepAdedi || item.siparisAdedi || item.kayitAdedi || 0,
    }));

  // Fabrikaya gore tutar
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
        <h2>Talep Analizi</h2>
        <p>Talep süreçlerinin detaylı analizi ve performans metrikleri</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon blue">
            <UserOutlined />
          </div>
          <div className="kpi-value">{talepEden?.length || 0}</div>
          <div className="kpi-label">Talep Eden Kişi Sayısı</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green">
            <BankOutlined />
          </div>
          <div className="kpi-value">{masrafMerkezi?.length || 0}</div>
          <div className="kpi-label">Masraf Merkezi Sayısı</div>
        </div>

        
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {fabrikaKarsilastirma ? (
          <>
            <SwitchableChart
              title="Fabrikalara Göre Talep/Kayıt Adedi"
              data={fabrikaAdetData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={320}
              onClick={onChartClick}
              filterField="AMBAR"
            />

            <SwitchableChart
              title="Fabrikalara Göre Tutar"
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
              title="Masraf Merkezine Göre Kayıt Adedi"
              data={masrafMerkeziAdetData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={320}
              onClick={onChartClick}
              filterField="MASRAF_MERKEZI"
            />

            <SwitchableChart
              title="Masraf Merkezine Göre Tutar"
              data={masrafMerkeziTutarData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={320}
              onClick={onChartClick}
              filterField="MASRAF_MERKEZI"
            />
          </>
        ) : (
          <>
            <SwitchableChart
              title="Talep Eden Kişilere Göre Talep Adedi"
              data={talepEdenAdetData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={320}
              onClick={onChartClick}
              filterField="TALEP_EDEN"
            />

            <SwitchableChart
              title="Talep Eden Kişilere Göre Tutar"
              data={talepEdenTutarData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={320}
              onClick={onChartClick}
              filterField="TALEP_EDEN"
            />

            <SwitchableChart
              title="Masraf Merkezine Göre Kayıt Adedi"
              data={masrafMerkeziAdetData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={320}
              onClick={onChartClick}
              filterField="MASRAF_MERKEZI"
            />

            <SwitchableChart
              title="Masraf Merkezine Göre Tutar"
              data={masrafMerkeziTutarData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={320}
              onClick={onChartClick}
              filterField="MASRAF_MERKEZI"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default TalepAnaliz;
