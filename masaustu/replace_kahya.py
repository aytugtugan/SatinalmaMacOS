import json
p='masaustu/ocak_2026_data.json'
with open(p,'r',encoding='utf-8-sig') as f:
    data=json.load(f)
old='KAHYA KİMYA AMBALAJ GIDA TARIM ÜRÜNLERİ SAN.VE TİC.LİM.ŞİRKETİ'
new='KAYRA KİMYA AMBALAJ GIDA TARIM ÜRÜNLERİ SAN.VE TİC.LİM.ŞİRKETİ'
count=0
for item in data:
    if isinstance(item,dict) and item.get('CARI_UNVANI')==old:
        item['CARI_UNVANI']=new
        count+=1
if count>0:
    with open(p,'w',encoding='utf-8') as f:
        json.dump(data,f,ensure_ascii=False,indent=2)
print('replaced',count)
