const IMGBB_API_KEY = '49ec155703a3d740e971a0c5bb680517';
let configData = {};
let currentHoldId = null;
let timerInterval = null;

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

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch('/api/config');
        configData = await res.json();
        
        if (configData.error) throw new Error(configData.error);

        const costVal = Number(configData.fixedCost) || 0;
        const schemeVal = Number(configData.schemeKhuyenMai) || 0;
        const discountVal = costVal - schemeVal;

        document.getElementById('display-cost').innerText = costVal.toLocaleString('vi-VN');
        document.getElementById('display-slkm').innerText = configData.slKhuyenMai || 0;
        document.getElementById('display-discount').innerText = discountVal.toLocaleString('vi-VN');

        const container = document.getElementById('slot-container');
        container.innerHTML = '';
        
        if (configData.options && configData.options.length > 0) {
            configData.options.forEach(opt => {
                const total = parseInt(opt.limit) || 0;
                const booked = parseInt(opt.booked) || 0;
                const held = parseInt(opt.held) || 0;
                const available = Math.max(0, total - booked - held);

                const card = document.createElement('div');
                card.className = 'slot-card';
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
        } else {
            container.innerHTML = '<div style="color:var(--glow-yellow); text-align:center; width:100%; font-size:1.2rem;">Hiện chưa có đợt đăng ký nào.</div>';
        }
    } catch (err) {
        document.getElementById('slot-container').innerHTML = `<div style="color:#FFCDD2; text-align:center; width:100%; background:rgba(211,47,47,0.8); padding:15px; border-radius:8px;"><b>Lỗi tải dữ liệu.</b><br>Chi tiết: ${err.message}</div>`;
    }
});

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
    if (isAgreed && !dot) {
        alert("Vui lòng chọn đợt tham gia ở phía trên trước!");
        document.getElementById('agreeCheckbox').checked = false;
        return;
    }
    const form = document.getElementById('registrationForm');
    if (isAgreed) {
        form.style.display = 'block';
        renderParticipants();
    } else {
        form.style.display = 'none';
    }
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
                <div style="font-weight:bold; color:var(--glow-yellow); margin-bottom:8px; font-size:1.1rem; display:flex; align-items:center; gap:8px;">
                    <img src="assets/images/age.png" style="width:20px;"> Người thứ ${i}
                </div>
                <div style="display:flex; gap:10px; flex-wrap: wrap;">
                    <input type="text" id="name_${i}" placeholder="Họ và tên" style="flex:2; min-width:150px;">
                    <input type="number" id="yob_${i}" placeholder="Năm sinh" style="flex:1; min-width:100px;">
                </div>
            </div>
        `;
    }
}

async function holdSlotAndPay() {
    const dot = document.getElementById('selectedDot').value;
    const phone = document.getElementById('phoneInput').value;
    const num = parseInt(document.getElementById('numPeople').value);

    let firstParticipant = document.getElementById('name_1').value;
    if (!firstParticipant || !phone) { alert("Vui lòng nhập đầy đủ Tên người 1 và Số điện thoại!"); return; }

    const btn = document.getElementById('btnHold');
    btn.innerHTML = "ĐANG GIỮ CHỖ... ⏳"; btn.disabled = true;

    try {
        const res = await fetch('/api/hold', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dot: dot, sl: num }) });
        const data = await res.json();
        
        if(data.success) {
            currentHoldId = data.holdId;
            document.getElementById('registrationForm').style.display = 'none';
            document.getElementById('paymentBox').style.display = 'block';
            
            let totalCost = 0;
            const costVal = Number(configData.fixedCost) || 0;
            const schemeVal = Number(configData.schemeKhuyenMai) || 0;
            const slKhuyenMai = Number(configData.slKhuyenMai) || 999;
            
            if (num >= slKhuyenMai) { totalCost = (costVal - schemeVal) * num; } else { totalCost = costVal * num; }
            document.getElementById('payTotalAmount').innerText = totalCost.toLocaleString('vi-VN') + " VNĐ";
            
            let cleanName = firstParticipant.split('-')[0].trim().split(' ').pop().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toUpperCase();
            document.getElementById('paySyntax').innerText = `Tripdem ${cleanName} ${phone}`;
            
            startCountdown(15 * 60);
        } else {
            alert(data.message || "Lỗi giữ chỗ, có thể người khác vừa đăng ký suất cuối cùng!");
            btn.innerHTML = "TIẾP TỤC THANH TOÁN 🚀"; btn.disabled = false;
        }
    } catch(err) {
        alert("Lỗi kết nối mạng!"); btn.innerHTML = "TIẾP TỤC THANH TOÁN 🚀"; btn.disabled = false;
    }
}

function startCountdown(duration) {
    let timer = duration, minutes, seconds;
    const display = document.getElementById('countdownTimer');
    
    timerInterval = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);
        display.textContent = (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
        if (--timer < 0) {
            clearInterval(timerInterval);
            alert("Đã hết thời gian chuyển khoản, anh chị chưa đăng ký thành công 😥");
            window.location.reload();
        }
    }, 1000);
}

async function submitFinalRegistration() {
    const fileInput = document.getElementById('billUpload');
    if (fileInput.files.length === 0) { alert("Vui lòng tải lên ảnh Bill thanh toán!"); return; }

    const btnSubmit = document.getElementById('btnSubmitFinal');
    btnSubmit.disabled = true; btnSubmit.innerHTML = "ĐANG TẢI ẢNH LÊN... ⏳";

    try {
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const imgbbData = await imgbbRes.json();
        
        if (imgbbData.success) {
            btnSubmit.innerHTML = "ĐANG LƯU DỮ LIỆU... 🚀";
            const num = parseInt(document.getElementById('numPeople').value);
            let ds_nguoi = [];
            for(let i=1; i<=num; i++) {
                ds_nguoi.push({ name: document.getElementById(`name_${i}`).value, yob: document.getElementById(`yob_${i}`).value });
            }
            
            let totalCost = 0;
            const costVal = Number(configData.fixedCost) || 0;
            const schemeVal = Number(configData.schemeKhuyenMai) || 0;
            const slKhuyenMai = Number(configData.slKhuyenMai) || 999;
            if (num >= slKhuyenMai) { totalCost = (costVal - schemeVal) * num; } else { totalCost = costVal * num; }

            const payload = {
                dot_tham_gia: document.getElementById('selectedDot').value,
                sl: num,
                ds_nguoi: ds_nguoi,
                phone: document.getElementById('phoneInput').value,
                phone_backup: document.getElementById('phoneBackup').value,
                bill_url: imgbbData.data.url,
                totalMoney: totalCost,
                holdId: currentHoldId
            };

            const submitRes = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const submitData = await submitRes.json();

            if (submitData.success) {
                clearInterval(timerInterval);
                document.getElementById('paymentBox').style.display = 'none';
                document.getElementById('submitSuccessBox').style.display = 'block';
                document.getElementById('successBookingId').innerText = submitData.bookingId;
                createButterflies(); 
            }
        } else { alert("Lỗi tải ảnh!"); btnSubmit.innerHTML = "XÁC NHẬN ĐÃ CHUYỂN KHOẢN"; btnSubmit.disabled = false; }
    } catch (err) { alert("Lỗi mạng!"); btnSubmit.innerHTML = "XÁC NHẬN ĐÃ CHUYỂN KHOẢN"; btnSubmit.disabled = false; }
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

        let dsHtml = `<table class="result-table"><tr><th>Họ và Tên</th><th>Năm sinh</th></tr>`;
        data.ds_nguoi.forEach(ng => { dsHtml += `<tr><td><b>${ng.name}</b></td><td style="text-align:center;">${ng.yob}</td></tr>`; });
        dsHtml += `</table>`;

        let statusHtml = "";
        let zaloHtml = "";

        if (!data.isChecked) {
            statusHtml = `
                <div style="text-align:center; padding-bottom:15px; margin-bottom:15px; border-bottom:1px dashed rgba(255,255,255,0.2);">
                    <h3 style="color:var(--glow-yellow); margin-top:0; font-size: 1.5rem;">⏳ ĐANG CHỜ ĐỐI SOÁT</h3>
                    <p style="font-size: 1.1rem; margin:0;">Hệ thống đã nhận được đăng ký của anh/chị <b>${data.firstName}</b> rồi ạ. Anh chị đợi BTC đối chiếu tài khoản và cập nhật trạng thái nha.</p>
                </div>
            `;
        } else {
            statusHtml = `
                <div style="text-align:center; padding-bottom:15px; margin-bottom:15px; border-bottom:1px dashed rgba(255,255,255,0.2);">
                    <h3 style="color:var(--glow-cyan); margin-top:0; font-size: 1.5rem;">✅ CHỐT ĐƠN THÀNH CÔNG</h3>
                    <p style="font-size: 1.1rem; margin:0;">🎉 Chúc mừng <b>${data.firstName}</b> đã chốt đơn thành công! Cảm ơn anh chị đã quan tâm và đăng ký tham gia chương trình.</p>
                </div>
                <div style="background:rgba(25,135,84,0.3); padding:10px; border-radius:8px; border:1px solid #198754; margin-bottom:15px;">
                    ✅ BTC đã nhận được thanh toán:<br>
                    Tổng số tiền đã nhận: <span style="color:var(--glow-yellow); font-weight:900; font-size:1.2rem;">${data.totalMoney ? data.totalMoney.toLocaleString('vi-VN') : 0} VNĐ</span>
                </div>
            `;
            if (data.zaloLink) {
                zaloHtml = `
                    <div class="zalo-banner">
                        🚨 QUAN TRỌNG: ANH CHỊ NHỚ VÀO GROUP ZALO ĐỂ TIỆN THEO DÕI THÔNG BÁO NHA! 🚨<br>
                        <a href="${data.zaloLink}" target="_blank">👉 BẤM VÀO ĐÂY ĐỂ THAM GIA GROUP 👈</a>
                    </div>
                `;
            }
            createFireflies();
        }

        resultDiv.innerHTML = `
            <div class="glass-box" style="text-align:center;">
                ${statusHtml}
                <div style="text-align:left; background:rgba(0,0,0,0.3); padding:20px; border-radius:12px; margin-top:10px;">
                    <b style="color: var(--glow-yellow); font-size: 1.1rem; display:block; margin-bottom:10px; text-transform: uppercase;">THÔNG TIN ĐĂNG KÝ:</b>
                    Đợt tham gia: <b style="color:white;">${data.dot}</b><br>
                    SĐT người đại diện: <b style="color:white;">${data.phoneDisplay}</b><br>
                    Tổng số lượng: <b style="color:white;">${data.sl} người</b>
                    ${dsHtml}
                </div>
                ${zaloHtml}
            </div>
        `;
    } catch (err) { resultDiv.innerHTML = `<div class="glass-box" style="color:red; text-align:center;">Lỗi kết nối máy chủ.</div>`; }
}

function createButterflies() {
    for (let i = 0; i < 20; i++) {
        let b = document.createElement("img");
        b.src = "assets/images/butterfly.png";
        b.className = "flying-butterfly";
        b.style.left = Math.random() * 100 + "vw";
        b.style.animationDuration = (Math.random() * 4 + 3) + "s";
        b.style.animationDelay = (Math.random() * 1.5) + "s";
        document.body.appendChild(b);
        setTimeout(() => b.remove(), 7000);
    }
}

function createFireflies() {
    for (let i = 0; i < 30; i++) {
        let f = document.createElement("div");
        f.className = "anim-firefly";
        f.style.left = Math.random() * 100 + "vw";
        f.style.top = Math.random() * 100 + "vh";
        f.style.setProperty('--dx', (Math.random() - 0.5) * 2);
        f.style.setProperty('--dy', Math.random() + 0.5);
        f.style.animationDuration = (Math.random() * 3 + 2) + "s";
        document.body.appendChild(f);
        setTimeout(() => f.remove(), 6000);
    }
}
