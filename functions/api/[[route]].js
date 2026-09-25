const SHEET_ID = '1Ae7zDMLKD3SSSJePBobjH8O8mUGkyp2bKXq-AyYBdJI';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    // ====================================================================
    // ADMIN: TẢI TOÀN BỘ DATA (0 COST GOOGLE API)
    // ====================================================================
    if (url.pathname === '/api/admin/data' && request.method === 'GET') {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== 'Bearer 0519') return new Response('Unauthorized', { status: 401 });

      const c = await env.TRIP_KV.get('CACHE_CONFIG') || "[]";
      const d = await env.TRIP_KV.get('CACHE_DATA') || "[]";
      const s = await env.TRIP_KV.get('CACHE_SHORTLIST') || "[]";
      
      return new Response(JSON.stringify({
          config: JSON.parse(c), data: JSON.parse(d), shortlist: JSON.parse(s)
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // ====================================================================
    // ADMIN: LƯU CẤU HÌNH ĐÈ LÊN GOOGLE SHEET (TỐN 1 LỆNH GOOGLE)
    // ====================================================================
    if (url.pathname === '/api/admin/update' && request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== 'Bearer 0519') return new Response('Unauthorized', { status: 401 });
        
        const body = await request.json(); 
        const token = await getGoogleAuthToken(env.GCP_EMAIL, env.GCP_KEY);
        
        // Cập nhật Google Sheet (clear rồi put)
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Config!A:Z:clear`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Config!A1?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: body.values })
        });
        
        // Cập nhật ngay vào Tủ kính KV
        await env.TRIP_KV.put('CACHE_CONFIG', JSON.stringify(body.values));
        return new Response(JSON.stringify({success: true}), {headers: {'Content-Type': 'application/json'}});
    }

    // ====================================================================
    // CÁC API KHÁCH HÀNG BÊN DƯỚI ĐƯỢC GIỮ NGUYÊN HOÀN TOÀN
    // ====================================================================

    if (url.pathname === '/api/sync' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== 'Bearer 0519') return new Response('Unauthorized', { status: 401 });

      const token = await getGoogleAuthToken(env.GCP_EMAIL, env.GCP_KEY);
      
      const resConfig = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Config!A:Z?majorDimension=ROWS`, { headers: { Authorization: `Bearer ${token}` } });
      const dataConfig = await resConfig.json();
      
      const resData = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Data!A:J?majorDimension=ROWS`, { headers: { Authorization: `Bearer ${token}` } });
      const dataData = await resData.json();

      const resShort = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Shortlist!A4:D?majorDimension=ROWS`, { headers: { Authorization: `Bearer ${token}` } });
      const dataShort = await resShort.json();

      await env.TRIP_KV.put('CACHE_CONFIG', JSON.stringify(dataConfig.values || []));
      await env.TRIP_KV.put('CACHE_DATA', JSON.stringify(dataData.values || []));
      await env.TRIP_KV.put('CACHE_SHORTLIST', JSON.stringify(dataShort.values || []));

      return new Response(JSON.stringify({ success: true, message: "Đồng bộ thành công!" }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/config' && request.method === 'GET') {
      const configValuesStr = await env.TRIP_KV.get('CACHE_CONFIG');
      if (!configValuesStr) throw new Error("Chưa có dữ liệu. Vui lòng vào Google Sheet bấm nút Đồng bộ lần đầu!");
      const configValues = JSON.parse(configValuesStr);

      const headers = configValues[0].map(h => h ? h.toString().trim() : "");
      const idxTenDot = headers.indexOf('Nội dung option');
      const idxGioiHan = headers.indexOf('SL giới hạn');
      const idxCost = headers.indexOf('Vé 1 người');
      const idxSLKM = headers.indexOf('SL khuyến mãi');
      const idxSchemeKM = headers.indexOf('Scheme khuyến mãi');
      
      const parseNumber = (val) => val ? parseInt(String(val).replace(/[^\d]/g, '')) || 0 : 0;

      const row2 = configValues[1] || [];
      const fixedCost = parseNumber(row2[idxCost]);
      const slKhuyenMai = parseNumber(row2[idxSLKM]);
      const schemeKhuyenMai = parseNumber(row2[idxSchemeKM]);
      
      let options = [];

      const dataValuesStr = await env.TRIP_KV.get('CACHE_DATA');
      const dataRows = dataValuesStr ? JSON.parse(dataValuesStr) : [];
      let bookedMapCount = {};
      for(let i=1; i<dataRows.length; i++) {
          let dot = dataRows[i][6];
          if(dot) { bookedMapCount[dot] = (bookedMapCount[dot] || 0) + 1; }
      }

      let heldMap = {};
      try {
          const listed = await env.TRIP_KV.list();
          for (const key of listed.keys) {
              if (key.name.startsWith("HOLD-")) {
                  const val = await env.TRIP_KV.get(key.name);
                  if (val) {
                      const parsed = JSON.parse(val);
                      heldMap[parsed.dot] = (heldMap[parsed.dot] || 0) + parsed.sl;
                  }
              }
          }
      } catch(e) {} 

      for (let i = 1; i < configValues.length; i++) {
        let dotName = configValues[i][idxTenDot];
        if (dotName && dotName.trim() !== "") {
            options.push({ name: dotName, limit: parseNumber(configValues[i][idxGioiHan]), booked: bookedMapCount[dotName] || 0, held: heldMap[dotName] || 0 });
        }
      }
      return new Response(JSON.stringify({ fixedCost, slKhuyenMai, schemeKhuyenMai, options }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/hold' && request.method === 'POST') {
        const { dot, sl, phone } = await request.json();
        
        const configValuesStr = await env.TRIP_KV.get('CACHE_CONFIG');
        const configValues = configValuesStr ? JSON.parse(configValuesStr) : [];
        let fixedCost = 0, schemeVal = 0, slKhuyenMai = 999;
        if (configValues.length > 0) {
            const configHeaders = configValues[0].map(h => h ? h.toString().trim() : "");
            const parseNum = (val) => val ? parseInt(String(val).replace(/[^\d]/g, '')) || 0 : 0;
            const row2 = configValues[1] || [];
            fixedCost = parseNum(row2[configHeaders.indexOf('Vé 1 người')]);
            slKhuyenMai = parseNum(row2[configHeaders.indexOf('SL khuyến mãi')]) || 999;
            schemeVal = parseNum(row2[configHeaders.indexOf('Scheme khuyến mãi')]);
        }

        let cleanPhone = (phone || "").trim().replace(/^0+/, '');
        const dataValuesStr = await env.TRIP_KV.get('CACHE_DATA');
        const dataRows = dataValuesStr ? JSON.parse(dataValuesStr) : [];
        let nCount = 0;
        for(let i=1; i<dataRows.length; i++) {
            let rowPhone = (dataRows[i][4] || "").replace(/^0+/, '').replace(/'/g, '');
            let rowDot = dataRows[i][6];
            if(rowPhone === cleanPhone && rowDot === dot) {
                nCount += 1;
            }
        }

        let m = parseInt(sl);
        let finalCost = 0;
        let originalCost = m * fixedCost;
        let isDiscountCross = false;
        let discountValue = 0;

        if (nCount < slKhuyenMai && (nCount + m) >= slKhuyenMai) {
            finalCost = (m * fixedCost) - ((nCount + m) * schemeVal);
            isDiscountCross = true;
            discountValue = (nCount + m) * schemeVal;
        } else if (nCount >= slKhuyenMai) {
            finalCost = m * (fixedCost - schemeVal);
            isDiscountCross = true;
            discountValue = m * schemeVal;
        } else {
            finalCost = m * fixedCost;
        }

        const holdId = "HOLD-" + Date.now();
        await env.TRIP_KV.put(holdId, JSON.stringify({ dot, sl: m }), { expirationTtl: 900 });
        
        return new Response(JSON.stringify({ 
            success: true, holdId, 
            finalCost, originalCost, isDiscountCross, discountValue 
        }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/submit' && request.method === 'POST') {
      const body = await request.json();
      const timestamp = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      const bookingId = "BK-" + Math.floor(100000 + Math.random() * 900000);
      
      const dataRows = [];
      body.ds_nguoi.forEach(nguoi => {
          dataRows.push([timestamp, 1, nguoi.name, nguoi.yob, `'${body.phone}`, `'${body.phone_backup}`, body.dot_tham_gia, "TRUE", body.bill_url, bookingId]);
      });
      
      const token = await getGoogleAuthToken(env.GCP_EMAIL, env.GCP_KEY);
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Data!A:J:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: dataRows }) });

      const currentDataStr = await env.TRIP_KV.get('CACHE_DATA');
      if (currentDataStr) {
          let currentData = JSON.parse(currentDataStr);
          let dataRowsNoQuote = dataRows.map(row => {
              let newRow = [...row];
              newRow[4] = newRow[4].replace(/'/g, ''); 
              newRow[5] = newRow[5].replace(/'/g, ''); 
              return newRow;
          });
          currentData.push(...dataRowsNoQuote); 
          await env.TRIP_KV.put('CACHE_DATA', JSON.stringify(currentData));
      }

      if (body.holdId) { await env.TRIP_KV.delete(body.holdId); }
      return new Response(JSON.stringify({ success: true, bookingId }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/lookup' && request.method === 'POST') {
      const { phone } = await request.json();
      const cleanPhone = phone.trim().replace(/^0+/, '');

      const dataValuesStr = await env.TRIP_KV.get('CACHE_DATA');
      const rows = dataValuesStr ? JSON.parse(dataValuesStr) : [];
      
      let matched = [];
      for(let i = 1; i < rows.length; i++) {
          let rowPhone = (rows[i][4] || "").replace(/^0+/, '').replace(/'/g, '');
          if(rowPhone === cleanPhone) { matched.push(rows[i]); }
      }
      if(matched.length === 0) return new Response(JSON.stringify({ success: false, message: "Hệ thống chưa tìm thấy thông tin đăng ký của SĐT này." }), { headers: { 'Content-Type': 'application/json' } });

      let rawName = matched[0][2] || "Anh/Chị";
      let firstName = rawName.split('-')[0].trim().split(' ').pop(); 

      const configValuesStr = await env.TRIP_KV.get('CACHE_CONFIG');
      const dataConfigValues = configValuesStr ? JSON.parse(configValuesStr) : [];
      let fixedCost = 0, schemeVal = 0, slKhuyenMai = 999;
      if (dataConfigValues.length > 0) {
          const configHeaders = dataConfigValues[0].map(h => h ? h.toString().trim() : "");
          const parseNum = (val) => val ? parseInt(String(val).replace(/[^\d]/g, '')) || 0 : 0;
          const row2 = dataConfigValues[1] || [];
          fixedCost = parseNum(row2[configHeaders.indexOf('Vé 1 người')]);
          slKhuyenMai = parseNum(row2[configHeaders.indexOf('SL khuyến mãi')]) || 999;
          schemeVal = parseNum(row2[configHeaders.indexOf('Scheme khuyến mãi')]);
      }

      const shortValuesStr = await env.TRIP_KV.get('CACHE_SHORTLIST');
      const shortDataValues = shortValuesStr ? JSON.parse(shortValuesStr) : [];
      let shortMap = {};
      for(let i = 1; i < shortDataValues.length; i++) {
          shortMap[shortDataValues[i][0]] = (shortDataValues[i][3] === "TRUE");
      }

      let paidMapByDot = {};
      let pendMapByDot = {};

      matched.forEach(r => {
          let bId = r[9];
          let dot = r[6];
          let isChecked = shortMap[bId] || false;
          
          let targetMap = isChecked ? paidMapByDot : pendMapByDot;
          
          if(!targetMap[dot]) {
              targetMap[dot] = { dotName: dot, sl: 0, ds_nguoi: [], bIds: new Set() };
          }
          targetMap[dot].sl += 1;
          targetMap[dot].ds_nguoi.push({name: r[2], yob: r[3]});
          targetMap[dot].bIds.add(bId);
      });

      const calculateDotMoney = (dotData) => {
          if (dotData.sl >= slKhuyenMai) {
              return (fixedCost - schemeVal) * dotData.sl;
          } else {
              return fixedCost * dotData.sl;
          }
      };

      let paidGrp = { dotsGroup: [], totalMoney: 0, phoneDisplay: matched[0][4] };
      Object.values(paidMapByDot).forEach(d => {
          d.bIds = Array.from(d.bIds);
          let money = calculateDotMoney(d);
          paidGrp.totalMoney += money;
          paidGrp.dotsGroup.push(d);
      });

      let pendGrp = { dotsGroup: [], totalMoney: 0, phoneDisplay: matched[0][4] };
      Object.values(pendMapByDot).forEach(d => {
          d.bIds = Array.from(d.bIds);
          let money = calculateDotMoney(d);
          pendGrp.totalMoney += money;
          pendGrp.dotsGroup.push(d);
      });

      let zaloLinks = [];
      if (paidGrp.dotsGroup.length > 0 && dataConfigValues.length > 0) {
          const configHeaders = dataConfigValues[0].map(h => h ? h.toString().trim() : "");
          const idxTenDot = configHeaders.indexOf('Nội dung option');
          const idxZalo = configHeaders.indexOf('Link Zalo');
          
          if(idxTenDot !== -1 && idxZalo !== -1) {
              paidGrp.dotsGroup.forEach(d => {
                  for(let r=1; r<dataConfigValues.length; r++) {
                      if(dataConfigValues[r][idxTenDot] === d.dotName && dataConfigValues[r][idxZalo]) {
                          zaloLinks.push(dataConfigValues[r][idxZalo]);
                          break;
                      }
                  }
              });
          }
      }

      return new Response(JSON.stringify({
          success: true, firstName, paid: paidGrp, pending: pendGrp, zaloLinks: [...new Set(zaloLinks)]
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response("Not Found", { status: 404 });
  } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }
}

async function getGoogleAuthToken(clientEmail, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: clientEmail, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now };
  const signatureInput = `${btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}.${btoa(JSON.stringify(claim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
  
  let base64Key = privateKey.replace(/\\n/g, '').replace(/\\r/g, '').replace(/-----.*?-----/g, '').replace(/[^A-Za-z0-9+/=]/g, '');     
  while (base64Key.length % 4 !== 0) { base64Key += '='; }

  const binaryDer = new Uint8Array(atob(base64Key).length);
  for (let i = 0; i < atob(base64Key).length; i++) binaryDer[i] = atob(base64Key).charCodeAt(i);
  const key = await crypto.subtle.importKey("pkcs8", binaryDer.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signatureInput));
  const jwt = `${signatureInput}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}` });
  const data = await res.json();
  return data.access_token;
}
