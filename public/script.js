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

async function loadSlots(isInit = false) {
    const container = document.getElementById('slot-container');
    if(isInit) {
        container.innerHTML = '<div style="text-align:center; width:100%; font-size: 1.2rem;">Đang tải dữ liệu đợt tham gia... ⏳</div>';
    }
    
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
                if(currentSelected === opt.name) {
                    card.classList.add('selected');
                    document.getElementById('selectedDotMax').value = available;
                }
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
        container.innerHTML = `<div style="color:#FFCDD2; text-align:center; width:100%; background:rgba(211,47,47,0.8); padding:15px; border-radius:8px;"><b>Lỗi tải dữ liệu.</b><br>Chi tiết: ${err.message}</div>`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadSlots(true);
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
            await loadSlots();
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
                
                let successBox = document.getElementById('submitSuccessBox');
                successBox.style.display = 'block';
                document.getElementById('successBookingId').innerText = submitData.bookingId;
                
                successBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                createButterflies(); 
                await loadSlots();
            }
        } else { alert("Lỗi tải ảnh!"); btnSubmit.innerHTML = "XÁC NHẬN ĐÃ CHUYỂN KHOẢN"; btnSubmit.disabled = false; }
    } catch (err) { alert("Lỗi mạng!"); btnSubmit.innerHTML = "XÁC NHẬN ĐÃ CHUYỂN KHOẢN"; btnSubmit.disabled = false; }
}

function resetRegistrationForm() {
    document.getElementById('submitSuccessBox').style.display = 'none';
    document.getElementById('registrationForm').style.display = 'none';
    document.getElementById('agreeCheckbox').checked = false;
    
    document.getElementById('numPeople').value = 1;
    document.getElementById('phoneInput').value = '';
    document.getElementById('phoneBackup').value = '';
    document.getElementById('billUpload').value = '';
    document.getElementById('participantsList').innerHTML = '';
    
    document.getElementById('selectedDot').value = '';
    document.getElementById('selectedDotMax').value = '';
    
    const btnHold = document.getElementById('btnHold');
    btnHold.innerHTML = "TIẾP TỤC THANH TOÁN 🚀"; 
    btnHold.disabled = false;
    
    const btnSubmit = document.getElementById('btnSubmitFinal');
    btnSubmit.innerHTML = "XÁC NHẬN ĐÃ CHUYỂN KHOẢN"; 
    btnSubmit.disabled = false;
    
    document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
    
    loadSlots();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// RENDER KHỐI TRA CỨU MỚI (TÁCH/GỘP - FLEX)
// ==========================================
function renderLookupBlock(blockData, type) {
    let dsHtml = `<table class="result-table"><tr><th style="text-align:left;">HỌ VÀ TÊN</th><th style="text-align:center;">NĂM SINH</th></tr>`;
    blockData.ds_nguoi.forEach(ng => { 
        dsHtml += `<tr><td style="text-align:left;"><b style="color: var(--glow-yellow);">${ng.name}</b></td><td style="text-align:center; color: white;">${ng.yob}</td></tr>`; 
    });
    dsHtml += `</table>`;

    let dotStr = Array.from(blockData.dots).join(" | ");
    let bIdsStr = blockData.bIds.join(", ");

    if(type === 'paid') {
        return `
            <div class="glass-box" style="flex: 1; min-width: 280px; text-align:left; background:rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); padding: 0; overflow: hidden; margin-bottom: 0; display: flex; flex-direction: column;">
                <div style="background: rgba(25, 135, 84, 0.9); padding: 15px; text-align: center; border-bottom: 2px solid var(--glow-yellow);">
                    <h3 style="color: var(--glow-yellow); margin: 0; font-size: 1.4rem; text-transform: uppercase;">
                        <img src="assets/images/tick.png" style="width:24px; vertical-align:middle; margin-right:5px;"> ĐÃ NHẬN THANH TOÁN
                    </h3>
                    <div style="color: white; font-size: 1.1rem; margin-top: 5px;">Tổng số tiền đã nhận: <span style="color: var(--glow-yellow); font-weight: 900;">${blockData.totalMoney.toLocaleString('vi-VN')} VNĐ</span></div>
                </div>
                <div style="padding: 20px; flex: 1;">
                    <b style="color: var(--glow-yellow); font-size: 1.1rem; display:block; margin-bottom:15px; text-transform: uppercase;">THÔNG TIN ĐĂNG KÝ:</b>
                    <div style="margin-bottom:8px; color: white;">Mã Booking: <b style="color: var(--glow-yellow);">${bIdsStr}</b></div>
                    <div style="margin-bottom:8px; color: white;">Đợt tham gia: <b style="color: var(--glow-yellow);">${dotStr}</b></div>
                    <div style="margin-bottom:8px; color: white;">SĐT người đại diện: <b style="color: var(--glow-yellow);">${blockData.phoneDisplay}</b></div>
                    <div style="margin-bottom:15px; color: white;">Tổng số lượng: <b style="color: var(--glow-yellow);">${blockData.totalSl} người</b></div>
                    ${dsHtml}
                </div>
            </div>
        `;
    } else {
        return `
            <div class="glass-box" style="flex: 1; min-width: 280px; text-align:left; background:rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); padding: 0; overflow: hidden; margin-bottom: 0; display: flex; flex-direction: column;">
                <div style="background: rgba(255, 193, 7, 0.8); padding: 15px; text-align: center; border-bottom: 2px solid #FFF;">
                    <h3 style="color: #091221; margin: 0; font-size: 1.4rem; text-transform: uppercase;">
                        <img src="assets/images/donghocat.png" style="width:24px; vertical-align:middle; margin-right:5px; filter: brightness(0.1);"> ĐANG CHỜ ĐỐI SOÁT
                    </h3>
                </div>
                <div style="padding: 20px; flex: 1;">
                    <b style="color: var(--glow-yellow); font-size: 1.1rem; display:block; margin-bottom:15px; text-transform: uppercase;">THÔNG TIN ĐĂNG KÝ:</b>
                    <div style="margin-bottom:8px; color: white;">Mã Booking: <b style="color: var(--glow-yellow);">${bIdsStr}</b></div>
                    <div style="margin-bottom:8px; color: white;">Đợt tham gia: <b style="color: var(--glow-yellow);">${dotStr}</b></div>
                    <div style="margin-bottom:8px; color: white;">SĐT người đại diện: <b style="color: var(--glow-yellow);">${blockData.phoneDisplay}</b></div>
                    <div style="margin-bottom:15px; color: white;">Tổng số lượng: <b style="color: var(--glow-yellow);">${blockData.totalSl} người</b></div>
                    ${dsHtml}
                </div>
            </div>
        `;
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

        // Bọc Flexbox chia cột để render ra 2 block song song trên Laptop
        let blocksHtml = `<div style="display: flex; gap: 20px; flex-wrap: wrap; align-items: stretch; justify-content: center; width: 100%;">`;
        let zaloHtml = "";
        
        if (data.paid && data.paid.bIds.length > 0) {
            blocksHtml += renderLookupBlock(data.paid, 'paid');
            createFireflies(); 
            
            if (data.zaloLinks && data.zaloLinks.length > 0) {
                zaloHtml = `
                    <div class="zalo-banner" style="width: 100%; box-sizing: border-box;">
                        <span style="color: var(--glow-yellow);">🚨 QUAN TRỌNG: ANH CHỊ NHỚ VÀO GROUP ZALO ĐỂ TIỆN THEO DÕI THÔNG BÁO NHA! 🚨</span><br>
                        <a href="${data.zaloLinks[0]}" target="_blank">👉 BẤM VÀO ĐÂY ĐỂ THAM GIA GROUP 👈</a>
                    </div>
                `;
            }
        }

        if (data.pending && data.pending.bIds.length > 0) {
            blocksHtml += renderLookupBlock(data.pending, 'pending');
        }

        blocksHtml += `</div>`; // Đóng flex container

        resultDiv.innerHTML = `
            <div style="text-align:center; padding-bottom:15px; margin-bottom:15px;">
                <p style="font-size: 1.1rem; margin:0;">Hệ thống đã nhận được đăng ký của anh/chị <b style="color:var(--glow-yellow); text-transform:uppercase;">${data.firstName}</b>.</p>
            </div>
            ${blocksHtml}
            ${zaloHtml}
        `;
    } catch (err) { resultDiv.innerHTML = `<div class="glass-box" style="color:red; text-align:center;">Lỗi kết nối máy chủ.</div>`; }
}

function createButterflies() {
    for (let i = 0; i < 30; i++) {
        let b = document.createElement("img");
        b.src = "assets/images/butterfly.png";
        b.style.position = "fixed";
        b.style.width = "30px";
        b.style.zIndex = "9999";
        b.style.pointerEvents = "none";
        
        b.style.left = "50vw";
        b.style.top = "50vh";
        b.style.transform = "translate(-50%, -50%) scale(0)";
        b.style.transition = `all ${Math.random() * 2 + 2}s cubic-bezier(0.25, 1, 0.5, 1)`;
        
        document.body.appendChild(b);

        setTimeout(() => {
            let dx = (Math.random() * 200 - 100) + "vw";
            let dy = (Math.random() * 200 - 100) + "vh";
            b.style.transform = `translate(${dx}, ${dy}) scale(1.5) rotate(${Math.random() * 360}deg)`;
            b.style.opacity = "0";
        }, 50);

        setTimeout(() => b.remove(), 5000);
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
