const http = require('http');

http.get('http://10.35.20.17:5055/api/Satinalma/veriler', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const all = JSON.parse(data);
    const arr = Array.isArray(all) ? all : (all.data || all.records || []);
    
    console.log('API total records:', arr.length);
    
    // Field names
    if (arr.length > 0) {
      console.log('Field names:', Object.keys(arr[0]).join(', '));
    }
    
    // Check S.ACM.GAN.000083
    const match083 = arr.filter(r => {
      const vals = Object.values(r).map(v => String(v));
      return vals.some(v => v.includes('ACM.GAN.000083'));
    });
    console.log('\nS.ACM.GAN.000083 in API (any field):', match083.length);
    
    // Check KAPISON
    const kapison = arr.filter(r => {
      const vals = Object.values(r).map(v => String(v));
      return vals.some(v => v.includes('KAPISON'));
    });
    console.log('KAPISON in API:', kapison.length);
    kapison.forEach(m => {
      const sip = m['SİPARİŞ NUMARASI'] || m['SIPARIS_NO'] || 'N/A';
      const mal = m['SİPARİŞ MALZEME'] || m['SIPARIS_MALZEME'] || 'N/A';
      console.log('  ->', sip, '|', mal);
    });
    
    // Check ACM.GAN.00008x
    const match8x = arr.filter(r => {
      const vals = Object.values(r).map(v => String(v));
      return vals.some(v => v.includes('ACM.GAN.00008'));
    });
    console.log('\nACM.GAN.00008x matches:', match8x.length);
    match8x.forEach(m => {
      const sip = m['SİPARİŞ NUMARASI'] || m['SIPARIS_NO'] || 'N/A';
      const mal = m['SİPARİŞ MALZEME'] || m['SIPARIS_MALZEME'] || 'N/A';
      console.log('  ->', sip, '|', mal);
    });

    // Check: how many ACM.GAN total?
    const acmGan = arr.filter(r => {
      const sip = String(r['SİPARİŞ NUMARASI'] || '');
      return sip.includes('ACM.GAN');
    });
    console.log('\nTotal ACM.GAN:', acmGan.length);
    // Min/max siparis no
    const nums = acmGan.map(r => {
      const s = String(r['SİPARİŞ NUMARASI'] || '');
      const n = parseInt(s.split('.').pop());
      return { sip: s, num: n };
    }).sort((a, b) => a.num - b.num);
    if (nums.length > 0) {
      console.log('Min:', nums[0].sip);
      console.log('Max:', nums[nums.length - 1].sip);
    }
  });
}).on('error', e => console.error(e.message));
