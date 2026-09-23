const SHEET_ID = '1Ae7zDMLKD3SSSJePBobjH8O8mUGkyp2bKXq-AyYBdJI';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    const token = await getGoogleAuthToken(env.GCP_EMAIL, env.GCP_KEY);

    // 1. API CONFIG: Quét tab Config + Tab Data (để lấy đã book) + KV (để lấy đang hold)
    if (url.pathname === '/api/config' && request.method === 'GET') {
      // Đọc Config
      const resConfig = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Config!A:Z?majorDimension=ROWS`, { headers: { Authorization: `Bearer ${token}` } });
      const dataConfig = await resConfig.json();
      const headers = dataConfig.values[0];
      const idxTenDot = headers.indexOf('Nội dung option');
      const idxGioiHan = headers.indexOf('SL giới hạn');
      const idxCost = headers.indexOf('Vé 1 người');
      
      const fixedCost = dataConfig.values[1][idxCost];
      let options = [];

      // Đọc Data để gom SL đã book
      const resData = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Data!A:G?majorDimension=ROWS`, { headers: { Authorization: `Bearer ${token}` } });
      const rawData = await resData.json();
      const dataRows = rawData.values || [];
      let bookedMap = {};
      for(let i=1; i<dataRows.length; i++) {
          let sl = parseInt(dataRows[i][1]) || 0;
          let dot = dataRows[i][6];
          if(dot) { bookedMap[dot] = (bookedMap[dot] || 0) + sl; }
      }

      // Đọc KV để đếm SL đang hold
      let heldMap = {};
      const listed = await env.TRIP_KV.list();
      for (const key of listed.keys) {
          const val = await env.TRIP_KV.get(key.name);
          if (val) {
              const parsed = JSON.parse(val);
              heldMap[parsed.dot] = (heldMap[parsed.dot] || 0) + parsed.sl;
          }
      }

      for (let i = 1; i < dataConfig.values.length; i++) {
        let dotName = dataConfig.values[i][idxTenDot];
        if (dotName && dotName.trim() !== "") {
            options.push({
                name: dotName,
                limit: parseInt(dataConfig.values[i][idxGioiHan]) || 0,
                booked: bookedMap[dotName] || 0,
                held: heldMap[dotName] || 0
            });
        }
      }

      return new Response(JSON.stringify({ fixedCost, options }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 2. API HOLD SLOT (Ghi vào KV 15 phút)
    if (url.pathname === '/api/hold' && request.method === 'POST') {
        const { dot, sl } = await request.json();
        const holdId = "HOLD-" + Date.now();
        // Ghi vào KV, TTL = 900 giây (15 phút)
        await env.TRIP_KV.put(holdId, JSON.stringify({ dot, sl }), { expirationTtl: 900 });
        return new Response(JSON.stringify({ success: true, holdId }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 3. API SUBMIT FINAL (Ghi vào Google Sheets & Xóa Hold KV)
    if (url.pathname === '/api/submit' && request.method === 'POST') {
      const body = await request.json();
      const timestamp = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      const bookingId = "BK-" + Math.floor(100000 + Math.random() * 900000);
      const mienTru = "TRUE";
      
      // Chuẩn bị Data
      const dataRows = [];
      body.ds_nguoi.forEach(nguoi => {
          dataRows.push([timestamp, body.sl, nguoi.name, nguoi.yob, `'${body.phone}`, `'${body.phone_backup}`, body.dot_tham_gia, mienTru, body.bill_url, bookingId]);
      });

      // Ghi Tab Data
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Data!A:J:append?valueInputOption=USER_ENTERED`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: dataRows })
      });

      // Ghi Tab Shortlist (Cột A: ID, B: SL, C: Tiền, D: FALSE)
      const totalMoney = body.sl * body.cost;
      const shortlistRow = [[bookingId, body.sl, totalMoney, "FALSE"]];
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Shortlist!A4:D:append?valueInputOption=USER_ENTERED`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: shortlistRow })
      });

      // Xóa Hold khỏi KV vì đã thanh toán
      if (body.holdId) { await env.TRIP_KV.delete(body.holdId); }

      return new Response(JSON.stringify({ success: true, bookingId }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 4. API LOOKUP (Tra cứu)
    if (url.pathname === '/api/lookup' && request.method === 'POST') {
      const { phone } = await request.json();
      const cleanPhone = phone.trim().replace(/^0+/, '');

      // Đọc Data lấy chi tiết
      const resData = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Data!A:J?majorDimension=ROWS`, { headers: { Authorization: `Bearer ${token}` } });
      const sheetData = await resData.json();
      const rows = sheetData.values || [];
      
      let matched = [];
      for(let i = 1; i < rows.length; i++) {
          let rowPhone = (rows[i][4] || "").replace(/^0+/, '').replace(/'/g, '');
          if(rowPhone === cleanPhone) { matched.push(rows[i]); }
      }
      if(matched.length === 0) return new Response(JSON.stringify({ success: false, message: "Không tìm thấy SĐT" }), { headers: { 'Content-Type': 'application/json' } });

      let bookingId = matched[0][9]; // Cột J

      // Đọc Shortlist lấy trạng thái Check
      const resShort = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Shortlist!A:D?majorDimension=ROWS`, { headers: { Authorization: `Bearer ${token}` } });
      const shortData = await resShort.json();
      let isChecked = false;
      for(let r of (shortData.values || [])) {
          if(r[0] === bookingId && r[3] === "TRUE") { isChecked = true; break; }
      }

      let firstName = matched[0][2].split('-')[0].split(' ').pop(); 
      let ds_nguoi = matched.map(r => ({ name: r[2], yob: r[3] }));

      return new Response(JSON.stringify({
          success: true, bookingId: bookingId, firstName: firstName, dot: matched[0][6], sl: matched[0][1], phoneDisplay: matched[0][4], isChecked: isChecked, ds_nguoi: ds_nguoi
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response("Not Found", { status: 404 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// Hàm mã hóa JWT Google API (Giữ nguyên)
async function getGoogleAuthToken(clientEmail, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: clientEmail, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now };
  const strHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const strClaim = btoa(JSON.stringify(claim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = `${strHeader}.${strClaim}`;
  const pemContents = privateKey.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, "");
  const binaryDer = new Uint8Array(atob(pemContents).length);
  for (let i = 0; i < atob(pemContents).length; i++) binaryDer[i] = atob(pemContents).charCodeAt(i);
  const key = await crypto.subtle.importKey("pkcs8", binaryDer.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signatureInput));
  const jwt = `${signatureInput}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}` });
  const data = await res.json();
  return data.access_token;
}
