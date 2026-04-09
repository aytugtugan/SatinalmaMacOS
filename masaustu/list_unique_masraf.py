import json
with open('ocak_2026_data.json','r',encoding='utf-8') as f:
    data=json.load(f)
vals=sorted({item.get('MASRAF_MERKEZI') for item in data if isinstance(item,dict) and 'MASRAF_MERKEZI' in item})
for v in vals:
    print(v)