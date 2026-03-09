import json, urllib.request, sys

def fetch(url):
    req = urllib.request.Request(url, headers={'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

print("=== .NET API (10.35.20.17:5050) ===")
try:
    net_data = fetch('http://10.35.20.17:5050/api/Satinalma/veriler')
    print(f"Toplam kayıt: {len(net_data)}")
    net_siparisler = set(r.get('SİPARİŞ NUMARASI','') for r in net_data if r.get('SİPARİŞ NUMARASI'))
    print(f"Benzersiz sipariş: {len(net_siparisler)}")
    
    net_dates = sorted([r['SİPARİŞ TARİHİ'] for r in net_data if r.get('SİPARİŞ TARİHİ')])
    print(f"Min tarih: {net_dates[0] if net_dates else 'yok'}")
    print(f"Max tarih: {net_dates[-1] if net_dates else 'yok'}")
    
    firmalar = {}
    for r in net_data:
        f = r.get('FİRMA NUMARASI', 'BOŞ')
        firmalar[f] = firmalar.get(f, 0) + 1
    print(f"Firma dağılımı: {firmalar}")
    
    onaysiz = sum(1 for r in net_data if not r.get('SİPARİŞ ONAYLAYAN'))
    print(f"Onaysız kayıt: {onaysiz}/{len(net_data)}")
    
    # Sipariş prefix
    prefixes = {}
    for r in net_data:
        sno = r.get('SİPARİŞ NUMARASI', '')
        if sno and '.' in sno:
            p = '.'.join(sno.split('.')[:2])
            prefixes[p] = prefixes.get(p, 0) + 1
    print(f"Sipariş prefix: {prefixes}")
except Exception as e:
    print(f"HATA: {e}")
    net_data = []
    net_siparisler = set()

print("\n=== Node.js API (10.35.55.3:5050) ===")
try:
    node_data = fetch('http://10.35.55.3:5050/api/Satinalma/veriler')
    print(f"Toplam kayıt: {len(node_data)}")
    node_siparisler = set(r.get('SİPARİŞ NUMARASI','') for r in node_data if r.get('SİPARİŞ NUMARASI'))
    print(f"Benzersiz sipariş: {len(node_siparisler)}")
    
    node_dates = sorted([r['SİPARİŞ TARİHİ'] for r in node_data if r.get('SİPARİŞ TARİHİ')])
    print(f"Min tarih: {node_dates[0] if node_dates else 'yok'}")
    print(f"Max tarih: {node_dates[-1] if node_dates else 'yok'}")
    
    firmalar2 = {}
    for r in node_data:
        f = r.get('FİRMA NUMARASI', 'BOŞ')
        firmalar2[f] = firmalar2.get(f, 0) + 1
    print(f"Firma dağılımı: {firmalar2}")
    
    onaysiz2 = sum(1 for r in node_data if not r.get('SİPARİŞ ONAYLAYAN'))
    print(f"Onaysız kayıt: {onaysiz2}/{len(node_data)}")
    
    prefixes2 = {}
    for r in node_data:
        sno = r.get('SİPARİŞ NUMARASI', '')
        if sno and '.' in sno:
            p = '.'.join(sno.split('.')[:2])
            prefixes2[p] = prefixes2.get(p, 0) + 1
    print(f"Sipariş prefix: {prefixes2}")
except Exception as e:
    print(f"HATA: {e}")
    node_data = []
    node_siparisler = set()

if net_data and node_data:
    print("\n=== FARK ANALİZİ ===")
    print(f"Kayıt farkı: {len(node_data) - len(net_data)} ({len(node_data)} vs {len(net_data)})")
    print(f"Sipariş farkı: {len(node_siparisler) - len(net_siparisler)} ({len(node_siparisler)} vs {len(net_siparisler)})")
    
    extra = node_siparisler - net_siparisler
    missing = net_siparisler - node_siparisler
    print(f"Node'da var .NET'te yok: {len(extra)} sipariş")
    print(f".NET'te var Node'da yok: {len(missing)} sipariş")
    
    if extra:
        # Extra siparişlerin tarihlerine bak
        extra_dates = []
        for r in node_data:
            if r.get('SİPARİŞ NUMARASI') in extra:
                extra_dates.append(r.get('SİPARİŞ TARİHİ', 'yok'))
        extra_dates.sort()
        print(f"Fazla siparişlerin tarih aralığı: {extra_dates[0] if extra_dates else 'yok'} - {extra_dates[-1] if extra_dates else 'yok'}")
        
        # Fazla olan kayıtlarda SİPARİŞ ONAYLAYAN durumu
        extra_onaysiz = sum(1 for r in node_data if r.get('SİPARİŞ NUMARASI') in extra and not r.get('SİPARİŞ ONAYLAYAN'))
        extra_total = sum(1 for r in node_data if r.get('SİPARİŞ NUMARASI') in extra)
        print(f"Fazla kayıtlarda onaysız: {extra_onaysiz}/{extra_total}")
