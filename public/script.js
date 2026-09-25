const IMGBB_API_KEY = '49ec155703a3d740e971a0c5bb680517';
let configData = {};
let currentHoldId = null;
let timerInterval = null;

// ================= ADMIN VARIABLES =================
let adminToken = "";
let adminFullData = { config: [], data: [], shortlist: [] };
let dropdownCostSelections = [];

// ================= TAB SYSTEM (GUEST) =================
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.main-nav button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    let btnMap = { 'tab-gioithieu': 0, 'tab-lichtrinh': 1, 'tab-dangky': 2, 'tab-tracuu': 3 };
    document.querySelectorAll('.main-nav button')[btnMap[tabId]].classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadYoutube() {
    const container = document.getElementById('yt-container');
    container.innerHTML = `<iframe width="100%" height="315" src="https://www.youtube.com/embed/AqoJWlIdqng?autoplay=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="border-radius: 12px;"></iframe>`;
}

// ================= CORE BOOKING LOGIC =================
async function loadSlots(isInit = false) {
    const container = document.getElementById('slot-container');
    if(isInit) { container.innerHTML = '<div style="text-align:center; width:100%; font-size: 1.2rem;">Đang tải dữ liệu đợt tham gia... ⏳</div>'; }
    try {
        const res = await fetch('/api/config');
        configData = await res.json();
        if (configData.error) throw new Error(configData.error);
        if(isInit) {
            const costVal = Number(configData.fixedCost) || 0;
            const schemeVal = Number(configData.schemeKhuyenMai) || 0;
            const discountVal = costVal - schemeVal;
            document.getElementById('display-cost').innerText = costVal.toLocaleString('vi-VN');
            document.getElementById('display-slkm').innerText = configData.slKhuyenMai || 0;
            document.getElementById('display-discount').innerText = discountVal.toLocaleString('vi-VN');
        }
        container.innerHTML = '';
        const currentSelected = document.getElementById('selectedDot').value;
        if (configData.options && configData.options.length > 0) {
            configData.options.forEach(opt => {
                const total = parseInt(opt.limit) || 0;
                const booked = parseInt(opt.booked) || 0;
                const held = parseInt(opt.held) || 0;
                const available = Math.max(0, total - booked - held);
                const card = document.createElement('div');
                card.className = 'slot-card';
                if(currentSelected === opt.name) { card.classList.add('selected'); document.getElementById('selectedDotMax').value = available; }
                card.onclick = () => selectSlot(card, opt.name, available);
                card.innerHTML = `
                    <h3>${opt.name}</h3>
                    <div class="slot-available">Còn ${available} suất</div>
                    <div class="slot-breakdown">
                        <span style="display:flex; align-items:center; gap:5px; color:#a5d6a7;"><img src="assets/images/tick.png" style="width:16px;"> Đã ĐK: ${booked}</span>
                        <span style="display:flex; align-items:center; gap:5px; color:#ffcc80;"><img src="assets/images/donghocat.png" style="width:16px;"> Đang GD: ${held}</span>
                    </div>
                `;
                container.appendChild(card);
            });
        } else { container.innerHTML = '<div style="color:var(--glow-yellow); text-align:center; width:100%; font-size:1.2rem;">Hiện chưa có đợt đăng ký nào.</div>'; }
    } catch (err) { container.innerHTML = `<div style="color:#FFCDD2; text-align:center; width:100%; background:rgba(211,47,47,0.8); padding:15px; border-radius:8px;"><b>Lỗi tải dữ liệu.</b><br>Chi tiết: ${err.message}</div>`; }
}

document.addEventListener("DOMContentLoaded", async () => { await loadSlots(true); });

function selectSlot(cardEl, dotName, available) {
    if (available <= 0) { alert("Rất tiếc, đợt này đã hết suất hoặc đang được giữ!"); return; }
    document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
    document.getElementById('selectedDot').value = dotName;
    document.getElementById('selectedDotMax').value = available;
    const numInput = document.getElementById('numPeople');
    numInput.max = available;
    if (parseInt(numInput.value) > available) numInput.value = available;
    if(document.getElementById('agreeCheckbox').checked) renderParticipants();
}

function toggleForm() {
    const isAgreed = document.getElementById('agreeCheckbox').checked;
    const dot = document.getElementById('selectedDot').value;
    if (isAgreed && !dot) { alert("Vui lòng chọn đợt tham gia ở phía trên trước!"); document.getElementById('agreeCheckbox').checked = false; return; }
    document.getElementById('registrationForm').style.display = isAgreed ? 'block' : 'none';
    if (isAgreed) renderParticipants();
}

function renderParticipants() {
    const max = parseInt(document.getElementById('selectedDotMax').value) || 1;
    let num = parseInt(document.getElementById('numPeople').value) || 1;
    if (num > max) { num = max; document.getElementById('numPeople').value = max; alert(`Chỉ còn ${max} suất cho đợt này!`); }
    const container = document.getElementById('participantsList');
    container.innerHTML = ''; 
    for(let i = 1; i <= num; i++) {
        container.innerHTML += `
            <div style="background: rgba(0,0,0,0.25); padding: 15px; border-radius: 8px; margin-bottom:12px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="font-weight:bold; color:var(--glow-yellow); margin-bottom:8px; font-size:1.1rem; display:flex; align-items:center; gap:8px;"><img src="assets/images/age.png" style="width:20px;"> Người thứ ${i}</div>
                <div style="display:flex; gap:10px; flex-wrap: wrap;">
                    <input type="text" id="name_${i}" placeholder="Họ và tên" style="flex:2; min-width:150px;">
                    <input type="number" id="yob_${i}" placeholder="Năm sinh" style="flex:1; min-width:100px;">
                </div>
            </div>`;
    }
}

async function holdSlotAndPay() {
    const dot = document.getElementById('selectedDot').value;
    const phone = document.getElementById('phoneInput').value;
    const num = parseInt(document.getElementById('numPeople').value);
    const maxAllowedYear = new Date().getFullYear() - 5;
    
    if (!phone) { alert("Vui lòng nhập SĐT liên hệ!"); return; }
    for(let i = 1; i <= num; i++) {
        let nameVal = document.getElementById(`name_${i}`).value.trim();
        let yobVal = document.getElementById(`yob_${i}`).value.trim();
        if (!nameVal || !yobVal) { alert(`Vui lòng nhập đầy đủ Tên và Năm sinh cho người thứ ${i}!`); return; }
        if (parseInt(yobVal) > maxAllowedYear) { alert(`Người thứ ${i} chưa đủ 5 tuổi (Năm sinh phải từ ${maxAllowedYear} trở về trước).`); return; }
    }

    const btn = document.getElementById('btnHold');
    btn.innerHTML = "ĐANG TÍNH TOÁN... ⏳"; btn.disabled = true;

    try {
        const res = await fetch('/api/hold', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dot, sl: num, phone }) });
        const data = await res.json();
        if(data.success) {
            currentHoldId = data.holdId;
            document.getElementById('registrationForm').style.display = 'none';
            document.getElementById('paymentBox').style.display = 'block';
            
            let payContainer = document.getElementById('payTotalAmount');
            if(data.isDiscountCross) {
                payContainer.innerHTML = `
                    <div style="display: flex; flex-direction: column; width: 100%;">
                        <div style="font-size: 1.1rem; color: #333;">Số tiền: <span style="color: #888; text-decoration: line-through;">${data.originalCost.toLocaleString('vi-VN')} VNĐ</span></div>
                        <div style="font-size: 0.95rem; color: #ff9800; font-weight: normal; margin: 5px 0;">*A/C được giảm thêm do đã đăng ký từ ${configData.slKhuyenMai} suất cho Đợt này: -${data.discountValue.toLocaleString('vi-VN')} VNĐ</div>
                        <div style="font-size: 1.1rem; color: #333; margin-top: 5px;">Số tiền CK thực tế: <span style="color: #D32F2F; font-size: 1.4rem; font-weight: 900;">${data.finalCost.toLocaleString('vi-VN')} VNĐ</span></div>
                    </div>`;
                payContainer.style.display = "block";
            } else {
                payContainer.innerHTML = `<span style="color: #D32F2F; font-size: 1.4rem; font-weight: 900;">${data.finalCost.toLocaleString('vi-VN')} VNĐ</span>`;
                payContainer.style.display = "inline-flex";
            }
            let cleanName = document.getElementById('name_1').value.split('-')[0].trim().split(' ').pop().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toUpperCase();
            document.getElementById('paySyntax').innerText = `Tripdem ${cleanName} ${phone}`;
            startCountdown(15 * 60);
            await loadSlots();
        } else {
            alert(data.message || "Lỗi giữ chỗ!"); btn.innerHTML = "TIẾP TỤC THANH TOÁN 🚀"; btn.disabled = false;
        }
    } catch(err) { alert("Lỗi mạng!"); btn.innerHTML = "TIẾP TỤC THANH TOÁN 🚀"; btn.disabled = false; }
}

function startCountdown(duration) {
    let timer = duration, m, s;
    timerInterval = setInterval(() => {
        m = parseInt(timer / 60, 10); s = parseInt(timer % 60, 10);
        document.getElementById('countdownTimer').textContent = (m < 10 ? "0"+m : m) + ":" + (s < 10 ? "0"+s : s);
        if (--timer < 0) { clearInterval(timerInterval); alert("Hết thời gian thanh toán 😥"); window.location.reload(); }
    }, 1000);
}

async function submitFinalRegistration() {
    const fileInput = document.getElementById('billUpload');
    if (fileInput.files.length === 0) { alert("Vui lòng tải ảnh Bill!"); return; }
    const btnSubmit = document.getElementById('btnSubmitFinal');
    btnSubmit.disabled = true; btnSubmit.innerHTML = "ĐANG TẢI ẢNH LÊN... ⏳";
    try {
        const formData = new FormData(); formData.append('image', fileInput.files[0]);
        const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const imgbbData = await imgbbRes.json();
        if (imgbbData.success) {
            btnSubmit.innerHTML = "ĐANG LƯU DỮ LIỆU... 🚀";
            const num = parseInt(document.getElementById('numPeople').value);
            let ds_nguoi = [];
            for(let i=1; i<=num; i++) ds_nguoi.push({ name: document.getElementById(`name_${i}`).value, yob: document.getElementById(`yob_${i}`).value });
            const payload = {
                dot_tham_gia: document.getElementById('selectedDot').value, sl: num, ds_nguoi,
                phone: document.getElementById('phoneInput').value, phone_backup: document.getElementById('phoneBackup').value,
                bill_url: imgbbData.data.url, holdId: currentHoldId
            };
            const submitRes = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const submitData = await submitRes.json();
            if (submitData.success) {
                clearInterval(timerInterval);
                document.getElementById('paymentBox').style.display = 'none';
                document.getElementById('submitSuccessBox').style.display = 'block';
                document.getElementById('successBookingId').innerText = submitData.bookingId;
                document.getElementById('submitSuccessBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
                createButterflies(); await loadSlots();
            }
        } else { alert("Lỗi tải ảnh!"); btnSubmit.innerHTML = "XÁC NHẬN ĐÃ CHUYỂN KHOẢN"; btnSubmit.disabled = false; }
    } catch (err) { alert("Lỗi mạng!"); btnSubmit.innerHTML = "XÁC NHẬN ĐÃ CHUYỂN KHOẢN"; btnSubmit.disabled = false; }
}

function resetRegistrationForm() {
    document.getElementById('submitSuccessBox').style.display = 'none'; document.getElementById('registrationForm').style.display = 'none'; document.getElementById('agreeCheckbox').checked = false;
    document.getElementById('numPeople').value = 1; document.getElementById('phoneInput').value = ''; document.getElementById('phoneBackup').value = ''; document.getElementById('billUpload').value = ''; document.getElementById('participantsList').innerHTML = ''; document.getElementById('selectedDot').value = ''; document.getElementById('selectedDotMax').value = '';
    const btnHold = document.getElementById('btnHold'); btnHold.innerHTML = "TIẾP TỤC THANH TOÁN 🚀"; btnHold.disabled = false;
    const btnSubmit = document.getElementById('btnSubmitFinal'); btnSubmit.innerHTML = "XÁC NHẬN ĐÃ CHUYỂN KHOẢN"; btnSubmit.disabled = false;
    document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
    loadSlots(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= TRA CỨU =================
function renderLookupBlock(blockData, type) {
    let dotsHtml = "";
    blockData.dotsGroup.forEach((d, index) => {
        let dsHtml = `<table class="result-table"><tr><th style="text-align:left;">HỌ VÀ TÊN</th><th style="text-align:center;">NĂM SINH</th></tr>`;
        d.ds_nguoi.forEach(ng => { dsHtml += `<tr><td style="text-align:left;"><b style="color: var(--glow-yellow);">${ng.name}</b></td><td style="text-align:center; color: white;">${ng.yob}</td></tr>`; });
        dsHtml += `</table>`;
        dotsHtml += `
            <div style="margin-bottom: 5px;">
                <div style="margin-bottom:8px; color: white;">🔹 Đợt tham gia: <b style="color: var(--glow-yellow);">${d.dotName}</b></div>
                <div style="margin-bottom:8px; color: white;">&nbsp;&nbsp;&nbsp;&nbsp;Mã Booking: <b style="color: var(--glow-yellow);">${d.bIds.join(", ")}</b></div>
                <div style="margin-bottom:10px; color: white;">&nbsp;&nbsp;&nbsp;&nbsp;Số lượng: <b style="color: var(--glow-yellow);">${d.sl} người</b></div>
                ${dsHtml}
            </div>`;
        if (index < blockData.dotsGroup.length - 1) dotsHtml += `<hr style="border: 0; border-top: 1px dashed rgba(255,255,255,0.3); margin: 20px 0;">`;
    });

    if(type === 'paid') {
        return `
            <div class="glass-box" style="flex: 1; min-width: 280px; text-align:left; background:rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); padding: 0; overflow: hidden; margin-bottom: 0; display: flex; flex-direction: column;">
                <div style="background: rgba(25, 135, 84, 0.9); padding: 15px; text-align: center; border-bottom: 2px solid var(--glow-yellow);">
                    <h3 style="color: var(--glow-yellow); margin: 0; font-size: 1.4rem; text-transform: uppercase;"><img src="assets/images/tick.png" style="width:24px; vertical-align:middle; margin-right:5px;"> ĐÃ NHẬN THANH TOÁN</h3>
                    <div style="color: white; font-size: 1.1rem; margin-top: 5px;">Tổng số tiền đã nhận: <span style="color: var(--glow-yellow); font-weight: 900;">${blockData.totalMoney.toLocaleString('vi-VN')} VNĐ</span></div>
                </div>
                <div style="padding: 20px; flex: 1;">
                    <b style="color: var(--glow-yellow); font-size: 1.1rem; display:block; margin-bottom:15px; text-transform: uppercase;">THÔNG TIN ĐĂNG KÝ:</b>
                    <div style="margin-bottom:15px; color: white;">SĐT người đại diện: <b style="color: var(--glow-yellow);">${blockData.phoneDisplay}</b></div>
                    ${dotsHtml}
                </div>
            </div>`;
    } else {
        return `
            <div class="glass-box" style="flex: 1; min-width: 280px; text-align:left; background:rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); padding: 0; overflow: hidden; margin-bottom: 0; display: flex; flex-direction: column;">
                <div style="background: rgba(255, 193, 7, 0.8); padding: 15px; text-align: center; border-bottom: 2px solid #FFF;">
                    <h3 style="color: #091221; margin: 0; font-size: 1.4rem; text-transform: uppercase;"><img src="assets/images/donghocat.png" style="width:24px; vertical-align:middle; margin-right:5px; filter: brightness(0.1);"> ĐANG CHỜ ĐỐI SOÁT</h3>
                    <div style="color: #091221; font-size: 1.1rem; margin-top: 5px; font-weight: 600;">Số tiền đối soát: <span style="color: #D32F2F; font-weight: 900;">${blockData.totalMoney.toLocaleString('vi-VN')} VNĐ</span></div>
                </div>
                <div style="padding: 20px; flex: 1;">
                    <b style="color: var(--glow-yellow); font-size: 1.1rem; display:block; margin-bottom:15px; text-transform: uppercase;">THÔNG TIN ĐĂNG KÝ:</b>
                    <div style="margin-bottom:15px; color: white;">SĐT người đại diện: <b style="color: var(--glow-yellow);">${blockData.phoneDisplay}</b></div>
                    ${dotsHtml}
                </div>
            </div>`;
    }
}

async function lookupBooking() {
    const phone = document.getElementById('lookupPhone').value;
    const resultDiv = document.getElementById('lookupResult');
    if(!phone) { alert("Vui lòng nhập SĐT!"); return; }
    resultDiv.innerHTML = "<div class='glass-box' style='text-align:center;'><i>Đang tìm kiếm... ⏳</i></div>";
    try {
        const res = await fetch('/api/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
        const data = await res.json();
        if (!data.success) { resultDiv.innerHTML = `<div class="glass-box" style="color:var(--glow-yellow); border-color:#f44336; text-align:center;">${data.message}</div>`; return; }
        let blocksHtml = `<div style="display: flex; gap: 20px; flex-wrap: wrap; align-items: stretch; justify-content: center; width: 100%;">`;
        let zaloHtml = "";
        if (data.paid && data.paid.dotsGroup.length > 0) {
            blocksHtml += renderLookupBlock(data.paid, 'paid'); createFireflies(); 
            if (data.zaloLinks && data.zaloLinks.length > 0) {
                zaloHtml = `<div class="zalo-banner" style="width: 100%; box-sizing: border-box;">
                    <span style="color: var(--glow-yellow);">🚨 QUAN TRỌNG: ANH CHỊ NHỚ VÀO GROUP ZALO ĐỂ TIỆN THEO DÕI THÔNG BÁO NHA! 🚨</span><br>
                    <a href="${data.zaloLinks[0]}" target="_blank">👉 BẤM VÀO ĐÂY ĐỂ THAM GIA GROUP 👈</a>
                </div>`;
            }
        }
        if (data.pending && data.pending.dotsGroup.length > 0) blocksHtml += renderLookupBlock(data.pending, 'pending');
        blocksHtml += `</div>`; 
        resultDiv.innerHTML = `<div style="text-align:center; padding-bottom:15px; margin-bottom:15px;"><p style="font-size: 1.1rem; margin:0;">Hệ thống đã nhận được đăng ký của anh/chị <b style="color:var(--glow-yellow); text-transform:uppercase;">${data.firstName}</b>.</p></div>${blocksHtml}${zaloHtml}`;
    } catch (err) { resultDiv.innerHTML = `<div class="glass-box" style="color:red; text-align:center;">Lỗi kết nối máy chủ.</div>`; }
}

// ================= ANIMATIONS =================
function createButterflies() {
    for (let i = 0; i < 30; i++) {
        let b = document.createElement("img"); b.src = "assets/images/butterfly.png"; b.style.position = "fixed"; b.style.width = "30px"; b.style.zIndex = "9999"; b.style.pointerEvents = "none";
        b.style.left = "50vw"; b.style.top = "50vh"; b.style.transform = "translate(-50%, -50%) scale(0)"; b.style.transition = `all ${Math.random() * 2 + 2}s cubic-bezier(0.25, 1, 0.5, 1)`;
        document.body.appendChild(b);
        setTimeout(() => { b.style.transform = `translate(${(Math.random() * 200 - 100)}vw, ${(Math.random() * 200 - 100)}vh) scale(1.5) rotate(${Math.random() * 360}deg)`; b.style.opacity = "0"; }, 50);
        setTimeout(() => b.remove(), 5000);
    }
}
function createFireflies() {
    for (let i = 0; i < 30; i++) {
        let f = document.createElement("div"); f.className = "anim-firefly"; f.style.left = Math.random() * 100 + "vw"; f.style.top = Math.random() * 100 + "vh";
        f.style.setProperty('--dx', (Math.random() - 0.5) * 2); f.style.setProperty('--dy', Math.random() + 0.5); f.style.animationDuration = (Math.random() * 3 + 2) + "s";
        document.body.appendChild(f); setTimeout(() => f.remove(), 6000);
    }
}

// =======================================================================================
// ================================= ADMIN AREA LOGIC ====================================
// =======================================================================================

function showAdminOverlay() { document.getElementById('admin-overlay').style.display = 'block'; }
function hideAdminOverlay() { document.getElementById('admin-overlay').style.display = 'none'; }
function switchAdminTab(tabId) {
    document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.admin-nav button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    let btnMap = { 'admin-tab-1': 0, 'admin-tab-2': 1, 'admin-tab-3': 2 };
    document.querySelectorAll('.admin-nav button')[btnMap[tabId]].classList.add('active');
}

async function checkAdminPass() {
    const pass = document.getElementById('adminPass').value;
    if(pass !== "0519") { document.getElementById('admin-error').style.display = 'block'; return; }
    adminToken = "0519";
    document.getElementById('admin-error').style.display = 'none';
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
    await loadAdminData();
}

async function loadAdminData() {
    try {
        const res = await fetch('/api/admin/data', { headers: { 'Authorization': `Bearer ${adminToken}` }});
        if(!res.ok) throw new Error("Unauthorized");
        adminFullData = await res.json();
        populateAdminUI();
    } catch(err) { alert("Lỗi tải dữ liệu Admin!"); }
}

function parseMoneyAdmin(str) { return parseInt(String(str).replace(/[^\d]/g, '')) || 0; }

function processAdminData(dotFilter) {
    let rawData = adminFullData.data.slice(1); 
    let shortMap = {};
    adminFullData.shortlist.slice(1).forEach(r => { shortMap[r[0]] = (r[3] === "TRUE"); });

    let filtered = rawData;
    if (dotFilter !== "All") {
        filtered = rawData.filter(r => r[6] === dotFilter);
    }

    let stats = { pending: 0, paid: 0, revenue: 0, listPaid: [] };

    // Gom Map booking theo Đợt để tính doanh thu theo luật Lũy kế y hệt luồng khách
    let bookingMap = {};
    filtered.forEach(r => {
        let bId = r[9]; let dot = r[6];
        if(!bookingMap[bId]) bookingMap[bId] = { bId, dot, sl: 0, isPaid: shortMap[bId] || false, ds_nguoi: [] };
        bookingMap[bId].sl += 1;
        bookingMap[bId].ds_nguoi.push({name: r[2], yob: r[3]});
    });

    let configHeaders = adminFullData.config[0] || [];
    let configRow = adminFullData.config[1] || [];
    let fixedCost = parseMoneyAdmin(configRow[configHeaders.indexOf('Vé 1 người')]);
    let slKhuyenMai = parseMoneyAdmin(configRow[configHeaders.indexOf('SL khuyến mãi')]) || 999;
    let schemeVal = parseMoneyAdmin(configRow[configHeaders.indexOf('Scheme khuyến mãi')]);

    Object.values(bookingMap).forEach(b => {
        if (b.isPaid) {
            stats.paid += b.sl;
            stats.revenue += (b.sl >= slKhuyenMai) ? (fixedCost - schemeVal) * b.sl : fixedCost * b.sl;
            stats.listPaid.push(...b.ds_nguoi);
        } else {
            stats.pending += b.sl;
        }
    });
    
    // Tìm limit
    let limit = 0;
    if (dotFilter !== "All") {
        let r = adminFullData.config.find(row => row[configHeaders.indexOf('Nội dung option')] === dotFilter);
        if(r) limit = parseMoneyAdmin(r[configHeaders.indexOf('SL giới hạn')]);
    }

    return { stats, limit };
}

function populateAdminUI() {
    let configHeaders = adminFullData.config[0] || [];
    let dots = [];
    for(let i=1; i<adminFullData.config.length; i++) {
        let d = adminFullData.config[i][configHeaders.indexOf('Nội dung option')];
        if (d && d.trim() !== "") dots.push(d);
    }

    // Populate Selects
    let sel1 = document.getElementById('admin-dot-select');
    sel1.innerHTML = `<option value="All">Tất cả các đợt</option>` + dots.map(d => `<option value="${d}">${d}</option>`).join('');
    
    let sel2 = document.getElementById('admin-cost-select');
    sel2.innerHTML = dots.map(d => `<option value="${d}">${d}</option>`).join('');

    // Render Tab 1
    renderAdminStats();

    // Populate Tab 2 Checkboxes
    let costOptions = [];
    for(let i=1; i<adminFullData.config.length; i++) {
        let type = adminFullData.config[i][configHeaders.indexOf('Loại chi phí')];
        let name = adminFullData.config[i][configHeaders.indexOf('Chi phí tổ chức')];
        if (type === 'Dropdown' && name) costOptions.push(name);
    }
    document.getElementById('admin-dropdown-options').innerHTML = costOptions.map((c, i) => `
        <label style="display:inline-flex; align-items:center; gap:5px; margin-right: 15px; color:white; font-weight:normal; cursor:pointer;">
            <input type="checkbox" value="${c}" id="cbCost${i}" onchange="renderAdminCost()"> ${c}
        </label>`).join('');
    
    renderAdminCost();

    // Populate Tab 3 Forms
    let configRow = adminFullData.config[1] || [];
    document.getElementById('cfg-ve').value = parseMoneyAdmin(configRow[configHeaders.indexOf('Vé 1 người')]);
    document.getElementById('cfg-slkm').value = parseMoneyAdmin(configRow[configHeaders.indexOf('SL khuyến mãi')]);
    document.getElementById('cfg-schemekm').value = parseMoneyAdmin(configRow[configHeaders.indexOf('Scheme khuyến mãi')]);

    let dotContainer = document.getElementById('cfg-dots-container');
    dotContainer.innerHTML = '';
    for(let i=1; i<=2; i++) { // Max 2 Đợt for simplified UI matching Python
        let r = adminFullData.config[i] || [];
        dotContainer.innerHTML += `
            <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 10px;" class="cfg-dot-row">
                <input type="text" placeholder="Tên Đợt" value="${r[configHeaders.indexOf('Nội dung option')] || ''}" style="flex:2">
                <input type="number" placeholder="SL Limit" value="${parseMoneyAdmin(r[configHeaders.indexOf('SL giới hạn')])}" style="flex:1">
                <input type="text" placeholder="Link Zalo" value="${r[configHeaders.indexOf('Link Zalo')] || ''}" style="flex:2">
            </div>`;
    }

    let tbody = document.getElementById('cfg-cost-body');
    tbody.innerHTML = '';
    for(let i=1; i<adminFullData.config.length; i++) {
        let r = adminFullData.config[i];
        let cName = r[configHeaders.indexOf('Chi phí tổ chức')] || '';
        let cUnit = parseMoneyAdmin(r[configHeaders.indexOf('Unit cost')]);
        let cType = r[configHeaders.indexOf('Loại chi phí')] || 'Cố định';
        if(cName || cUnit) appendCostRow(tbody, cName, cUnit, cType);
    }
}

function appendCostRow(tbody, name='', unit='', type='Cố định') {
    let tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" value="${name}" style="padding: 8px; margin: 0;"></td>
        <td><input type="number" value="${unit}" style="padding: 8px; margin: 0;"></td>
        <td><select style="padding: 8px; margin: 0;"><option ${type==='Cố định'?'selected':''}>Cố định</option><option ${type==='Theo đầu người'?'selected':''}>Theo đầu người</option><option ${type==='Dropdown'?'selected':''}>Dropdown</option></select></td>
        <td><button onclick="this.closest('tr').remove()" style="background:red; color:white; border:none; border-radius:4px; padding:8px; cursor:pointer;">X</button></td>
    `;
    tbody.appendChild(tr);
}

function addConfigDot() {
    document.getElementById('cfg-dots-container').innerHTML += `
        <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 10px;" class="cfg-dot-row">
            <input type="text" placeholder="Tên Đợt" style="flex:2"><input type="number" placeholder="SL Limit" style="flex:1"><input type="text" placeholder="Link Zalo" style="flex:2">
        </div>`;
}
function addConfigCost() { appendCostRow(document.getElementById('cfg-cost-body')); }

function renderAdminStats() {
    let dotFilter = document.getElementById('admin-dot-select').value;
    let { stats, limit } = processAdminData(dotFilter);
    let totalSL = stats.paid + stats.pending;
    let limitStr = limit > 0 ? ` / ${limit}` : '';

    let html = `
        <div class="metric-grid">
            <div class="metric-box">
                <div class="metric-title">SỐ LƯỢNG ĐĂNG KÝ</div>
                <div class="metric-value">${totalSL}${limitStr}</div>
                <div style="color: white; margin-top: 10px; font-size: 0.95rem;">
                    ✅ Đã thanh toán: <b style="color: var(--glow-yellow);">${stats.paid}</b><br>
                    ⏳ Chờ đối soát: <b style="color: #ff9800;">${stats.pending}</b>
                </div>
            </div>
            <div class="metric-box">
                <div class="metric-title">DOANH THU THỰC TẾ</div>
                <div class="metric-value">${stats.revenue.toLocaleString('vi-VN')} đ</div>
            </div>
        </div>
    `;

    if (stats.listPaid.length > 0) {
        html += `
            <button class="btn-export" onclick="exportExcel('${dotFilter}')">📥 TẢI XUỐNG DANH SÁCH (EXCEL)</button>
            <h3 style="color: var(--glow-cyan); margin-top: 20px;">Danh sách khách chốt đơn</h3>
            <table class="admin-table"><thead><tr><th>Họ và Tên</th><th>Năm sinh</th></tr></thead><tbody>`;
        stats.listPaid.forEach(ng => { html += `<tr><td>${ng.name}</td><td>${ng.yob}</td></tr>`; });
        html += `</tbody></table>`;
    } else {
        html += `<div style="background: rgba(255,0,0,0.2); padding: 15px; border-radius: 8px; color: #ffcccc; border: 1px solid #ff0000; text-align: center;">Chưa có khách hàng chốt đơn thành công.</div>`;
    }
    document.getElementById('admin-stats-result').innerHTML = html;
}

function exportExcel(dotFilter) {
    let { stats } = processAdminData(dotFilter);
    let wb = XLSX.utils.book_new();
    let wsData = [
        [`DANH SÁCH KHÁCH THAM GIA - ${dotFilter.toUpperCase()}`], [],
        ["Họ và Tên", "Năm sinh"]
    ];
    stats.listPaid.forEach(ng => wsData.push([ng.name, ng.yob]));
    let ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Merge Tiêu đề
    if(!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } });
    
    XLSX.utils.book_append_sheet(wb, ws, "Danh Sách");
    XLSX.writeFile(wb, `Danh_sach_chot_don_${dotFilter}.xlsx`);
}

function renderAdminCost() {
    let dotFilter = document.getElementById('admin-cost-select').value;
    if(!dotFilter) return;
    let { stats } = processAdminData(dotFilter);
    let totalKhach = stats.paid;
    let revenue = stats.revenue;

    let configHeaders = adminFullData.config[0] || [];
    let selectedDropdowns = Array.from(document.querySelectorAll('#admin-dropdown-options input:checked')).map(cb => cb.value);

    let costTableHtml = `<table class="admin-table"><thead><tr><th>Chi phí</th><th>Unit Cost</th><th>Số lượng</th><th>Thành tiền (VNĐ)</th></tr></thead><tbody>`;
    let totalCost = 0;

    for(let i=1; i<adminFullData.config.length; i++) {
        let r = adminFullData.config[i];
        let name = r[configHeaders.indexOf('Chi phí tổ chức')];
        let unit = parseMoneyAdmin(r[configHeaders.indexOf('Unit cost')]);
        let type = r[configHeaders.indexOf('Loại chi phí')];

        if(!name) continue;

        let sl = 0;
        if(type === 'Cố định') sl = 1;
        else if(type === 'Theo đầu người') sl = totalKhach;
        else if(type === 'Dropdown' && selectedDropdowns.includes(name)) sl = 1;

        if (sl > 0) {
            let thanhtien = sl * unit;
            totalCost += thanhtien;
            costTableHtml += `<tr><td>${name}</td><td>${unit.toLocaleString('vi-VN')}</td><td>${sl}</td><td>${thanhtien.toLocaleString('vi-VN')}</td></tr>`;
        }
    }

    let profit = revenue - totalCost;

    costTableHtml += `
        <tr style="background: rgba(255,215,0,0.2); font-weight: bold;"><td colspan="3" style="color:var(--glow-yellow)">TỔNG CỘNG CHI PHÍ</td><td style="color:var(--glow-yellow)">${totalCost.toLocaleString('vi-VN')}</td></tr>
        <tr style="background: rgba(25, 135, 84, 0.4); font-weight: 900; font-size: 1.2rem;"><td colspan="3" style="color:#FFF">LỢI NHUẬN ƯỚC TÍNH</td><td style="color:#00FFFF">${profit.toLocaleString('vi-VN')}</td></tr>
        </tbody></table>
    `;

    document.getElementById('admin-cost-result').innerHTML = `
        <div style="margin-top: 20px; font-size: 1.1rem; color: white;">
            <b>Tổng số người (CHỐT ĐƠN):</b> <span style="color: var(--glow-yellow);">${totalKhach}</span><br>
            <b>Doanh thu thực tế:</b> <span style="color: var(--glow-yellow);">${revenue.toLocaleString('vi-VN')} VNĐ</span>
        </div>
        <h3 style="color: var(--glow-cyan); margin-top: 20px; text-transform: uppercase;">BẢNG DỰ TOÁN CHI PHÍ</h3>
        ${costTableHtml}
    `;
}

async function saveConfigToServer() {
    if(!confirm("Bạn có chắc chắn muốn lưu đè cấu hình lên Google Sheet?")) return;

    let btn = document.getElementById('btn-save-config');
    btn.innerHTML = "ĐANG LƯU... ⏳"; btn.disabled = true;

    try {
        let headers = ["Nội dung option","SL giới hạn","Vé 1 người","SL khuyến mãi","Scheme khuyến mãi","Link Zalo","Thời gian CK","Thời gian Check","Chi phí tổ chức","Unit cost","Loại chi phí"];
        let newValues = [headers];

        let ve = document.getElementById('cfg-ve').value;
        let slkm = document.getElementById('cfg-slkm').value;
        let schemekm = document.getElementById('cfg-schemekm').value;

        let dotRows = document.querySelectorAll('.cfg-dot-row');
        let costRows = document.querySelectorAll('#cfg-cost-body tr');

        let maxLen = Math.max(dotRows.length, costRows.length);
        for(let i=0; i<maxLen; i++) {
            let row = new Array(headers.length).fill("");
            
            // Fill general config on row 1
            if(i === 0) {
                row[headers.indexOf('Vé 1 người')] = ve;
                row[headers.indexOf('SL khuyến mãi')] = slkm;
                row[headers.indexOf('Scheme khuyến mãi')] = schemekm;
                row[headers.indexOf('Thời gian CK')] = "15";
                row[headers.indexOf('Thời gian Check')] = "15";
            }

            // Fill Dot data
            if(i < dotRows.length) {
                let inputs = dotRows[i].querySelectorAll('input');
                row[headers.indexOf('Nội dung option')] = inputs[0].value;
                row[headers.indexOf('SL giới hạn')] = inputs[1].value;
                row[headers.indexOf('Link Zalo')] = inputs[2].value;
            }

            // Fill Cost data
            if(i < costRows.length) {
                let tdInp = costRows[i].querySelectorAll('input, select');
                row[headers.indexOf('Chi phí tổ chức')] = tdInp[0].value;
                row[headers.indexOf('Unit cost')] = tdInp[1].value;
                row[headers.indexOf('Loại chi phí')] = tdInp[2].value;
            }
            newValues.push(row);
        }

        const res = await fetch('/api/admin/update', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, 
            body: JSON.stringify({ values: newValues }) 
        });
        const data = await res.json();
        
        if(data.success) {
            alert("✅ Đã cập nhật Cấu hình thành công lên Google Sheet & Hệ thống!");
            await loadAdminData(); // Reload admin data silently
        } else { alert("Lỗi lưu dữ liệu: " + data.message); }
    } catch(err) { alert("Lỗi kết nối!"); }
    
    btn.innerHTML = "LƯU THAY ĐỔI LÊN GOOGLE SHEET 💾"; btn.disabled = false;
}
