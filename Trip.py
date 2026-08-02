import streamlit as st
import gspread
from google.oauth2.service_account import Credentials
import pandas as pd
import time
from datetime import datetime
import json

# --- 1. CẤU HÌNH TRANG & CSS (Màu Xanh thiên nhiên & Vàng Gold kim loại) ---
st.set_page_config(page_title="Đăng Ký Trip Đêm Huyền Bí", page_icon="🌿", layout="centered")

st.markdown('''
<style>
    /* Ép CSS không rớt chữ cho Tiêu đề, canh trái, in hoa và dùng Gradient Xanh Đại Lâm Mộc sang Vàng Gold */
    h1, h2, h3, h4, .title-text {
        text-align: left !important;
        text-transform: uppercase !important;
        word-break: keep-all !important;
        white-space: nowrap !important;
        background: linear-gradient(135deg, #0F5132 0%, #198754 40%, #D4AF37 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 800;
        margin-bottom: 0.5rem;
    }
    
    /* Responsive cho mobile: nếu màn hình quá nhỏ thì cho phép cuộn ngang (overflow-x) để không bị mất chữ */
    @media only screen and (max-width: 600px) {
        h1, h2, h3, h4 {
            white-space: nowrap !important;
            overflow-x: auto !important;
            font-size: 1.5rem !important;
        }
    }

    /* Style cho Nút Submit (Vàng Gold kim loại sang Xanh) */
    .stButton>button {
        background: linear-gradient(135deg, #D4AF37 0%, #198754 100%);
        color: white;
        text-transform: uppercase;
        font-weight: bold;
        border: none;
        width: 100%;
        border-radius: 8px;
        padding: 10px;
    }
    .stButton>button:hover {
        background: linear-gradient(135deg, #198754 0%, #D4AF37 100%);
        color: white;
        box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    }

    /* Đóng khung thông tin từng người cho gọn gàng */
    .person-box {
        border-left: 4px solid #198754;
        padding-left: 15px;
        margin-bottom: 20px;
        background-color: #f9fbf9;
        padding: 15px;
        border-radius: 0 8px 8px 0;
    }
</style>
''', unsafe_allow_html=True)

# --- 2. KẾT NỐI GOOGLE SHEETS & CACHING ---
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]
SHEET_ID = "1Ae7zDMLKD3SSSJePBobjH8O8mUGkyp2bKXq-AyYBdJI"

@st.cache_resource
def get_gsheet_client():
    # Lấy thông tin xác thực từ Streamlit Secrets
    creds_dict = st.secrets["gcp_service_account"]
    creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
    client = gspread.authorize(creds)
    return client

@st.cache_data(ttl=60) # Caching 60 giây để tránh lỗi API Limit khi có quá nhiều lượt truy cập
def get_trip_data():
    client = get_gsheet_client()
    sheet = client.open_by_key(SHEET_ID)
    
    ws_input = sheet.worksheet("Input")
    ws_output = sheet.worksheet("Output")
    
    input_records = ws_input.get_all_records()
    output_records = ws_output.get_all_records()
    
    df_input = pd.DataFrame(input_records)
    df_output = pd.DataFrame(output_records)
    
    # Đếm số suất đã đăng ký
    booked_counts = {}
    if not df_output.empty and 'Đợt tham gia' in df_output.columns:
        booked_counts = df_output['Đợt tham gia'].value_counts().to_dict()
    
    trip_options = []
    blocks_info = []
    
    for index, row in df_input.iterrows():
        dot = str(row.get('Đợt', ''))
        ngay = str(row.get('Ngày hoạt động', ''))
        max_seats = int(row.get('Số suất tối đa', 0))
        
        # Tên đợt trong dropdown
        dot_name = f"{dot} - Ngày {ngay}"
        
        # Số suất đã đặt
        booked = booked_counts.get(dot_name, 0)
        remaining = max_seats - booked
        remaining = max(0, remaining) # Đảm bảo không âm
        
        blocks_info.append({
            "dot": dot,
            "ngay": ngay,
            "remaining": remaining
        })
        
        if remaining > 0:
            trip_options.append(dot_name)
            
    return trip_options, blocks_info, sheet.worksheet("Output")

# Lấy dữ liệu
try:
    trip_options, blocks_info, ws_output = get_trip_data()
except Exception as e:
    st.error("Hệ thống đang quá tải hoặc cấu hình Google Sheet chưa đúng. Vui lòng thử lại sau ít phút!")
    st.stop()

# --- 3. GIAO DIỆN PHẦN 1: TITLE & GIỚI THIỆU ---
st.markdown("<h1>ĐĂNG KÝ TRIP 'ĐÊM HUYỀN BÍ'</h1>", unsafe_allow_html=True)
st.markdown("<h3>THỜI GIAN: 13:00 - 22:00</h3>", unsafe_allow_html=True)

# Hiển thị số suất dưới dạng Block
cols = st.columns(len(blocks_info))
for i, block in enumerate(blocks_info):
    with cols[i]:
        # Hiển thị dạng metric đẹp mắt
        st.metric(label=f"{block['dot']} ({block['ngay']})", value=f"{block['remaining']} suất")

st.divider()

st.markdown("<h2>1. THÔNG TIN TRIP</h2>", unsafe_allow_html=True)
st.markdown('''
🦎🐸 **"Đêm huyền bí"** 🐍🦜 là một trải nghiệm đầy mê hoặc, mở ra cánh cửa vào một thế giới bí ẩn khó có thể nhìn thấy vào ban ngày. Các loài sinh vật ban đêm sẽ hiện ra trước mắt bạn đầy ấn tượng và lôi cuốn. Cảm nhận không khí trong lành, những dấu vết của các loài thú lớn để lại trên đường đi, hay sự ngụy trang tài tình của các loài sinh vật nhỏ bé sẽ dần lộ diện để bạn khám phá những bí mật ẩn sâu bên trong khu rừng. Mỗi bước chân sẽ là một cuộc phiêu lưu, một cơ hội để bạn tìm hiểu và kết nối sâu sắc hơn với thế giới tự nhiên đầy lý thú này.

🐝🐃🦗 Trong hành trình "Đêm huyền bí" 🐌🕷️🐚, bạn sẽ được trang bị đèn pin và có sự hướng dẫn của các chuyên gia dày dặn kinh nghiệm cùng kiểm lâm địa phương để khám phá những điều thú vị về các loài sinh vật trong đêm tối một cách an toàn, trực quan.

❤️‍🔥 **Chương trình dành cho độ tuổi từ 5 - 99 tuổi**
🌟🌟 **ĐẶC BIỆT** 🌟🌟 trẻ từ 8 tuổi trở lên có thể tự đi một mình, KHÔNG BẮT BUỘC phụ huynh đi cùng *(khuyến khích phụ huynh nên tham gia cùng con trải nghiệm để có thêm sự gắn kết và thấu hiểu)*.

Xin trân trọng cảm ơn!
Mọi thông tin được cập nhật tại:
📺 Fanpage: https://facebook.com/natureandme.vn
☎️ Điện thoại: 0902.800.318

**Cùng bạn Khang khám phá xem khu rừng về đêm sẽ có những gì nhé!**
''')

# Nhúng YouTube - Tối ưu performance bằng lazy loading của Streamlit
st.video("https://www.youtube.com/watch?v=AqoJWlIdqng&t=2s")

st.markdown('''
**THÔNG TIN TRIP**
- **Độ tuổi:** phù hợp từ 5 tuổi trở lên, người lớn cũng có thể tham gia.
      + trẻ từ 8 tuổi trở lên có thể tự đi một mình
      + trẻ từ 5-7 tuổi cần phụ huynh đi cùng, đóng phí cho trẻ và phụ huynh
- **Thời gian:** 13:00 - 22:00 (khởi hành tại Quận 1, đi về trong ngày, không qua đêm)
- **Địa điểm:** Rừng Mã Đà, thuộc Khu bảo tồn Thiên nhiên - Văn hóa Đồng Nai
- **Phí tham gia:** 880.000đ / người (bao gồm bảo hiểm, xe đưa đón, ăn nhẹ trên xe, ăn tối, đèn pin, áo mưa, nước uống, tham quan Bảo tàng, phí dịch vụ vào Khu bảo tồn...)

**LỊCH TRÌNH**
- **12h45:** tập trung tại Cung văn hóa lao động (55B Nguyễn Thị Minh Khai, Quận 1)
- **13h00:** khởi hành, di chuyển đến Khu bảo tồn Thiên nhiên - Văn hóa Đồng Nai (xe có thêm điểm đón ở Q2, Q9 và Đồng Nai)
- **15h00:** tham quan Bảo tàng "Đa dạng sinh học rừng Mã Đà"
- **16h30:** di chuyển vào rừng Mã Đà
- **17h00:** ăn tối, nhận đèn pin, dặn dò
- **17h45:** trải nghiệm "Đêm huyền bí" cùng các chuyên gia (tầm 1 - 2 km)
- **20h00:** di chuyển về lại Cung văn hóa lao động
- **22h00:** trả khách tại Cung văn hóa lao động
''')

st.divider()

# --- 4. GIAO DIỆN PHẦN 2: FORM ĐĂNG KÝ ---
st.markdown("<h2>2. THÔNG TIN ĐĂNG KÝ</h2>", unsafe_allow_html=True)

if not trip_options:
    st.error("Rất tiếc! Hiện tại tất cả các đợt đều đã hết suất đăng ký.")
    st.stop()

# Đặt số lượng người ở ngoài form để UI tự động render số ô nhập liệu tương ứng
num_people = st.number_input("Bạn muốn đăng ký bao nhiêu người ạ?", min_value=1, max_value=20, value=1, step=1)

# Tạo Form để submit 1 lần tránh reload trang liên tục
with st.form("registration_form"):
    
    st.markdown("#### THÔNG TIN NGƯỜI THAM GIA")
    
    participants = []
    for i in range(num_people):
        st.markdown(f"<div class='person-box'><b>👤 Người thứ {i+1}</b>", unsafe_allow_html=True)
        col1, col2 = st.columns([2, 1])
        with col1:
            name = st.text_input(f"Họ và tên", key=f"name_{i}")
        with col2:
            # Dùng text_input hoặc number cho năm sinh
            yob = st.text_input(f"Năm sinh", key=f"yob_{i}", placeholder="VD: 1990")
        st.markdown("</div>", unsafe_allow_html=True)
        participants.append({"name": name, "yob": yob})
        
    st.markdown("#### THÔNG TIN LIÊN LẠC & CHỌN ĐỢT")
    phone = st.text_input("Số điện thoại liên hệ (Đại diện)", placeholder="VD: 0902800318")
    backup_phone = st.text_input("Số điện thoại dự phòng (Không bắt buộc)")
    
    selected_trip = st.selectbox("Đăng ký tham gia đợt:", options=trip_options)
    
    st.markdown("#### MIỄN TRỪ TRÁCH NHIỆM")
    disclaimer_text = '''Trong quá trình trải nghiệm, luôn có 3-4 người trong Ban tổ chức đi đầu, giữa và chốt đoàn để đảm bảo an toàn, hướng dẫn quan sát trải nghiệm cho đoàn tránh bị côn trùng, nhện, rắn... cắn (rủi ro bị cắn rất thấp). Người tham gia đã được thông báo về những rủi ro này, đồng ý tham gia trip và miễn trừ trách nhiệm, miễn bồi thường thiệt hại đối với các cá nhân, đơn vị tổ chức chương trình này nếu có tai nạn, rủi ro xảy ra đối với bản thân, tài sản của người tham gia và của người thân đi cùng.'''
    st.info(disclaimer_text)
    
    is_agreed = st.checkbox("Tôi đã đọc, hiểu rõ và đồng ý với các nội dung miễn trừ trách nhiệm nêu trên.")
    
    # Nút Submit
    submitted = st.form_submit_button("XÁC NHẬN ĐĂNG KÝ")

# --- XỬ LÝ LOGIC KHI SUBMIT ---
if submitted:
    # 1. Validate dữ liệu
    has_error = False
    for i, p in enumerate(participants):
        if not p['name'].strip() or not p['yob'].strip():
            st.error(f"Vui lòng điền đầy đủ Họ tên và Năm sinh cho người thứ {i+1}.")
            has_error = True
            
    if not phone.strip():
        st.error("Vui lòng nhập Số điện thoại liên hệ.")
        has_error = True
        
    if not is_agreed:
        st.error("Bạn cần tick chọn Đồng ý với điều khoản miễn trừ trách nhiệm để tiếp tục.")
        has_error = True
        
    if not has_error:
        with st.spinner("Đang xử lý đăng ký của bạn..."):
            # Chuẩn bị dữ liệu ghi vào Google Sheets
            timestamp = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            # Prefix dấu nháy đơn ' để Google Sheet không làm mất số 0 ở đầu SĐT
            safe_phone = f"'{phone}" 
            safe_backup = f"'{backup_phone}" if backup_phone else ""
            
            rows_to_insert = []
            for p in participants:
                row = [
                    timestamp,
                    p['name'],
                    p['yob'],
                    safe_phone,
                    safe_backup,
                    selected_trip,
                    "Đã đồng ý"
                ]
                rows_to_insert.append(row)
                
            # Cơ chế Retry (Thử lại 3 lần nếu API Google bị nghẽn)
            success = False
            for attempt in range(3):
                try:
                    # Ghi nhiều dòng cùng 1 lúc (append_rows) hiệu quả hơn ghi từng dòng
                    ws_output.append_rows(rows_to_insert, value_input_option='USER_ENTERED')
                    success = True
                    break
                except Exception as e:
                    time.sleep(2) # Đợi 2 giây trước khi thử lại
            
            if success:
                st.success("🎉 Đăng ký thành công! Vui lòng xem thông tin chuẩn bị và thanh toán bên dưới.")
                st.balloons()
                # Xóa cache để cập nhật lại số suất trống ngay lập tức
                st.cache_data.clear()
            else:
                st.error("Hệ thống Google đang bận, vui lòng thử lại sau giây lát!")

st.divider()

# --- 5. GIAO DIỆN PHẦN 3: VẬT DỤNG & THANH TOÁN ---
st.markdown("<h2>3. CHUẨN BỊ & THANH TOÁN</h2>", unsafe_allow_html=True)
st.markdown('''
**CHUẨN BỊ VẬT DỤNG CHO TỪNG CÁ NHÂN**
1️⃣ Áo quần dài 🥼👖 dùng che chắn tay chân tránh cây gai, côn trùng đốt
2️⃣ Giày ba-ta 🥾+ vớ cao 🧦 tự tin sải bước
3️⃣ Sổ tay 📔 và bút 🖊️ dùng ghi chép các thông tin liên quan đến chuyến đi và sinh vật khám phá được
4️⃣ Balo gọn nhẹ 🎒 chứa các vật dụng cần thiết (bình nước, áo mưa, sổ bút) cho quá trình đi trip
5️⃣ Bình nước cá nhân 🥤cần tối thiểu 500ml (BTC có dự phòng nếu phụ huynh quên)
6️⃣ Áo mưa cá nhân 🧥 dự phòng có mưa bất chợt (BTC có dự phòng nếu phụ huynh quên)
7️⃣ Đèn pin đeo đầu 🔦 để soi đường và quan sát trong quá trình hiking (BTC trang bị, cung cấp cho người tham gia lúc ăn tối)

**THÔNG TIN THANH TOÁN**
- **Tài khoản:** To Van Quang _ Vietcombank _ 0251001799405
- **Nội dung chuyển khoản:** Tripdem - Tên người đăng kí - Số điện thoại *(Ví dụ: Tripdem Quang 0902800318)*
- **Lưu ý:** Sau khi hoàn tất thanh toán, BTC sẽ liên hệ xác nhận đã đăng kí thành công!
''')

# Hiển thị QR Code (cùng thư mục với app.py hoặc dùng link ảnh)
try:
    st.image("unnamed.jpg", caption="Quét mã QR để thanh toán", width=300)
except FileNotFoundError:
    st.warning("*(Lưu ý: Bạn cần đặt file hình QR code tên 'unnamed.jpg' vào cùng thư mục với code để hiển thị tại đây)*")
