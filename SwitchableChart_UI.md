# SwitchableChart - Üçlü Grafik Gösterimi UI Kodu

React Native için hazır, bağımsız kullanılabilir SwitchableChart komponenti. Bar (Çubuk), Pie (Pasta) ve Line (Çizgi) grafikleri arasında geçiş yapabilir. Altta detay listesi ve "Devamını Gör" modal'ı içerir.

## Gerekli Bağımlılıklar

```bash
npm install react-native-svg @expo/vector-icons
```

## Tam Komponent Kodu

```jsx
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, ScrollView, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Rect, Text as SvgText, Line, G, Path } from 'react-native-svg';

// =====================
// RENKLER
// =====================
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

const colors = {
  primary: {
    50: '#e3f2fd',
    100: '#bbdefb',
    200: '#90caf9',
    500: '#0a6ed1',
    600: '#1565c0',
    700: '#0d47a1',
  },
  neutral: {
    0: '#ffffff',
    50: '#fafbfc',
    100: '#f5f6f7',
    200: '#edeff0',
    400: '#b3b6b9',
    500: '#8c8f93',
    600: '#6a6d70',
    800: '#32363a',
    900: '#1a1d1f',
  },
};

// =====================
// YARDIMCI FONKSİYONLAR
// =====================

// Sayı formatlama - Genel
const formatNumber = (value) => {
  if (value == null || isNaN(value)) return '0';
  return Number(value).toLocaleString('tr-TR');
};

// Y ekseni için kısa format
const formatYAxisLabel = (value) => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${Math.round(value / 1000)}K`;
  }
  return value.toLocaleString('tr-TR');
};

// =====================
// GRAFİK TİPLERİ
// =====================
const CHART_TYPES = [
  { key: 'bar', icon: 'chart-bar', name: 'Çubuk' },
  { key: 'pie', icon: 'chart-pie', name: 'Pasta' },
  { key: 'line', icon: 'chart-line', name: 'Çizgi' },
];

// =====================
// ANA KOMPONENT
// =====================
const SwitchableChart = ({
  title,
  data = [],
  dataKey = 'value',
  nameKey = 'name',
  defaultType = 'bar',
  valueFormatter,
  height = 160,
  sort = true,
  showLegend = true,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = windowWidth - 48;
  
  const [chartType, setChartType] = useState(defaultType);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showAllItems, setShowAllItems] = useState(false);

  // Veriyi değere göre sırala
  const sortedData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return sort
      ? [...data].sort((a, b) => (Number(b[dataKey]) || 0) - (Number(a[dataKey]) || 0))
      : [...data];
  }, [data, dataKey, sort]);

  const formatter = valueFormatter || formatNumber;

  // Boş veri durumu
  if (!sortedData || sortedData.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.emptyBody}>
          <MaterialCommunityIcons name="inbox-outline" size={28} color={colors.neutral[400]} />
          <Text style={styles.emptyText}>Veri bulunamadı</Text>
        </View>
      </View>
    );
  }

  // Veri hazırlama
  const { displayData, values, totalValue } = useMemo(() => {
    const total = sortedData.reduce((sum, item) => sum + (Number(item[dataKey]) || 0), 0);
    const vals = sortedData.map((item) => Number(item[dataKey]) || 0);
    return { displayData: sortedData, values: vals, totalValue: total };
  }, [sortedData, dataKey]);

  // Detay listesi için ilk 5 item
  const visibleListItems = 5;
  const hasMoreItems = displayData.length > visibleListItems;

  // =====================
  // GRAFİK RENDER
  // =====================
  const renderChart = () => {
    const itemCount = displayData.length;
    const minBarWidth = 35;
    const barGap = 8;
    const calculatedWidth = Math.max(chartWidth, itemCount * (minBarWidth + barGap) + 60);
    const needsScroll = calculatedWidth > chartWidth;

    switch (chartType) {
      // =====================
      // PASTA GRAFİĞİ
      // =====================
      case 'pie':
        const pieValues = values;
        const pieTotal = pieValues.reduce((sum, val) => sum + val, 0);
        const centerX = chartWidth / 2;
        const centerY = height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        
        let currentAngle = -Math.PI / 2;
        const slices = pieValues.map((value, index) => {
          const angle = pieTotal > 0 ? (value / pieTotal) * 2 * Math.PI : 0;
          const startAngle = currentAngle;
          const endAngle = currentAngle + angle;
          currentAngle = endAngle;
          
          const x1 = centerX + radius * Math.cos(startAngle);
          const y1 = centerY + radius * Math.sin(startAngle);
          const x2 = centerX + radius * Math.cos(endAngle);
          const y2 = centerY + radius * Math.sin(endAngle);
          
          const largeArcFlag = angle > Math.PI ? 1 : 0;
          
          const path = `
            M ${centerX} ${centerY}
            L ${x1} ${y1}
            A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
            Z
          `;
          
          return {
            path,
            color: COLORS[index % COLORS.length],
            percentage: pieTotal > 0 ? ((value / pieTotal) * 100).toFixed(1) : 0,
          };
        });
        
        return (
          <View style={styles.pieContainer}>
            <Svg width={chartWidth} height={height}>
              {slices.map((slice, index) => (
                <G key={index}>
                  <Path d={slice.path} fill={slice.color} opacity={0.9} />
                  <Path d={slice.path} fill="#ffffff" opacity={0.15} />
                </G>
              ))}
            </Svg>
          </View>
        );

      // =====================
      // ÇİZGİ GRAFİĞİ
      // =====================
      case 'line':
        const linePadding = 50;
        const lineRightPadding = 15;
        const lineTopPadding = 20;
        const lineBottomPadding = 10;
        const lineChartWidth = calculatedWidth - linePadding - lineRightPadding;
        const lineChartHeight = height - lineTopPadding - lineBottomPadding;
        const lineMaxValue = Math.max(...values, 1);
        const pointCount = values.length;
        const pointGap = lineChartWidth / (pointCount - 1 || 1);
        
        const lineYAxisSteps = 4;
        const lineYAxisValues = [];
        for (let i = 0; i <= lineYAxisSteps; i++) {
          lineYAxisValues.push((lineMaxValue / lineYAxisSteps) * i);
        }
        
        const points = values.map((value, index) => {
          const x = linePadding + (pointCount > 1 ? index * pointGap : lineChartWidth / 2);
          const y = lineTopPadding + lineChartHeight - (value / lineMaxValue) * lineChartHeight;
          return { x, y, value };
        });
        
        let linePath = '';
        if (points.length > 0) {
          linePath = `M ${points[0].x} ${points[0].y}`;
          for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const cpx1 = prev.x + (curr.x - prev.x) / 3;
            const cpx2 = prev.x + 2 * (curr.x - prev.x) / 3;
            linePath += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
          }
        }
        
        let areaPath = linePath;
        if (points.length > 0) {
          areaPath += ` L ${points[points.length - 1].x} ${lineTopPadding + lineChartHeight}`;
          areaPath += ` L ${points[0].x} ${lineTopPadding + lineChartHeight} Z`;
        }

        const lineChartContent = (
          <Svg width={calculatedWidth} height={height}>
            {lineYAxisValues.map((yVal, idx) => {
              const y = lineTopPadding + lineChartHeight - (yVal / lineMaxValue) * lineChartHeight;
              return (
                <G key={idx}>
                  <Line x1={linePadding} y1={y} x2={calculatedWidth - lineRightPadding} y2={y}
                    stroke={colors.neutral[200]} strokeWidth={1} strokeDasharray="4 4" />
                  <SvgText x={linePadding - 6} y={y + 4} fontSize={9} fill={colors.neutral[600]} textAnchor="end">
                    {formatYAxisLabel(Math.round(yVal))}
                  </SvgText>
                </G>
              );
            })}
            <Path d={areaPath} fill={colors.primary[500]} opacity={0.1} />
            <Path d={linePath} stroke={colors.primary[500]} strokeWidth={2.5} fill="none"
              strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point, index) => {
              const pointColor = COLORS[index % COLORS.length];
              return (
                <G key={index}>
                  <Rect x={point.x - 8} y={point.y - 8} width={16} height={16}
                    fill={pointColor} opacity={0.2} rx={8} />
                  <Rect x={point.x - 5} y={point.y - 5} width={10} height={10}
                    fill={pointColor} rx={5} />
                  <Rect x={point.x - 2} y={point.y - 2} width={4} height={4}
                    fill="#ffffff" rx={2} />
                </G>
              );
            })}
          </Svg>
        );

        if (needsScroll) {
          return (
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.scrollContainer}>
              <View style={styles.customBarContainer}>{lineChartContent}</View>
            </ScrollView>
          );
        }
        return <View style={styles.customBarContainer}>{lineChartContent}</View>;

      // =====================
      // ÇUBUK GRAFİĞİ (DEFAULT)
      // =====================
      case 'bar':
      default:
        const barPadding = 50;
        const rightPadding = 15;
        const topPadding = 10;
        const bottomPadding = 10;
        const barChartWidth = calculatedWidth - barPadding - rightPadding;
        const barChartHeight = height - topPadding - bottomPadding;
        const maxValue = Math.max(...values, 1);
        const barCount = values.length;
        const barWidth = Math.min(35, Math.max(20, (barChartWidth - (barCount - 1) * barGap) / barCount));
        const totalBarsWidth = barCount * barWidth + (barCount - 1) * barGap;
        const startX = barPadding + (barChartWidth - totalBarsWidth) / 2;
        
        const yAxisSteps = 4;
        const yAxisValues = [];
        for (let i = 0; i <= yAxisSteps; i++) {
          yAxisValues.push((maxValue / yAxisSteps) * i);
        }

        const barChartContent = (
          <Svg width={calculatedWidth} height={height}>
            {yAxisValues.map((yVal, idx) => {
              const y = topPadding + barChartHeight - (yVal / maxValue) * barChartHeight;
              return (
                <G key={idx}>
                  <Line x1={barPadding} y1={y} x2={calculatedWidth - rightPadding} y2={y}
                    stroke={colors.neutral[200]} strokeWidth={1} strokeDasharray="4 4" />
                  <SvgText x={barPadding - 6} y={y + 4} fontSize={9} fill={colors.neutral[600]} textAnchor="end">
                    {formatYAxisLabel(Math.round(yVal))}
                  </SvgText>
                </G>
              );
            })}
            {values.map((value, index) => {
              const barHeight = (value / maxValue) * barChartHeight;
              const x = startX + index * (barWidth + barGap);
              const y = topPadding + barChartHeight - barHeight;
              const barColor = COLORS[index % COLORS.length];
              
              return (
                <G key={index}>
                  <Rect x={x} y={y} width={barWidth} height={barHeight}
                    fill={barColor} rx={4} ry={4} opacity={0.9} />
                  <Rect x={x} y={y} width={barWidth * 0.5} height={barHeight}
                    fill="#ffffff" rx={4} ry={4} opacity={0.15} />
                </G>
              );
            })}
          </Svg>
        );

        if (needsScroll) {
          return (
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.scrollContainer}>
              <View style={styles.customBarContainer}>{barChartContent}</View>
            </ScrollView>
          );
        }
        return <View style={styles.customBarContainer}>{barChartContent}</View>;
    }
  };

  // =====================
  // DETAY LİSTESİ
  // =====================
  const renderValueList = () => {
    const itemsToShow = displayData.slice(0, visibleListItems);
    
    return (
      <View style={styles.valueList}>
        {itemsToShow.map((item, index) => {
          const itemValue = Number(item[dataKey]) || 0;
          const percentage = totalValue > 0 ? ((itemValue / totalValue) * 100).toFixed(1) : 0;
          const itemColor = COLORS[index % COLORS.length];
          
          return (
            <TouchableOpacity
              key={index}
              style={[styles.valueItem, selectedIndex === index && styles.valueItemSelected]}
              onPress={() => setSelectedIndex(selectedIndex === index ? null : index)}
              activeOpacity={0.7}
            >
              <View style={styles.valueItemRow}>
                <View style={[styles.colorDot, { backgroundColor: itemColor }]} />
                <Text style={styles.valueItemLabel} numberOfLines={1}>
                  {item[nameKey] || 'Belirsiz'}
                </Text>
              </View>
              <View style={styles.valueItemValues}>
                <Text style={styles.valueItemValue}>{formatter(itemValue)}</Text>
                <Text style={styles.valueItemPercent}>{percentage}%</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        
        {hasMoreItems && (
          <TouchableOpacity
            style={styles.showMoreButton}
            onPress={() => setShowAllItems(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.showMoreText}>
              Devamını Gör ({displayData.length - visibleListItems} daha)
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color={colors.primary[500]} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // =====================
  // TÜM ÖĞELER MODALI
  // =====================
  const renderAllItemsModal = () => (
    <Modal
      visible={showAllItems}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAllItems(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={() => setShowAllItems(false)} style={styles.modalCloseBtn}>
              <MaterialCommunityIcons name="close" size={24} color={colors.neutral[600]} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalSummary}>
            <Text style={styles.modalSummaryText}>
              Toplam: {formatter(totalValue)} • {displayData.length} kalem
            </Text>
          </View>
          
          <ScrollView style={styles.modalList} showsVerticalScrollIndicator={true}>
            {displayData.map((item, index) => {
              const itemValue = Number(item[dataKey]) || 0;
              const percentage = totalValue > 0 ? ((itemValue / totalValue) * 100).toFixed(1) : 0;
              const itemColor = COLORS[index % COLORS.length];
              
              return (
                <View key={index} style={styles.modalItem}>
                  <View style={styles.modalItemLeft}>
                    <View style={[styles.colorDot, { backgroundColor: itemColor }]} />
                    <Text style={styles.modalItemRank}>{index + 1}.</Text>
                    <Text style={styles.modalItemLabel} numberOfLines={2}>
                      {item[nameKey] || 'Belirsiz'}
                    </Text>
                  </View>
                  <View style={styles.modalItemRight}>
                    <Text style={styles.modalItemValue}>{formatter(itemValue)}</Text>
                    <Text style={styles.modalItemPercent}>{percentage}%</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // =====================
  // ANA RENDER
  // =====================
  return (
    <View style={styles.card}>
      {/* HEADER - Başlık ve Grafik Tipi Seçici */}
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <View style={styles.typeSelector}>
          {CHART_TYPES.map((type) => (
            <TouchableOpacity
              key={type.key}
              style={[styles.typeBtn, chartType === type.key && styles.typeBtnActive]}
              onPress={() => setChartType(type.key)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons 
                name={type.icon} 
                size={16} 
                color={chartType === type.key ? colors.neutral[0] : colors.neutral[500]} 
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* BODY - Grafik Alanı */}
      <View style={styles.body}>
        {renderChart()}
      </View>

      {/* FOOTER - Detay Listesi */}
      {showLegend && renderValueList()}
      
      {/* MODAL - Tüm Öğeler */}
      {renderAllItemsModal()}
    </View>
  );
};

// =====================
// STİLLER
// =====================
const styles = StyleSheet.create({
  // KART
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  
  // HEADER
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    backgroundColor: colors.neutral[0],
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[800],
    marginRight: 8,
    lineHeight: 18,
  },
  
  // GRAFİK TİPİ SEÇİCİ
  typeSelector: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.neutral[100],
    padding: 4,
    borderRadius: 8,
  },
  typeBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBtnActive: {
    backgroundColor: colors.primary[500],
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  
  // BODY
  body: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  scrollContainer: {
    width: '100%',
  },
  pieContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  customBarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // DETAY LİSTESİ
  valueList: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.neutral[50],
  },
  valueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 5,
    marginBottom: 3,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  valueItemSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  valueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 3,
    marginRight: 4,
    minWidth: 0,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
    flexShrink: 0,
  },
  valueItemLabel: {
    fontSize: 11,
    color: colors.neutral[800],
    flex: 1,
    lineHeight: 15,
  },
  valueItemValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  valueItemValue: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.neutral[900],
    textAlign: 'right',
  },
  valueItemPercent: {
    fontSize: 9,
    color: colors.neutral[500],
    minWidth: 28,
    textAlign: 'right',
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  
  // DEVAMINI GÖR BUTONU
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 4,
    backgroundColor: colors.primary[50],
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  showMoreText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary[600],
    marginRight: 4,
  },
  
  // BOŞ DURUM
  emptyBody: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 4,
  },
  
  // MODAL STİLLERİ
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[900],
    flex: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSummary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.primary[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[100],
  },
  modalSummaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[700],
  },
  modalList: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  modalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  modalItemRank: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[500],
    marginRight: 6,
    minWidth: 20,
  },
  modalItemLabel: {
    fontSize: 12,
    color: colors.neutral[800],
    flex: 1,
  },
  modalItemRight: {
    alignItems: 'flex-end',
  },
  modalItemValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  modalItemPercent: {
    fontSize: 10,
    color: colors.neutral[500],
    marginTop: 2,
  },
});

export default SwitchableChart;
```

---

## Kullanım Örneği

```jsx
import SwitchableChart from './components/SwitchableChart';

// Örnek veri
const sampleData = [
  { name: 'Kategori A', value: 125000 },
  { name: 'Kategori B', value: 98500 },
  { name: 'Kategori C', value: 76200 },
  { name: 'Kategori D', value: 54300 },
  { name: 'Kategori E', value: 42100 },
  { name: 'Kategori F', value: 31500 },
  { name: 'Kategori G', value: 22800 },
];

// Kullanım
<SwitchableChart
  title="Satış Dağılımı"
  data={sampleData}
  dataKey="value"
  nameKey="name"
  defaultType="bar"
  height={160}
  sort={true}
  showLegend={true}
/>
```

---

## Props Açıklamaları

| Prop | Tip | Varsayılan | Açıklama |
|------|-----|------------|----------|
| `title` | string | - | Grafik başlığı |
| `data` | array | `[]` | Grafik verisi |
| `dataKey` | string | `'value'` | Değer alanının adı |
| `nameKey` | string | `'name'` | İsim alanının adı |
| `defaultType` | string | `'bar'` | Başlangıç grafik tipi (`bar`, `pie`, `line`) |
| `valueFormatter` | function | `formatNumber` | Değer formatlama fonksiyonu |
| `height` | number | `160` | Grafik yüksekliği (px) |
| `sort` | boolean | `true` | Verileri büyükten küçüğe sırala |
| `showLegend` | boolean | `true` | Alt detay listesini göster |

---

## Özellikler

✅ **Üçlü Grafik Desteği:** Bar, Pie, Line  
✅ **Yatay Kaydırma:** Çok fazla veri olduğunda otomatik scroll  
✅ **Y Ekseni Formatı:** K (bin), M (milyon) kısaltmaları  
✅ **Detay Listesi:** İlk 5 öğe gösterilir  
✅ **Devamını Gör Modal:** Tüm verileri görüntüleme  
✅ **Seçilebilir Öğeler:** Liste öğelerine tıklama  
✅ **Responsive:** Ekran genişliğine göre ayarlanır  
✅ **Boş Durum:** Veri yoksa uygun mesaj gösterir
