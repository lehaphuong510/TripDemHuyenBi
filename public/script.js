// --- IMGBB API KEY ---
const IMGBB_API_KEY = '49ec155703a3d740e971a0c5bb680517';

// --- CHUYỂN TAB CHÍNH ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.main-nav button').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    // Active menu button tương ứng
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

// --- LOGIC HIỆN FORM ---
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

// --- RENDER NGƯỜI THAM GIA ---
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

// --- HÀM SUBMIT & UPLOAD ẢNH IMGBB ---
async function submitRegistration() {
    const btnSubmit = document.getElementById('btnSubmit');
    const statusDiv = document.getElementById('submitStatus');
    const fileInput = document.getElementById('billUpload');
    const phone = document.getElementById('phoneInput').value;

    // 1. Validate cơ bản
    if (!phone) { alert("Vui lòng nhập SĐT đại diện!"); return; }
    if (fileInput.files.length === 0) { alert("Vui lòng tải lên ảnh Bill thanh toán!"); return; }

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = "ĐANG TẢI ẢNH LÊN... ⏳";
    statusDiv.innerHTML = "";

    try {
        // 2. Upload ảnh lên ImgBB
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('image', file);

        const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });
        
        const imgbbData = await imgbbResponse.json();
        
        if (imgbbData.success) {
            const billUrl = imgbbData.data.url; // Lấy link ảnh thành công
            
            btnSubmit.innerHTML = "ĐANG GỬI DỮ LIỆU... 🚀";
            
            // 3. Gom dữ liệu để chuẩn bị gửi cho Cloudflare Worker (Phần này sẽ làm ở Bước 2)
            const num = parseInt(document.getElementById('numPeople').value);
            let ds_nguoi = [];
            for(let i=1; i<=num; i++) {
                ds_nguoi.push({
                    name: document.getElementById(`name_${i}`).value,
                    yob: document.getElementById(`yob_${i}`).value
                });
            }

            const payload = {
                dot_tham_gia: document.getElementById('tripSelect').value,
                sl: num,
                ds_nguoi: ds_nguoi,
                phone: phone,
                phone_backup: document.getElementById('phoneBackup').value,
                bill_url: billUrl, // Link ảnh từ ImgBB
                mien_tru: document.getElementById('agreeCheckbox').checked
            };

            console.log("Dữ liệu chuẩn bị gửi Backend:", payload);
            
            // TẠM THỜI MÔ PHỎNG THÀNH CÔNG (Chờ Backend)
            setTimeout(() => {
                statusDiv.innerHTML = "🎉 Ghi nhận thành công! (Chờ kết nối Backend)";
                btnSubmit.innerHTML = "XÁC NHẬN ĐĂNG KÝ";
                btnSubmit.disabled = false;
            }, 1000);

        } else {
            alert("Lỗi tải ảnh lên. Vui lòng thử lại ảnh khác!");
            btnSubmit.innerHTML = "XÁC NHẬN ĐĂNG KÝ";
            btnSubmit.disabled = false;
        }

    } catch (error) {
        console.error("Lỗi:", error);
        alert("Có lỗi xảy ra khi kết nối mạng!");
        btnSubmit.innerHTML = "XÁC NHẬN ĐĂNG KÝ";
        btnSubmit.disabled = false;
    }
}

// --- MÔ PHỎNG LUỒNG TRA CỨU MỚI ---
function lookupBooking() {
    const phone = document.getElementById('lookupPhone').value;
    const resultDiv = document.getElementById('lookupResult');
    
    if(!phone) { alert("Vui lòng nhập SĐT!"); return; }

    // MÔ PHỎNG DATA TỪ BACKEND
    // Giả sử gọi Backend và trả về biến isChecked = false (Chưa check nhận tiền) hoặc true (Đã check)
    // Tạm random để bạn test UI
    const isChecked = Math.random() > 0.5; 
    
    resultDiv.innerHTML = "<i>Đang tìm kiếm...</i>";
    
    setTimeout(() => {
        let statusHtml = "";
        if (!isChecked) {
            statusHtml = `
                <div class="status-box status-pending">
                    <h3 style="margin-top:0;">⏳ ĐANG CHỜ ĐỐI SOÁT</h3>
                    <p>Đã nhận được đăng ký của Anh chị rồi ạ. Anh chị đợi BTC đối chiếu ngân hàng và cập nhật trạng thái nha.</p>
                </div>
            `;
        } else {
            statusHtml = `
                <div class="status-box status-success">
                    <h3 style="margin-top:0;">✅ CHỐT ĐƠN THÀNH CÔNG</h3>
                    <p>🎉 Chúc mừng chốt đơn thành công! Cảm ơn anh chị đã quan tâm và đăng ký tham gia chương trình.</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;"><i>Anh chị nhớ tham gia group Zalo BTC để nhận thông báo nhé!</i></p>
                </div>
            `;
        }

        // Render thêm thông tin đăng ký bên dưới
        resultDiv.innerHTML = statusHtml + `
            <div style="background:#f9f9f9; padding:15px; border:1px solid #ddd; border-radius:6px;">
                <b>Thông tin đăng ký:</b><br>
                - Đợt: Đợt 1 - Ngày 15/10<br>
                - Số lượng: 2 người<br>
                - SĐT Đại diện: ${phone}
            </div>
        `;
    }, 800);
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
