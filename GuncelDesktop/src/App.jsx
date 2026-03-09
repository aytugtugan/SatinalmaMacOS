import React, { useState, useEffect } from 'react';
import { ConfigProvider, Select, Spin } from 'antd';
import trTR from 'antd/locale/tr_TR';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import TalepAnaliz from './pages/TalepAnaliz';
import SiparisAnaliz from './pages/SiparisAnaliz';
import TedarikciAnaliz from './pages/TedarikciAnaliz';
import FinansalAnaliz from './pages/FinansalAnaliz';
import DetayliRapor from './pages/DetayliRapor';
import { ShopOutlined, ReloadOutlined, MinusOutlined, BorderOutlined, CloseOutlined, BlockOutlined } from '@ant-design/icons';
import './styles.css';

// Custom Title Bar Component
const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(true);

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await window.api.windowIsMaximized();
      setIsMaximized(maximized);
    };
    checkMaximized();
  }, []);

  const handleMinimize = () => {
    window.api.windowMinimize();
  };

  const handleMaximize = async () => {
    await window.api.windowMaximize();
    const maximized = await window.api.windowIsMaximized();
    setIsMaximized(maximized);
  };

  const handleClose = () => {
    window.api.windowClose();
  };

  return (
    <div className="custom-title-bar">
      <div className="title-bar-drag">
        <span className="title-bar-text">Satın Alma Rapor Sistemi</span>
      </div>
      <div className="title-bar-controls">
        <button className="title-bar-btn minimize-btn" onClick={handleMinimize} title="Küçült">
          <MinusOutlined />
        </button>
        <button className="title-bar-btn maximize-btn" onClick={handleMaximize} title={isMaximized ? "Geri Yükle" : "Büyüt"}>
          {isMaximized ? <BlockOutlined /> : <BorderOutlined />}
        </button>
        <button className="title-bar-btn close-btn" onClick={handleClose} title="Kapat">
          <CloseOutlined />
        </button>
      </div>
    </div>
  );
};

const App = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [allData, setAllData] = useState(null);
  const [columnMapping, setColumnMapping] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ambarList, setAmbarList] = useState([]);
  const [selectedAmbar, setSelectedAmbar] = useState('all');
  const [fabrikaKarsilastirma, setFabrikaKarsilastirma] = useState(false);
  
  // Detaylı rapor filtreleme state'i
  const [detayFilter, setDetayFilter] = useState(null);

  // Grafik tıklama handler'ı - detaylı rapora yönlendir ve filtrele
  const handleChartClick = (name, value, originalData, filterField) => {
    console.log('Chart clicked:', { name, value, originalData, filterField });
    setDetayFilter({ field: filterField, value: name, originalValue: value });
    setCurrentPage('detay');
  };

  // Filtreyi temizle
  const clearDetayFilter = () => {
    setDetayFilter(null);
  };

  // Ambar listesini yukle
  const loadAmbarList = async () => {
    try {
      const result = await window.api.getAmbarList();
      if (result.success) {
        setAmbarList(result.data);
      }
    } catch (err) {
      console.error('Ambar list error:', err);
    }
  };

  // Dashboard verilerini yukle
  const loadDashboardData = async (ambarFilter) => {
    try {
      setLoading(true);
      const result = await window.api.getDashboardStats(ambarFilter);
      if (result.success) {
        setDashboardData(result.data);
        // Kolon mapping'ini dashboardData'dan al
        if (result.data.columns) {
          setColumnMapping(result.data.columns);
        }
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Tum verileri yukle
  const loadAllData = async () => {
    try {
      const result = await window.api.getAllData();
      if (result.success) {
        // Yeni format: { data, columns }
        if (result.data.data && result.data.columns) {
          setAllData(result.data.data);
          setColumnMapping(result.data.columns);
        } else {
          setAllData(result.data);
        }
      }
    } catch (err) {
      console.error('All data error:', err);
    }
  };

  // Ilk yukleme
  useEffect(() => {
    loadAmbarList();
    loadDashboardData(selectedAmbar);
    loadAllData();
  }, []);

  // Ambar degistiginde verileri yeniden yukle
  useEffect(() => {
    loadDashboardData(selectedAmbar);
  }, [selectedAmbar]);

  const handleRefresh = () => {
    loadDashboardData(selectedAmbar);
    loadAllData();
  };

  const renderPage = () => {
    const isFabrikaMode = selectedAmbar === 'all' && fabrikaKarsilastirma;
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard data={dashboardData} columns={columnMapping} fabrikaKarsilastirma={isFabrikaMode} onChartClick={handleChartClick} />;
      case 'talep':
        return <TalepAnaliz data={dashboardData} columns={columnMapping} fabrikaKarsilastirma={isFabrikaMode} onChartClick={handleChartClick} />;
      case 'siparis':
        return <SiparisAnaliz data={dashboardData} columns={columnMapping} fabrikaKarsilastirma={isFabrikaMode} onChartClick={handleChartClick} />;
      case 'tedarikci':
        return <TedarikciAnaliz data={dashboardData} columns={columnMapping} fabrikaKarsilastirma={isFabrikaMode} onChartClick={handleChartClick} />;
      case 'finansal':
        return <FinansalAnaliz data={dashboardData} columns={columnMapping} fabrikaKarsilastirma={isFabrikaMode} onChartClick={handleChartClick} />;
      case 'detay':
        return <DetayliRapor data={allData} selectedAmbar={selectedAmbar} columns={columnMapping} externalFilter={detayFilter} onClearFilter={clearDetayFilter} />;
      default:
        return <Dashboard data={dashboardData} columns={columnMapping} fabrikaKarsilastirma={isFabrikaMode} onChartClick={handleChartClick} />;
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="app-wrapper">
        <TitleBar />
        <div className="app-container">
          <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <div className="loading-text">Veriler yükleniyor...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="app-wrapper">
        <TitleBar />
        <div className="app-container">
          <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
          <div className="error-container">
            <div className="error-icon">!</div>
            <div className="error-message">{error}</div>
            <button className="retry-btn" onClick={handleRefresh}>
              Tekrar Dene
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ConfigProvider locale={trTR}>
      <div className="app-wrapper">
        <TitleBar />
        <div className="app-container">
          <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
          <main className="main-content">
            {/* Global Filter Bar */}
            <div className="global-filter-bar">
              <div className="filter-left">
                <ShopOutlined className="filter-icon" />
                <span className="filter-label">Fabrika:</span>
                <Select
                  value={selectedAmbar}
                  onChange={(val) => {
                    setSelectedAmbar(val);
                    if (val !== 'all') setFabrikaKarsilastirma(false);
                  }}
                  style={{ width: 220 }}
                  size="middle"
                    options={[
                    { value: 'all', label: 'Tüm Fabrikalar' },
                    ...ambarList.map(item => ({
                      value: item.ambar,
                      label: item.ambar
                    }))
                  ]}
                />
                {selectedAmbar === 'all' && (
                  <div className="fabrika-karsilastirma-toggle">
                    <span className="toggle-label">Fabrika Karşılaştırması:</span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={fabrikaKarsilastirma}
                        onChange={(e) => setFabrikaKarsilastirma(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                )}
              </div>
              <div className="filter-right">
                <button className="refresh-btn" onClick={handleRefresh} disabled={loading}>
                  <ReloadOutlined spin={loading} />
                  <span>Yenile</span>
                </button>
              </div>
            </div>
            {renderPage()}
          </main>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default App;
