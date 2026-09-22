// --- IMGBB API KEY ---
const IMGBB_API_KEY = '49ec155703a3d740e971a0c5bb680517';

// --- CHUYỂN TAB CHÍNH ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.main-nav button').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    if(tabId === 'tab-register') document.getElementById('menu-register').classList.add('active');
    if(tabId === 'tab-lookup') document.getElementById('menu-lookup').classList.add('active');
    if(tabId === 'tab-admin') document.getElementById('menu-admin').classList.add('active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- CHUYỂN BƯỚC ĐĂNG KÝ ---
function switchStep(stepNum) {
    document.querySelectorAll('.step-content').forEach(step => step.classList.remove('active'));
    document.querySelectorAll('.step-nav button').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById('step' + stepNum).classList.add('active');
    document.getElementById('nav-step' + stepNum).classList.add('active');
}

// --- LOGIC HIỆN FORM KHI TICK ĐỒNG Ý ---
function toggleForm() {
    const isAgreed = document.getElementById('agreeCheckbox').checked;
    const form = document.getElementById('registrationForm');
    if (isAgreed) {
        form.style.display = 'block';
        if (document.getElementById('participantsList').innerHTML === '') {
            renderParticipants(); 
        }
    } else {
        form.style.display = 'none';
    }
}

// --- RENDER INPUT TÊN THEO SỐ LƯỢNG NGƯỜI ---
function renderParticipants() {
    let num = parseInt(document.getElementById('numPeople').value) || 1;
    if (num > 20) { num = 20; document.getElementById('numPeople').value = 20; }
    
    const container = document.getElementById('participantsList');
    container.innerHTML = ''; 

    for(let i = 1; i <= num; i++) {
        container.innerHTML += `
            <div class="person-box">
                <b>👤 Người thứ ${i}</b>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <div style="flex:2;">
                        <input type="text" id="name_${i}" placeholder="Họ và tên" style="width:100%; padding:8px;">
                    </div>
                    <div style="flex:1;">
                        <input type="number" id="yob_${i}" placeholder="Năm sinh" style="width:100%; padding:8px;">
                    </div>
                </div>
            </div>
        `;
    }
}

// =======================================================
// 1. TỰ ĐỘNG LOAD ĐỢT ĐĂNG KÝ TỪ GG SHEET KHI MỞ TRANG
// =======================================================
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        const select = document.getElementById('tripSelect');
        select.innerHTML = '<option value="">-- Chọn đợt tham gia --</option>';

        if (data.values && data.values.length > 1) {
            // Bỏ qua dòng tiêu đề (index 0)
            for (let i = 1; i < data.values.length; i++) {
                let dotName = data.values[i][0];
                let limit = data.values[i][1];
                if (dotName) {
                    select.innerHTML += `<option value="${dotName}">${dotName} (Tối đa ${limit} suất)</option>`;
                }
            }
        }
    } catch (err) {
        console.error("Lỗi load config:", err);
        document.getElementById('tripSelect').innerHTML = '<option value="">(Lỗi tải dữ liệu. Hãy refresh trang)</option>';
    }
});

// =======================================================
// 2. SUBMIT FORM: UPLOAD ẢNH & GỬI DỮ LIỆU LÊN SHEET
// =======================================================
async function submitRegistration() {
    const btnSubmit = document.getElementById('btnSubmit');
    const statusDiv = document.getElementById('submitStatus');
    const fileInput = document.getElementById('billUpload');
    const phone = document.getElementById('phoneInput').value;
    const dotThamGia = document.getElementById('tripSelect').value;

    if (!dotThamGia) { alert("Vui lòng chọn đợt tham gia!"); return; }
    if (!phone) { alert("Vui lòng nhập SĐT đại diện!"); return; }
    if (fileInput.files.length === 0) { alert("Vui lòng tải lên ảnh Bill thanh toán!"); return; }

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = "ĐANG TẢI ẢNH LÊN... ⏳";
    statusDiv.innerHTML = "";

    try {
        // A. Upload ảnh lên ImgBB
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('image', file);

        const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });
        const imgbbData = await imgbbResponse.json();
        
        if (imgbbData.success) {
            const billUrl = imgbbData.data.url;
            btnSubmit.innerHTML = "ĐANG LƯU DỮ LIỆU... 🚀";
            
            // B. Gom dữ liệu gửi lên Backend Cloudflare
            const num = parseInt(document.getElementById('numPeople').value);
            let ds_nguoi = [];
            for(let i=1; i<=num; i++) {
                ds_nguoi.push({
                    name: document.getElementById(`name_${i}`).value,
                    yob: document.getElementById(`yob_${i}`).value
                });
            }

            const payload = {
                dot_tham_gia: dotThamGia,
                sl: num,
                ds_nguoi: ds_nguoi,
                phone: phone,
                phone_backup: document.getElementById('phoneBackup').value,
                bill_url: billUrl,
                mien_tru: document.getElementById('agreeCheckbox').checked
            };

            const submitRes = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const submitData = await submitRes.json();

            if (submitData.success) {
                statusDiv.innerHTML = `🎉 Ghi nhận thành công! Mã Booking của bạn: <b>${submitData.bookingId}</b>`;
                btnSubmit.style.display = 'none'; // Ẩn nút tránh click đúp
            } else {
                alert("Lỗi lưu dữ liệu lên Sheet. Vui lòng thử lại!");
                btnSubmit.innerHTML = "XÁC NHẬN ĐĂNG KÝ";
                btnSubmit.disabled = false;
            }

        } else {
            alert("Lỗi tải ảnh. Kích thước ảnh có thể quá lớn, vui lòng thử lại!");
            btnSubmit.innerHTML = "XÁC NHẬN ĐĂNG KÝ";
            btnSubmit.disabled = false;
        }

    } catch (error) {
        console.error("Lỗi:", error);
        alert("Có lỗi mạng xảy ra, vui lòng thử lại!");
        btnSubmit.innerHTML = "XÁC NHẬN ĐĂNG KÝ";
        btnSubmit.disabled = false;
    }
}

// =======================================================
// 3. TRA CỨU ĐƠN (GỌI BACKEND & CẬP NHẬT GIAO DIỆN)
// =======================================================
async function lookupBooking() {
    const phone = document.getElementById('lookupPhone').value;
    const resultDiv = document.getElementById('lookupResult');
    
    if(!phone) { alert("Vui lòng nhập SĐT!"); return; }
    
    resultDiv.innerHTML = "<i>Đang tìm kiếm dữ liệu... ⏳</i>";
    
    try {
        const res = await fetch('/api/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        
        const data = await res.json();
        
        if (!data.success) {
            resultDiv.innerHTML = `<div style="color:red; font-weight:bold; padding: 15px; border: 1px solid red; border-radius: 6px;">${data.message}</div>`;
            return;
        }

        // Tạo bảng danh sách người tham gia
        let dsHtml = `<table style="width:100%; border-collapse: collapse; margin-top:10px; font-size: 0.95rem;">
            <tr style="background:#198754; color:white;">
                <th style="padding:8px; border:1px solid #ddd; text-align: left;">Họ và tên</th>
                <th style="padding:8px; border:1px solid #ddd; text-align: center;">Năm sinh</th>
            </tr>`;
        data.ds_nguoi.forEach(ng => {
            dsHtml += `<tr>
                <td style="padding:8px; border:1px solid #ddd; background: #fff;">${ng.name}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:center; background: #fff;">${ng.yob}</td>
            </tr>`;
        });
        dsHtml += `</table>`;

        // Render Lời chào & Trạng thái
        let statusHtml = "";
        if (!data.isChecked) {
            statusHtml = `
                <div class="status-box status-pending">
                    <h3 style="margin-top:0;">⏳ ĐANG CHỜ ĐỐI SOÁT</h3>
                    <p>Dạ, đã nhận được đăng ký của <b>${data.firstName}</b> rồi ạ. Anh chị đợi BTC đối chiếu ngân hàng và cập nhật trạng thái nha.</p>
                </div>
            `;
        } else {
            statusHtml = `
                <div class="status-box status-success">
                    <h3 style="margin-top:0;">✅ CHỐT ĐƠN THÀNH CÔNG</h3>
                    <p>🎉 Chúc mừng <b>${data.firstName}</b> đã chốt đơn thành công! Cảm ơn anh chị đã quan tâm và đăng ký tham gia chương trình.</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;"><i>Anh chị nhớ tham gia group Zalo BTC để nhận thông báo nhé!</i></p>
                </div>
            `;
        }

        // Gom toàn bộ UI
        resultDiv.innerHTML = statusHtml + `
            <div style="background:#f9f9f9; padding:15px; border:1px solid #ddd; border-radius:6px;">
                <b style="color: #0F5132; text-transform: uppercase;">THÔNG TIN ĐĂNG KÝ:</b><br>
                <div style="margin-top: 8px; font-size: 0.95rem;">
                    • <b>Đợt tham gia:</b> ${data.dot}<br>
                    • <b>SĐT Đại diện:</b> ${data.phoneDisplay}<br>
                    • <b>Số lượng:</b> ${data.sl} người
                </div>
                ${dsHtml}
            </div>
        `;

    } catch (err) {
        resultDiv.innerHTML = `<div style="color:red;">Lỗi kết nối máy chủ. Vui lòng thử lại sau.</div>`;
        console.error(err);
    }
}

// --- MÔ PHỎNG ADMIN ---
function loginAdmin() {
    const pass = document.getElementById('adminPass').value;
    if(pass === "0519") {
        document.getElementById('adminLogin').style.display = "none";
        document.getElementById('adminDashboard').style.display = "block";
    } else {
        alert("Sai mật khẩu!");
    }
}
