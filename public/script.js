// --- CHUYỂN TAB CHÍNH (Đăng ký / Tra cứu / Admin) ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.main-nav button').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

// --- CHUYỂN BƯỚC ĐĂNG KÝ (Step 1 -> 2 -> 3) ---
function switchStep(stepNum) {
    document.querySelectorAll('.step-content').forEach(step => step.classList.remove('active'));
    document.querySelectorAll('.step-nav button').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById('step' + stepNum).classList.add('active');
    document.getElementById('nav-step' + stepNum).classList.add('active');
}

// --- LOGIC HIỆN FORM KHI ĐỒNG Ý MIỄN TRỪ TRÁCH NHIỆM ---
function toggleForm() {
    const isAgreed = document.getElementById('agreeCheckbox').checked;
    const form = document.getElementById('registrationForm');
    if (isAgreed) {
        form.style.display = 'block';
        renderParticipants(); // Render sẵn người đầu tiên
    } else {
        form.style.display = 'none';
    }
}

// --- TẠO CÁC Ô ĐIỀN TÊN THEO SỐ LƯỢNG NGƯỜI ---
function renderParticipants() {
    const num = parseInt(document.getElementById('numPeople').value) || 1;
    const container = document.getElementById('participantsList');
    container.innerHTML = ''; // Clear cũ

    for(let i = 1; i <= num; i++) {
        container.innerHTML += `
            <div class="person-box">
                <b>👤 Người thứ ${i}</b>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <div style="flex:2;">
                        <input type="text" id="name_${i}" placeholder="Họ và tên" style="width:100%; padding:8px;">
                    </div>
                    <div style="flex:1;">
                        <input type="text" id="yob_${i}" placeholder="Năm sinh" style="width:100%; padding:8px;">
                    </div>
                </div>
            </div>
        `;
    }
}

// --- MÔ PHỎNG NÚT SUBMIT & API IMGBB ---
async function submitRegistration() {
    const fileInput = document.getElementById('billUpload');
    if (fileInput.files.length === 0) {
        alert("Vui lòng tải lên Bill thanh toán trước khi xác nhận!");
        return;
    }

    const phone = document.getElementById('phoneInput').value;
    if(!phone) {
        alert("Vui lòng nhập SĐT!");
        return;
    }

    // Ở Bước 2 (làm Backend), chúng ta sẽ viết code upload ảnh lên ImgBB ở đây
    // và gửi Dữ liệu JSON (Tên, SĐT, Link ảnh) về Cloudflare Worker.
    alert("Nút hoạt động tốt! Sẵn sàng chờ kết nối Backend Cloudflare Worker.");
}

// --- MÔ PHỎNG NÚT ADMIN ---
function loginAdmin() {
    const pass = document.getElementById('adminPass').value;
    if(pass === "0519") { // Mật khẩu từ code gốc
        document.getElementById('adminLogin').style.display = "none";
        document.getElementById('adminDashboard').style.display = "block";
    } else {
        alert("Sai mật khẩu!");
    }
}
