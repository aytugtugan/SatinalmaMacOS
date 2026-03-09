import React, { useState } from 'react';
import { SwitchableChart, formatNumber, formatCurrency } from '../components/SwitchableChart';
import {
  TeamOutlined,
  DollarOutlined,
  ShoppingOutlined,
  TrophyOutlined,
} from '@ant-design/icons';

const TedarikciAnaliz = ({ data, fabrikaKarsilastirma = false, onChartClick }) => {
  const [showAllTutar, setShowAllTutar] = useState(false);
  const [showAllAdet, setShowAllAdet] = useState(false);

  if (!data) return null;

  const { tedarikci, summary, ambar } = data;

  // Ensure copies and sort descending by relevant metrics
  const byTutarDesc = (tedarikci || []).slice().sort((a, b) => (b.toplamTutar || 0) - (a.toplamTutar || 0));
  const byAdetDesc = (tedarikci || []).slice().sort((a, b) => (b.siparisAdedi || 0) - (a.siparisAdedi || 0));

  // Tedarikcilere gore tutar (en coktan aza) - TÜM tedarikçiler
  const tedarikciTutarData = byTutarDesc.map(item => ({
    name: item.tedarikci?.substring(0, 25) || 'Belirsiz',
    value: item.toplamTutar,
  }));

  // Tedarikcilere gore siparis adedi (en coktan aza) - TÜM tedarikçiler
  const tedarikciAdetData = byAdetDesc.map(item => ({
    name: item.tedarikci?.substring(0, 25) || 'Belirsiz',
    value: item.siparisAdedi,
  }));

  // En buyuk tedarikci by toplam tutar
  const topTedarikci = byTutarDesc.length > 0 ? byTutarDesc[0] : null;

  // Toplam tedarikci tutari
  const toplamTedarikciTutar = (tedarikci || []).reduce((sum, item) => sum + (item.toplamTutar || 0), 0);

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
      value: item.siparisAdedi || 0,
    }));

  // En buyuk fabrika by tutar
  const topFabrika = fabrikaTutarData.length > 0 ? fabrikaTutarData[0] : null;

  return (
    <div>
      <div className="page-header">
        <h2>Tedarikçi Analizi</h2>
        <p>Tedarikçi performanslarının detaylı analizi ve karşılaştırması</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {fabrikaKarsilastirma ? (
          <>
            <div className="kpi-card">
              <div className="kpi-icon blue">
                <TeamOutlined />
              </div>
              <div className="kpi-value">{formatNumber(ambar?.length || 0)}</div>
              <div className="kpi-label">Toplam Fabrika</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon green">
                <DollarOutlined />
              </div>
              <div className="kpi-value">{formatCurrency(toplamTedarikciTutar)}</div>
              <div className="kpi-label">Toplam Harcama</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon orange">
                <TrophyOutlined />
              </div>
              <div className="kpi-value" style={{ fontSize: '16px' }}>
                {topFabrika?.name?.substring(0, 18) || '-'}
              </div>
              <div className="kpi-label">En Büyük Fabrika</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon purple">
                <ShoppingOutlined />
              </div>
              <div className="kpi-value">{formatCurrency(topFabrika?.value || 0)}</div>
              <div className="kpi-label">En Yüksek Harcama</div>
            </div>
          </>
        ) : (
          <>
            <div className="kpi-card">
              <div className="kpi-icon blue">
                <TeamOutlined />
              </div>
              <div className="kpi-value">{formatNumber(summary?.totalTedarikci || 0)}</div>
              <div className="kpi-label">Toplam Tedarikçi</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon green">
                <DollarOutlined />
              </div>
              <div className="kpi-value">{formatCurrency(toplamTedarikciTutar)}</div>
              <div className="kpi-label">Toplam Harcama</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon orange">
                <TrophyOutlined />
              </div>
              <div className="kpi-value" style={{ fontSize: '16px' }}>
                {topTedarikci?.tedarikci?.substring(0, 18) || '-'}
              </div>
              <div className="kpi-label">En Büyük Tedarikçi</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon purple">
                <ShoppingOutlined />
              </div>
              <div className="kpi-value">{formatCurrency(topTedarikci?.toplamTutar || 0)}</div>
              <div className="kpi-label">En Yüksek Harcama</div>
            </div>
          </>
        )}
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {fabrikaKarsilastirma ? (
          <>
            <SwitchableChart
              title="Fabrikalara Göre Toplam Tutar"
              data={fabrikaTutarData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={400}
              scrollable={true}
              itemHeight={35}
              allowedChartTypes={['bar']}
              onClick={onChartClick}
              filterField="AMBAR"
            />

            <SwitchableChart
              title="Fabrikalara Göre Sipariş Adedi"
              data={fabrikaAdetData}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              height={400}
              scrollable={true}
              itemHeight={35}
              allowedChartTypes={['bar']}
              onClick={onChartClick}
              filterField="AMBAR"
            />

            <SwitchableChart
              title="Fabrika Tutar Dağılımı"
              data={fabrikaTutarData.slice(0, 10)}
              dataKey="value"
              nameKey="name"
              defaultType="bar"
              valueFormatter={formatCurrency}
              height={360}
              onClick={onChartClick}
              filterField="AMBAR"
            />
          </>
        ) : (
          <>
            <div className={`chart-container ${showAllTutar ? 'scrollable-x' : ''}`}>
              <div style={{ minWidth: showAllTutar ? `${Math.max(tedarikciTutarData.length * 60, 1200)}px` : 'auto' }}>
                <SwitchableChart
                  title="Tedarikçilere Göre Toplam Tutar"
                  data={showAllTutar ? tedarikciTutarData : tedarikciTutarData.slice(0, 10)}
                  dataKey="value"
                  nameKey="name"
                  defaultType="bar"
                  valueFormatter={formatCurrency}
                  height={400}
                  scrollable={false}
                  itemHeight={35}
                  allowedChartTypes={['bar', 'horizontal']}
                  onClick={onChartClick}
                  filterField="CARI_UNVANI"
                />
              </div>
              <button 
                className="show-all-btn"
                onClick={() => setShowAllTutar(!showAllTutar)}
              >
                {showAllTutar ? 'İlk 10\'u Göster' : `Hepsini Göster (${tedarikciTutarData.length})`}
              </button>
            </div>

            <div className={`chart-container ${showAllAdet ? 'scrollable-x' : ''}`}>
              <div style={{ minWidth: showAllAdet ? `${Math.max(tedarikciAdetData.length * 60, 1200)}px` : 'auto' }}>
                <SwitchableChart
                  title="Tedarikçilere Göre Sipariş Adedi"
                  data={showAllAdet ? tedarikciAdetData : tedarikciAdetData.slice(0, 10)}
                  dataKey="value"
                  nameKey="name"
                  defaultType="bar"
                  height={400}
                  scrollable={false}
                  itemHeight={35}
                  allowedChartTypes={['bar', 'horizontal']}
                  onClick={onChartClick}
                  filterField="CARI_UNVANI"
                />
              </div>
              <button 
                className="show-all-btn"
                onClick={() => setShowAllAdet(!showAllAdet)}
              >
                {showAllAdet ? 'İlk 10\'u Göster' : `Hepsini Göster (${tedarikciAdetData.length})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TedarikciAnaliz;
