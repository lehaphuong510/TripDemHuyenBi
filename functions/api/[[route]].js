// File: functions/api/[[route]].js

const SHEET_ID = '1Ae7zDMLKD3SSSJePBobjH8O8mUGkyp2bKXq-AyYBdJI';

export async function onRequest(context) {
  // context chứa request (dữ liệu gửi lên) và env (biến môi trường bảo mật)
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    // 1. LẤY TOKEN TỪ GOOGLE (Sử dụng biến môi trường GCP_EMAIL và GCP_KEY)
    const token = await getGoogleAuthToken(env.GCP_EMAIL, env.GCP_KEY);

    // 2. ROUTE: LẤY CONFIG (Đợt đăng ký & Số suất)
    if (url.pathname === '/api/config' && request.method === 'GET') {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Config!A:D?majorDimension=ROWS`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    }

    // 3. ROUTE: GHI DỮ LIỆU ĐĂNG KÝ
    if (url.pathname === '/api/submit' && request.method === 'POST') {
      const body = await request.json();
      
      const timestamp = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      const bookingId = "BK-" + Math.floor(100000 + Math.random() * 900000);
      
      const rows = [];
      body.ds_nguoi.forEach(nguoi => {
          rows.push([
              timestamp,                 // Dấu thời gian
              body.sl,                   // SL
              nguoi.name,                // Họ tên
              nguoi.yob,                 // Năm sinh
              `'${body.phone}`,          // Số điện thoại (thêm ' để không bị mất số 0)
              `'${body.phone_backup}`,   // Số điện thoại dự phòng
              body.dot_tham_gia,         // Đợt tham gia
              body.mien_tru ? "TRUE" : "FALSE", // Miễn trừ trách nhiệm
              body.bill_url,             // Trạng thái Bill (Chứa link ImgBB)
              bookingId,                 // Booking ID
              "FALSE"                    // Check nhận tiền (Mặc định chưa check)
          ]);
      });

      const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Data!A:K:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: rows })
      });

      return new Response(JSON.stringify({ success: true, bookingId: bookingId }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 4. ROUTE: TRA CỨU ĐƠN
    if (url.pathname === '/api/lookup' && request.method === 'POST') {
      const { phone } = await request.json();
      const cleanPhone = phone.trim().replace(/^0+/, ''); // Bỏ số 0 ở đầu

      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Data!A:K?majorDimension=ROWS`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const sheetData = await res.json();
      const rows = sheetData.values || [];
      
      let matched = [];
      for(let i = 1; i < rows.length; i++) {
          let rowPhone = (rows[i][4] || "").replace(/^0+/, '').replace(/'/g, '');
          if(rowPhone === cleanPhone) {
              matched.push(rows[i]);
          }
      }

      if(matched.length === 0) {
          return new Response(JSON.stringify({ success: false, message: "Không tìm thấy SĐT" }), { headers: { 'Content-Type': 'application/json' } });
      }

      let firstName = matched[0][2].split('-')[0].split(' ').pop(); 
      let isChecked = matched[matched.length - 1][10] === "TRUE"; 
      let ds_nguoi = matched.map(r => ({ name: r[2], yob: r[3] }));

      return new Response(JSON.stringify({
          success: true,
          firstName: firstName,
          dot: matched[0][6],
          sl: matched[0][1],
          phoneDisplay: matched[0][4],
          isChecked: isChecked,
          ds_nguoi: ds_nguoi
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response("Not Found", { status: 404 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// Hàm mã hóa bảo mật để Google Sheets cho phép đọc/ghi
async function getGoogleAuthToken(clientEmail, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const strHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const strClaim = btoa(JSON.stringify(claim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = `${strHeader}.${strClaim}`;

  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKey.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signatureInput));
  const strSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${signatureInput}.${strSignature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  const data = await res.json();
  return data.access_token;
}
