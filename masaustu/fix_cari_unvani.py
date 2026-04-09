import json, re
path='masaustu/ocak_2026_data.json'
with open(path,'r',encoding='utf-8') as f:
    data=json.load(f)

old_forms = [
    'TUNA OFSET ETİKET SAN. VE TİC. LTD. ŞTİ.',
    'TUNA OFSET - ETİKET SANAYİ TİCARET LİMİTED ŞİRKETİ',
]
new = 'TUNA OFSET - ETİKET SANAYİ TİCARET LİMİTED ŞİRKETİ'

changed=0
for item in data:
    if not isinstance(item,dict):
        continue
    cu = item.get('CARI_UNVANI')
    if not isinstance(cu,str):
        continue
    cu_norm = re.sub(r"\s+"," ",cu.strip())
    for old in old_forms:
        if cu_norm==old:
            if cu!=new:
                item['CARI_UNVANI']=new
                changed+=1
            break
    else:
        # also handle similar forms that contain 'TUNA OFSET'
        if 'TUNA OFSET' in cu_norm:
            if cu!=new:
                item['CARI_UNVANI']=new
                changed+=1

if changed>0:
    with open(path,'w',encoding='utf-8') as f:
        json.dump(data,f,ensure_ascii=False,indent=2)
print('Replaced CARI_UNVANI entries:', changed)
