import json
p='masaustu/ocak_2026_data.json'
with open(p,'r',encoding='utf-8') as f:
    s=f.read()
old='"CARI_UNVANI": "MANİSA TEKNİK HIRDAVAT TİCARET LİMİTED ŞİRKETİ"'
new='"CARI_UNVANI": "MANİSA TEKNİK HIRDAVAT TİC.LTD.ŞTİ."'
count=s.count(old)
if count:
    s=s.replace(old,new)
    with open(p,'w',encoding='utf-8') as f:
        f.write(s)
print('replaced',count)
