const IMGBB_API_KEY = '49ec155703a3d740e971a0c5bb680517';
let configData = {};
let currentHoldId = null;
let timerInterval = null;

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.main-nav button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
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
                        <span style="color:#a5d6a7;">✅ Đã ĐK: ${booked}</span>
                        <span style="color:#ffcc80;">⏳ Đang thanh toán: ${held}</span>
                    </div>
                `;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = '<div style="color:var(--glow-yellow); text-align:center; width:100%;">Hiện chưa có đợt đăng ký nào.</div>';
        }
    } catch (err) {
        document.getElementById('slot-container').innerHTML = '<div style="color:red; text-align:center; width:100%; background:rgba(255,0,0,0.1); padding:10px; border-radius:8px;">Lỗi tải dữ liệu. Vui lòng kiểm tra lại cấu trúc Google Sheet hoặc biến môi trường GCP_KEY.</div>';
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
            <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; margin-bottom:10px;">
                <div style="font-weight:bold; color:var(--glow-yellow); margin-bottom:5px;">👤 Người thứ ${i}</div>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="name_${i}" placeholder="Họ và tên" style="flex:2;">
                    <input type="number" id="yob_${i}" placeholder="Năm sinh" style="flex:1;">
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
            
            if (num >= slKhuyenMai) {
                totalCost = (costVal - schemeVal) * num;
            } else {
                totalCost = costVal * num;
            }
            
            document.getElementById('payTotalAmount').innerText = totalCost.toLocaleString('vi-VN') + " VNĐ";
            
            let cleanName = firstParticipant.split('-')[0].trim().split(' ').pop().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toUpperCase();
            document.getElementById('paySyntax').innerText = `Tripdem ${cleanName} ${phone}`;
            
            startCountdown(15 * 60);
        } else {
            alert(data.message || "Lỗi giữ chỗ, có thể người khác vừa đăng ký suất cuối cùng!");
            btn.innerHTML = "TIẾP TỤC THANH TOÁN 🚀"; btn.disabled = false;
        }
    } catch(err) {
        alert("Lỗi kết nối!"); btn.innerHTML = "TIẾP TỤC THANH TOÁN 🚀"; btn.disabled = false;
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
                document.getElementById('countdownTimer').style.display = 'none';
                document.getElementById('submitStatus').innerHTML = `🎉 GHI NHẬN THÀNH CÔNG! Mã Booking: <b>${submitData.bookingId}</b>`;
                btnSubmit.style.display = 'none';
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

        let dsHtml = `<div style="text-align:left; font-size: 0.95rem; margin-top:10px;">`;
        data.ds_nguoi.forEach(ng => { dsHtml += `• ${ng.name} (${ng.yob})<br>`; });
        dsHtml += `</div>`;

        let statusHtml = "";
        if (!data.isChecked) {
            statusHtml = `<div class="glass-box" style="background: rgba(255,235,59,0.2); border-color:#FBC02D; text-align:center;">
                <h3 style="color:#FFC107; margin-top:0;">⏳ ĐANG CHỜ ĐỐI SOÁT</h3>
                <p style="margin-bottom:0;">Dạ, đã nhận được đăng ký của <b>${data.firstName}</b> rồi ạ. Anh chị đợi BTC đối chiếu ngân hàng và cập nhật trạng thái nha.</p>
            </div>`;
        } else {
            statusHtml = `<div class="glass-box" style="background: rgba(76,175,80,0.2); border-color:#4CAF50; text-align:center;">
                <h3 style="color:#4CAF50; margin-top:0;">✅ CHỐT ĐƠN THÀNH CÔNG</h3>
                <p>🎉 Chúc mừng <b>${data.firstName}</b> đã chốt đơn thành công! Cảm ơn anh chị đã quan tâm và đăng ký tham gia chương trình.</p>
            </div>`;
            createButterflies();
        }

        resultDiv.innerHTML = statusHtml + `<div class="glass-box" style="background:rgba(0,0,0,0.3);">
            <b style="color: var(--glow-yellow); text-transform: uppercase;">THÔNG TIN ĐĂNG KÝ:</b><br><br>
            Mã Đơn: <b>${data.bookingId}</b><br>Đợt: ${data.dot}<br>SĐT Đại diện: ${data.phoneDisplay}<br>Số lượng: ${data.sl} người
            ${dsHtml}
        </div>`;
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
