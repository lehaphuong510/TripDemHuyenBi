const SHEET_ID = '1Ae7zDMLKD3SSSJePBobjH8O8mUGkyp2bKXq-AyYBdJI';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    const token = await getGoogleAuthToken(env.GCP_EMAIL, env.GCP_KEY);

    if (url.pathname === '/api/config' && request.method === 'GET') {
      const resConfig = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Config!A:Z?majorDimension=ROWS`, { headers: { Authorization: `Bearer ${token}` } });
      const dataConfig = await resConfig.json();
      if(!dataConfig.values || dataConfig.values.length === 0) throw new Error("Chưa nhận được dữ liệu từ tab Config. Vui lòng kiểm tra lại cấu trúc Google Sheet.");
      
      const headers = dataConfig.values[0].map(h => h ? h.toString().trim() : "");
      
      const idxTenDot = headers.indexOf('Nội dung option');
      const idxGioiHan = headers.indexOf('SL giới hạn');
      const idxCost = headers.indexOf('Vé 1 người');
      const idxSLKM = headers.indexOf('SL khuyến mãi');
      const idxSchemeKM = headers.indexOf('Scheme khuyến mãi');
      
      if(idxTenDot === -1 || idxGioiHan === -1) throw new Error("Không tìm thấy cột 'Nội dung option' hoặc 'SL giới hạn'. Hãy kiểm tra chính tả dòng 1 tab Config.");

      const parseNumber = (val) => {
          if (!val) return 0;
          return parseInt(String(val).replace(/[^\d]/g, '')) || 0;
      };

      const row2 = dataConfig.values[1] || [];
      const fixedCost = parseNumber(row2[idxCost]);
      const slKhuyenMai = parseNumber(row2[idxSLKM]);
      const schemeKhuyenMai = parseNumber(row2[idxSchemeKM]);
      
      let options = [];

      const resData = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Data!A:G?majorDimension=ROWS`, { headers: { Authorization: `Bearer ${token}` } });
      const rawData = await resData.json();
      const dataRows = rawData.values || [];
      let bookedMap = {};
      for(let i=1; i<dataRows.length; i++) {
          let sl = parseInt(dataRows[i][1]) || 0;
          let dot = dataRows[i][6];
          if(dot) { bookedMap[dot] = (bookedMap[dot] || 0) + sl; }
      }

      let heldMap = {};
      try {
          const listed = await env.TRIP_KV.list();
          for (const key of listed.keys) {
              const val = await env.TRIP_KV.get(key.name);
              if (val) {
                  const parsed = JSON.parse(val);
                  heldMap[parsed.dot] = (heldMap[parsed.dot] || 0) + parsed.sl;
              }
          }
      } catch(e) {} 

      for (let i = 1; i < dataConfig.values.length; i++) {
        let dotName = dataConfig.values[i][idxTenDot];
        if (dotName && dotName.trim() !== "") {
            options.push({ name: dotName, limit: parseNumber(dataConfig.values[i][idxGioiHan]), booked: bookedMap[dotName] || 0, held: heldMap[dotName] || 0 });
        }
      }
      return new Response(JSON.stringify({ fixedCost, slKhuyenMai, schemeKhuyenMai, options }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/hold' && request.method === 'POST') {
        const { dot, sl } = await request.json();
        const holdId = "HOLD-" + Date.now();
        await env.TRIP_KV.put(holdId, JSON.stringify({ dot, sl }), { expirationTtl: 900 });
        return new Response(JSON.stringify({ success: true, holdId }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/submit' && request.method === 'POST') {
      const body = await request.json();
      const timestamp = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      const bookingId = "BK-" + Math.floor(100000 + Math.random() * 900000);
      
      const dataRows = [];
      body.ds_nguoi.forEach(nguoi => {
          dataRows.push([timestamp, body.sl, nguoi.name, nguoi.yob, `'${body.phone}`, `'${body.phone_backup}`, body.dot_tham_gia, "TRUE", body.bill_url, bookingId]);
      });
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Data!A:J:append?valueInputOption=USER_ENTERED`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: dataRows }) });

      const shortlistRow = [[bookingId, body.sl, body.totalMoney, "FALSE"]];
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Shortlist!A4:D:append?valueInputOption=USER_ENTERED`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: shortlistRow }) });

      if (body.holdId) { await env.TRIP_KV.delete(body.holdId); }
      return new Response(JSON.stringify({ success: true, bookingId }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/lookup' && request.method === 'POST') {
      const { phone } = await request.json();
      const cleanPhone = phone.trim().replace(/^0+/, '');

      const resData = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Data!A:J?majorDimension=ROWS`, { headers: { Authorization: `Bearer ${token}` } });
      const sheetData = await resData.json();
      const rows = sheetData.values || [];
      
      let matched = [];
      for(let i = 1; i < rows.length; i++) {
          let rowPhone = (rows[i][4] || "").replace(/^0+/, '').replace(/'/g, '');
          if(rowPhone === cleanPhone) { matched.push(rows[i]); }
      }
      if(matched.length === 0) return new Response(JSON.stringify({ success: false, message: "Hệ thống chưa tìm thấy thông tin đăng ký của SĐT này." }), { headers: { 'Content-Type': 'application/json' } });

      let bookingId = matched[0][9];
      const resShort = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Shortlist!A4:D?majorDimension=ROWS`, { headers: { Authorization: `Bearer ${token}` } });
      const shortData = await resShort.json();
      let isChecked = false;
      for(let i = 1; i < (shortData.values || []).length; i++) {
          if(shortData.values[i][0] === bookingId && shortData.values[i][3] === "TRUE") { isChecked = true; break; }
      }

      let rawName = matched[0][2] || "Anh/Chị";
      let firstName = rawName.split('-')[0].trim().split(' ').pop(); 
      let ds_nguoi = matched.map(r => ({ name: r[2], yob: r[3] }));

      return new Response(JSON.stringify({
          success: true, bookingId, firstName, dot: matched[0][6], sl: matched[0][1], phoneDisplay: matched[0][4], isChecked, ds_nguoi
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
  
  // FIX ATOB TRIỆT ĐỂ BẰNG WHITELIST VÀ PADDING
  let base64Key = privateKey;
  // Xóa thủ công ký tự newline ẩn (\n) có thể copy dính từ Cloudflare dashboard
  base64Key = base64Key.replace(/\\n/g, ''); 
  base64Key = base64Key.replace(/\\r/g, ''); 
  // Loại bỏ các tag BEGIN/END
  base64Key = base64Key.replace(/-----.*?-----/g, ''); 
  // Lọc chỉ giữ lại ký tự base64 hợp lệ
  base64Key = base64Key.replace(/[^A-Za-z0-9+/=]/g, '');     
  
  // Padding bắt buộc cho Base64 (chuẩn độ dài % 4 == 0)
  while (base64Key.length % 4 !== 0) {
      base64Key += '=';                                      
  }

  const binaryDer = new Uint8Array(atob(base64Key).length);
  for (let i = 0; i < atob(base64Key).length; i++) binaryDer[i] = atob(base64Key).charCodeAt(i);
  const key = await crypto.subtle.importKey("pkcs8", binaryDer.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signatureInput));
  const jwt = `${signatureInput}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}` });
  const data = await res.json();
  return data.access_token;
}
