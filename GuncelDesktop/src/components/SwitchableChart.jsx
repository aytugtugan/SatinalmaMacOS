import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  BarChartOutlined,
  PieChartOutlined,
  LineChartOutlined,
  AreaChartOutlined,
  RadarChartOutlined,
  MenuOutlined,
  InboxOutlined,
} from '@ant-design/icons';

// Enterprise color palette
const COLORS = [
  '#0a6ed1', // SAP Blue
  '#107e3e', // Success Green
  '#e9730c', // Warning Orange
  '#7c3aed', // Purple
  '#bb0000', // Error Red
  '#1e88e5', // Light Blue
  '#43a047', // Light Green
  '#fb8c00', // Light Orange
  '#8e24aa', // Light Purple
  '#e53935', // Light Red
];

const CHART_TYPES = [
  { key: 'bar', icon: <BarChartOutlined />, label: 'Cubuk Grafik' },
  { key: 'pie', icon: <PieChartOutlined />, label: 'Pasta Grafik' },
  { key: 'line', icon: <LineChartOutlined />, label: 'Cizgi Grafik' },
  { key: 'area', icon: <AreaChartOutlined />, label: 'Alan Grafik' },
  { key: 'radar', icon: <RadarChartOutlined />, label: 'Radar Grafik' },
  { key: 'horizontal', icon: <MenuOutlined />, label: 'Yatay Cubuk' },
];

const formatNumber = (value) => {
  if (value === null || value === undefined) return '0';
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString('tr-TR');
};

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '0 TL';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const CustomTooltip = ({ active, payload, label, valueFormatter }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#ffffff',
        padding: '12px 16px',
        border: '1px solid #edeff0',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        minWidth: '140px',
        fontFamily: "'72', 'SAP 72', 'Segoe UI', sans-serif",
      }}>
        <p style={{ 
          fontWeight: 600, 
          marginBottom: 8, 
          color: '#1a1d1f',
          fontSize: '13px',
          borderBottom: '1px solid #edeff0',
          paddingBottom: '8px',
        }}>
          {label || payload[0]?.name}
        </p>
        {payload.map((entry, index) => {
          // Normalize label: if recharts provides generic 'value' label, show 'Tutar'
          const rawLabel = entry.name || entry.dataKey || (entry.payload && entry.payload.name) || '';
          const label = (rawLabel && String(rawLabel).toLowerCase() === 'value') ? 'Tutar' : (rawLabel || 'Tutar');
          return (
            <p key={index} style={{ 
              color: entry.color || '#32363a', 
              margin: '6px 0',
              fontSize: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
            }}>
              <span style={{ color: '#6a6d70' }}>{label}:</span>
              <span style={{ fontWeight: 600 }}>
                {valueFormatter ? valueFormatter(entry.value) : formatNumber(entry.value)}
              </span>
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

const CustomLegend = ({ payload }) => {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      flexWrap: 'wrap', 
      gap: '16px',
      marginTop: '12px',
      fontSize: '12px',
      fontFamily: "'72', 'SAP 72', 'Segoe UI', sans-serif",
    }}>
      {payload?.map((entry, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '2px',
            background: entry.color,
          }} />
          <span style={{ color: '#515356' }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

// helper to coerce values to numbers for sorting
function toNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    // remove currency symbols, commas, spaces
    const n = parseFloat(v.replace(/[^0-9.-]+/g, ''));
    return isNaN(n) ? 0 : n;
  }
  const num = Number(v);
  return isNaN(num) ? 0 : num;
}

const SwitchableChart = ({
  title,
  data = [],
  dataKey,
  nameKey,
  defaultType = 'bar',
  valueFormatter,
  height = 280,
  showLegend = false,
  sort = true, // new prop: whether to sort descending by dataKey
  scrollable = false, // new prop: enable scrolling for many items
  itemHeight = 35, // height per item when scrollable
  allowedChartTypes, // optional: array of allowed chart types
  onClick, // click handler: (name, value, originalData) => void
  filterField, // field name to use for filtering in DetayliRapor
}) => {
  const [chartType, setChartType] = useState(defaultType);

  // Handle chart element click
  const handleChartClick = (data, index) => {
    if (onClick && data && data.activePayload && data.activePayload.length > 0) {
      const payload = data.activePayload[0].payload;
      const name = payload[nameKey] || payload.name;
      const value = payload[dataKey] || payload.value;
      onClick(name, value, payload, filterField);
    }
  };

  // Handle pie/cell click
  const handleCellClick = (entry, index) => {
    if (onClick && entry) {
      const name = entry[nameKey] || entry.name;
      const value = entry[dataKey] || entry.value;
      onClick(name, value, entry, filterField);
    }
  };

  // safe sorted copy (descending by numeric value of dataKey) when sort enabled
  const sortedData = Array.isArray(data)
    ? (sort ? [...data].sort((a, b) => toNumber(b[dataKey]) - toNumber(a[dataKey])) : [...data])
    : [];

  // Calculate dynamic height for scrollable charts
  const dynamicHeight = scrollable 
    ? Math.max(height, sortedData.length * itemHeight + 60) 
    : height;

  const renderChart = () => {
    if (!sortedData || sortedData.length === 0) {
      return (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          height: height,
          color: '#6a6d70',
          fontSize: '13px',
          fontFamily: "'72', 'SAP 72', 'Segoe UI', sans-serif",
        }}>
          <InboxOutlined style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }} />
          <span>Veri bulunamadi</span>
        </div>
      );
    }

    const formatter = valueFormatter || formatNumber;

    switch (chartType) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={sortedData}
                dataKey={dataKey}
                nameKey={nameKey}
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                paddingAngle={2}
                label={({ name, percent }) => 
                  percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                }
                labelLine={false}
                style={{ cursor: onClick ? 'pointer' : 'default' }}
              >
                {sortedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    stroke="#fff"
                    strokeWidth={2}
                    style={{ cursor: onClick ? 'pointer' : 'default' }}
                    onClick={() => handleCellClick(entry, index)}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip valueFormatter={formatter} />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart 
              data={sortedData} 
              margin={{ top: 20, right: 30, left: 10, bottom: 60 }}
              onClick={handleChartClick}
              style={{ cursor: onClick ? 'pointer' : 'default' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#edeff0" vertical={false} />
              <XAxis 
                dataKey={nameKey} 
                tick={{ fontSize: 11, fill: '#6a6d70', fontFamily: "'72', 'Segoe UI', sans-serif" }} 
                angle={-45} 
                textAnchor="end"
                height={70}
                axisLine={{ stroke: '#edeff0' }}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={formatter} 
                tick={{ fontSize: 11, fill: '#6a6d70', fontFamily: "'72', 'Segoe UI', sans-serif" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip valueFormatter={formatter} />} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke="#0a6ed1"
                strokeWidth={2.5}
                dot={{ fill: '#0a6ed1', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, cursor: onClick ? 'pointer' : 'default' }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart 
              data={sortedData} 
              margin={{ top: 20, right: 30, left: 10, bottom: 60 }}
              onClick={handleChartClick}
              style={{ cursor: onClick ? 'pointer' : 'default' }}
            >
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0a6ed1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#0a6ed1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#edeff0" vertical={false} />
              <XAxis 
                dataKey={nameKey} 
                tick={{ fontSize: 11, fill: '#6a6d70', fontFamily: "'72', 'Segoe UI', sans-serif" }} 
                angle={-45} 
                textAnchor="end"
                height={70}
                axisLine={{ stroke: '#edeff0' }}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={formatter} 
                tick={{ fontSize: 11, fill: '#6a6d70', fontFamily: "'72', 'Segoe UI', sans-serif" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip valueFormatter={formatter} />} />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke="#0a6ed1"
                strokeWidth={2}
                fill="url(#colorGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <RadarChart 
              data={sortedData} 
              cx="50%" 
              cy="50%" 
              outerRadius={80}
              onClick={handleChartClick}
              style={{ cursor: onClick ? 'pointer' : 'default' }}
            >
              <PolarGrid stroke="#edeff0" />
              <PolarAngleAxis 
                dataKey={nameKey} 
                tick={{ fontSize: 10, fill: '#6a6d70', fontFamily: "'72', 'Segoe UI', sans-serif" }} 
              />
              <PolarRadiusAxis 
                tick={{ fontSize: 10, fill: '#6a6d70', fontFamily: "'72', 'Segoe UI', sans-serif" }}
                axisLine={false}
              />
              <Radar
                name={title}
                dataKey={dataKey}
                stroke="#0a6ed1"
                fill="#0a6ed1"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Tooltip content={<CustomTooltip valueFormatter={formatter} />} />
            </RadarChart>
          </ResponsiveContainer>
        );

      case 'horizontal':
        const horizontalChartHeight = scrollable ? dynamicHeight : height;
        // Calculate max label width dynamically
        const maxLabelLength = sortedData.reduce((max, item) => {
          const label = String(item[nameKey] || '').length;
          return Math.max(max, label);
        }, 0);
        const yAxisWidth = Math.max(100, Math.min(maxLabelLength * 6, 200));
        return (
          <div style={{ 
            width: '100%',
            height: horizontalChartHeight, 
            overflowY: scrollable ? 'auto' : 'visible',
            overflowX: 'hidden',
          }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={sortedData} 
                layout="vertical" 
                margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
                onClick={handleChartClick}
                style={{ cursor: onClick ? 'pointer' : 'default' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#edeff0" horizontal={false} />
                <XAxis 
                  type="number" 
                  tickFormatter={formatter} 
                  tick={{ fontSize: 11, fill: '#6a6d70', fontFamily: "'72', 'Segoe UI', sans-serif" }}
                  axisLine={{ stroke: '#edeff0' }}
                  tickLine={false}
                />
                <YAxis 
                  type="category" 
                  dataKey={nameKey} 
                  tick={{ fontSize: 11, fill: '#32363a', fontFamily: "'72', 'Segoe UI', sans-serif" }} 
                  width={yAxisWidth}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <Tooltip content={<CustomTooltip valueFormatter={formatter} />} />
                <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {sortedData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      style={{ cursor: onClick ? 'pointer' : 'default' }}
                      onClick={() => handleCellClick(entry, index)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'bar':
      default:
        const barChartHeight = scrollable ? dynamicHeight : height;
        return (
          <div style={{ 
            width: '100%',
            height: height,
            overflowY: scrollable ? 'auto' : 'visible',
            overflowX: 'hidden',
          }}>
            <div style={{ width: '100%', height: scrollable ? barChartHeight : height }}>
              <ResponsiveContainer width="100%" height={scrollable ? barChartHeight : height}>
                <BarChart 
                  data={sortedData} 
                  margin={{ top: 20, right: 30, left: 10, bottom: 80 }}
                  onClick={handleChartClick}
                  style={{ cursor: onClick ? 'pointer' : 'default' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#edeff0" vertical={false} />
                  <XAxis 
                    dataKey={nameKey} 
                    tick={{ fontSize: 10, fill: '#6a6d70', fontFamily: "'72', 'Segoe UI', sans-serif" }} 
                    angle={-45} 
                    textAnchor="end"
                    height={90}
                    interval={0}
                    axisLine={{ stroke: '#edeff0' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tickFormatter={formatter} 
                    tick={{ fontSize: 11, fill: '#6a6d70', fontFamily: "'72', 'Segoe UI', sans-serif" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip valueFormatter={formatter} />} />
                  <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {sortedData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                        style={{ cursor: onClick ? 'pointer' : 'default' }}
                        onClick={() => handleCellClick(entry, index)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>{title}</h3>
        <div className="chart-type-selector">
          {CHART_TYPES.map((type) => {
            // Skip if allowedChartTypes is specified and type is not in it
            if (allowedChartTypes && !allowedChartTypes.includes(type.key)) {
              return null;
            }
            return (
              <button
                key={type.key}
                className={`chart-type-btn ${chartType === type.key ? 'active' : ''}`}
                onClick={() => setChartType(type.key)}
                title={type.label}
              >
                {type.icon}
              </button>
            );
          })}
        </div>
      </div>
      <div className="chart-body">
        {renderChart()}
      </div>
    </div>
  );
};

export { SwitchableChart, formatNumber, formatCurrency, COLORS };
