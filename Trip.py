import streamlit as st
import gspread
from google.oauth2.service_account import Credentials
import pandas as pd
import time
from datetime import datetime
import pytz

# --- 1. CẤU HÌNH TRANG & CSS CƠ BẢN ---
st.set_page_config(page_title="Đăng Ký Trip Đêm Huyền Bí", page_icon="🌿", layout="centered")

# Khởi tạo Session State cho các bước
if 'step' not in st.session_state:
    st.session_state.step = 1

def change_step(new_step):
    st.session_state.step = new_step

step = st.session_state.step

# Setup màu gradient và màu xám cho Chevron Bar
active_bg = "linear-gradient(135deg, #0F5132 0%, #198754 40%, #D4AF37 100%)"
inactive_bg = "#E0E0E0"
active_text = "#FFFFFF"
inactive_text = "#666666"

st.markdown(f"""
<style>
    .nowrap-text {{ word-break: keep-all !important; white-space: nowrap !important; }}
    @media only screen and (max-width: 600px) {{
        .nowrap-text {{ white-space: nowrap !important; overflow-x: auto !important; }}
    }}
    
    .page-title {{
        text-align: left; text-transform: uppercase;
        background: linear-gradient(135deg, #0F5132 0%, #198754 40%, #D4AF37 100%);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        font-weight: 900; font-size: 2.2rem; margin-bottom: 0.2rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
    }}
    .page-subtitle {{ text-align: left; color: #D4AF37; font-weight: bold; font-size: 1.2rem; margin-bottom: 2rem; }}
    
    .section-title {{
        text-align: left; text-transform: uppercase; color: #0F5132; font-weight: 800; font-size: 1.5rem;
        margin-top: 1.5rem; margin-bottom: 1rem; border-bottom: 2px solid #D4AF37; padding-bottom: 5px;
    }}
    
    .slot-card {{ border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 10px; overflow: hidden; }}
    .slot-header {{
        background: linear-gradient(135deg, #0F5132 0%, #198754 100%); color: white; text-align: center;
        padding: 6px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; font-size: 0.9rem;
    }}
    .slot-body {{
        background-color: #f9fbf9; text-align: center; padding: 8px; border: 1px solid #198754;
        border-top: none; border-radius: 0 0 6px 6px; font-size: 1rem; color: #333;
    }}
    .slot-highlight {{ color: #0F5132; font-size: 1.6rem; font-weight: 900; margin: 0 6px; }}
    
    .person-box {{ border-left: 4px solid #D4AF37; padding-left: 15px; margin-bottom: 20px; background-color: #faf8f5; padding: 15px; border-radius: 0 8px 8px 0; }}
    .info-card {{ text-align: center; padding: 15px 5px; background-color: #f0f7f4; border-radius: 8px; height: 100%; border-bottom: 3px solid #198754; }}
    .info-title {{ font-weight: bold; color: #0F5132; margin-bottom: 5px; font-size: 0.9rem; text-transform: uppercase; }}
    .info-desc {{ font-size: 0.85rem; color: #444; }}
    .timeline-item {{ margin-bottom: 10px; padding-left: 15px; border-left: 2px dashed #D4AF37; }}
    .timeline-time {{ font-weight: bold; color: #198754; width: 60px; display: inline-block; }}
    .prep-card {{
        text-align: center; padding: 15px 10px; background-color: #ffffff; border: 1px solid #e0e0e0;
        border-radius: 12px; margin-bottom: 15px; height: 90%; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: transform 0.2s;
    }}
    .prep-card:hover {{ transform: translateY(-3px); border-color: #D4AF37; }}
    .prep-title {{ font-weight: bold; color: #0F5132; margin-bottom: 5px; font-size: 0.9rem; }}
    .prep-desc {{ font-size: 0.8rem; color: #666; line-height: 1.4; }}
    
    /* ======================================================== */
    /* 1. NÚT ĐIỀU HƯỚNG BÊN DƯỚI (Tiếp tục, Quay lại, Submit)  */
    /* ======================================================== */
    div.st-key-btn_next_12 button, div.st-key-btn_back_21 button, 
    div.st-key-btn_next_23 button, div.st-key-btn_submit button {{
        background: linear-gradient(135deg, #D4AF37 0%, #198754 100%) !important; 
        color: white !important; text-transform: uppercase;
        font-weight: bold; border: none !important; width: 100%; border-radius: 8px; padding: 12px; margin-top: 10px;
    }}
    div.st-key-btn_next_12 button:hover, div.st-key-btn_back_21 button:hover, 
    div.st-key-btn_next_23 button:hover, div.st-key-btn_submit button:hover {{ 
        background: linear-gradient(135deg, #198754 0%, #D4AF37 100%) !important; 
        box-shadow: 0 4px 10px rgba(0,0,0,0.2) !important; color: white !important;
    }}

    /* ========================================= */
    /* 2. CHEVRON PROGRESS BAR CỦA RIÊNG MARKETING =)) */
    /* ========================================= */
    
    /* Ép các khối dính liền nhau, cho phép hiển thị tràn viền (overlap) */
    div[data-testid="stHorizontalBlock"]:has(div.st-key-step1) {{
        position: sticky; top: 2.875rem; z-index: 9999;
        background: white; padding: 15px 0 10px 0; gap: 0px !important; margin-bottom: 20px;
    }}
    div[data-testid="stHorizontalBlock"]:has(div.st-key-step1) > div[data-testid="column"] {{
        padding: 0px !important; gap: 0px !important;
        overflow: visible !important; /* Để mũi tên này đâm sang cột kia không bị cắt */
    }}
    
    /* Reset sạch thuộc tính mặc định của Streamlit cho 3 nút Chevron */
    div.st-key-step1 button, div.st-key-step2 button, div.st-key-step3 button {{
        height: 55px !important; width: 100% !important; border: none !important; 
        border-radius: 0 !important; margin: 0 !important; box-shadow: none !important;
    }}
    
    /* Ép chữ xuống 2 dòng chuẩn chỉ */
    div.st-key-step1 button p, div.st-key-step2 button p, div.st-key-step3 button p {{
        white-space: pre-line !important; /* Bắt buộc để nhận \\n */
        line-height: 1.2 !important; font-size: 0.85rem !important; 
        font-weight: 800 !important; margin: 0 !important; text-align: center !important;
    }}

    /* Xóa viền đỏ mặc định của Streamlit khi hover */
    div.st-key-step1 button:hover, div.st-key-step2 button:hover, div.st-key-step3 button:hover,
    div.st-key-step1 button:focus, div.st-key-step2 button:focus, div.st-key-step3 button:focus {{
        border-color: transparent !important; opacity: 0.8 !important;
    }}

    /* MŨI TÊN BƯỚC 1 */
    div.st-key-step1 button {{
        background: {active_bg if step == 1 else inactive_bg} !important;
        clip-path: polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%) !important;
        padding-right: 15px !important; /* Đẩy chữ tránh cái nhọn mũi tên */
    }}
    div.st-key-step1 button p {{ color: {active_text if step == 1 else inactive_text} !important; }}
    
    /* MŨI TÊN BƯỚC 2 (Overlap đè sang bước 1) */
    div.st-key-step2 button {{
        background: {active_bg if step == 2 else inactive_bg} !important;
        clip-path: polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%, 10% 50%) !important;
        margin-left: -5% !important; width: 105% !important; /* Kéo đè lên đuôi bước 1 */
        padding-left: 20px !important; padding-right: 15px !important;
    }}
    div.st-key-step2 button p {{ color: {active_text if step == 2 else inactive_text} !important; }}
    
    /* MŨI TÊN BƯỚC 3 */
    div.st-key-step3 button {{
        background: {active_bg if step == 3 else inactive_bg} !important;
        clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 10% 50%) !important;
        margin-left: -10% !important; width: 110% !important; /* Kéo đè lên đuôi bước 2 */
        padding-left: 25px !important;
    }}
    div.st-key-step3 button p {{ color: {active_text if step == 3 else inactive_text} !important; }}

</style>
""", unsafe_allow_html=True)

# --- 2. KẾT NỐI GOOGLE SHEETS & CACHING ---
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
SHEET_ID = "1Ae7zDMLKD3SSSJePBobjH8O8mUGkyp2bKXq-AyYBdJI"
VN_TZ = pytz.timezone('Asia/Ho_Chi_Minh')

@st.cache_resource
def get_gsheet_client():
    creds_dict = st.secrets["gcp_service_account"]
    creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
    return gspread.authorize(creds)

@st.cache_data(ttl=60)
def get_trip_data():
    client = get_gsheet_client()
    sheet = client.open_by_key(SHEET_ID)
    ws_input = sheet.worksheet("Input")
    ws_output = sheet.worksheet("Output")
    df_input = pd.DataFrame(ws_input.get_all_records())
    df_output = pd.DataFrame(ws_output.get_all_records())
    booked_counts = {}
    if not df_output.empty and 'Đợt tham gia' in df_output.columns:
        booked_counts = df_output['Đợt tham gia'].value_counts().to_dict()
    
    trip_options, blocks_info = [], []
    for _, row in df_input.iterrows():
        dot, ngay = str(row.get('Đợt', '')), str(row.get('Ngày hoạt động', ''))
        max_seats = int(row.get('Số suất tối đa', 0))
        dot_name = f"{dot} - Ngày {ngay}"
        remaining = max(0, max_seats - booked_counts.get(dot_name, 0))
        blocks_info.append({"dot": dot, "ngay": ngay, "remaining": remaining})
        if remaining > 0: trip_options.append(dot_name)
    return trip_options, blocks_info, ws_output

try:
    trip_options, blocks_info, ws_output = get_trip_data()
except Exception as e:
    st.error("Hệ thống đang bận. Vui lòng thử lại!")
    st.stop()

# --- 3. TITLE & SỐ SUẤT ---
st.markdown("<div class='page-title nowrap-text'>ĐĂNG KÝ TRIP ĐÊM HUYỀN BÍ</div>", unsafe_allow_html=True)
st.markdown("<div class='page-subtitle'>THỜI GIAN: 13:00 - 22:00</div>", unsafe_allow_html=True)

cols = st.columns(len(blocks_info))
for i, block in enumerate(blocks_info):
    with cols[i]:
        st.markdown(f"<div class='slot-card'><div class='slot-header'>{block['dot']} ({block['ngay']})</div><div class='slot-body'>Còn <span class='slot-highlight'>{block['remaining']}</span> suất</div></div>", unsafe_allow_html=True)


# --- CHEVRON NAVIGATION BAR ---
nav_c1, nav_c2, nav_c3 = st.columns(3)
nav_c1.button("BƯỚC 1\nTHÔNG TIN TRIP", key="step1", on_click=change_step, args=(1,))
nav_c2.button("BƯỚC 2\nLỊCH TRÌNH & VẬT DỤNG", key="step2", on_click=change_step, args=(2,))
nav_c3.button("BƯỚC 3\nĐĂNG KÝ", key="step3", on_click=change_step, args=(3,))


# --- NỘI DUNG TỪNG BƯỚC ---
if step == 1:
    st.markdown("<div class='section-title nowrap-text'>LỜI GIỚI THIỆU</div>", unsafe_allow_html=True)
    st.markdown("""
    🦎🐸“Đêm huyền bí”🐍🦜 là một trải nghiệm đầy mê hoặc, mở ra cánh cửa vào một thế giới bí ẩn khó có thể nhìn thấy vào ban ngày. Các loài sinh vật ban đêm sẽ hiện ra trước mắt bạn đầy ấn tượng và lôi cuốn. Cảm nhận không khí trong lành, những dấu vết của các loài thú lớn để lại trên đường đi, hay sự ngụy trang tài tình của các loài sinh vật nhỏ bé sẽ dần lộ diện để bạn khám phá những bí mật ẩn sâu bên trong khu rừng. Mỗi bước chân sẽ là một cuộc phiêu lưu, một cơ hội để bạn tìm hiểu và kết nối sâu sắc hơn với thế giới tự nhiên đầy lý thú này.<br><br>
    🐝🐃🦗Trong hành trình “Đêm huyền bí”🐌🕷️🐚, bạn sẽ được trang bị đèn pin và có sự hướng dẫn của các chuyên gia dày dặn kinh nghiệm cùng kiểm lâm địa phương để khám phá những điều thú vị về các loài sinh vật trong đêm tối một cách an toàn, trực quan.<br><br>
    ❤️‍🔥 Chương trình dành cho độ tuổi từ 5 -- 99 tuổi.<br>
    🌟🌟 <b>ĐẶC BIỆT</b> 🌟🌟 trẻ từ 8 tuổi trở lên có thể tự đi một mình, KHÔNG BẮT BUỘC phụ huynh đi cùng <i>(khuyến khích phụ huynh nên tham gia cùng con trải nghiệm để có thêm sự gắn kết và thấu hiểu)</i>.<br><br>
    Xin trân trọng cảm ơn!<br>
    Mọi thông tin được cập nhật tại:<br>
    📺Fanpage: https://facebook.com/natureandme.vn<br>
    ☎️Điện thoại: 0902.800.318<br><br>
    <b>Cùng bạn Khang khám phá xem khu rừng về đêm sẽ có những gì nhé!</b>
    """, unsafe_allow_html=True)

    st.video("https://www.youtube.com/watch?v=AqoJWlIdqng&t=2s")

    st.markdown("<div class='section-title nowrap-text'>THÔNG TIN TRIP</div>", unsafe_allow_html=True)
    c1, c2, c3, c4 = st.columns(4)
    c1.markdown("<div class='info-card'><div class='info-title'>Độ tuổi</div><div class='info-desc'>Từ 5 tuổi trở lên.<br>Trẻ ≥8 tuổi tự đi được.<br>Trẻ 5-7 tuổi cần phụ huynh.</div></div>", unsafe_allow_html=True)
    c2.markdown("<div class='info-card'><div class='info-title'>Thời gian</div><div class='info-desc'>13:00 - 22:00<br>Đi về trong ngày.<br>Khởi hành tại Q1.</div></div>", unsafe_allow_html=True)
    c3.markdown("<div class='info-card'><div class='info-title'>Địa điểm</div><div class='info-desc'>Rừng Mã Đà<br>Khu bảo tồn Thiên nhiên<br>Đồng Nai.</div></div>", unsafe_allow_html=True)
    c4.markdown("<div class='info-card'><div class='info-title'>Chi phí</div><div class='info-desc'>880.000đ / người<br>Bao gồm xe, ăn uống, bảo hiểm...</div></div>", unsafe_allow_html=True)
    
    st.divider()
    st.button("TIẾP TỤC: LỊCH TRÌNH & VẬT DỤNG", key="btn_next_12", on_click=change_step, args=(2,), use_container_width=True)

elif step == 2:
    st.markdown("<div class='section-title nowrap-text'>1. LỊCH TRÌNH</div>", unsafe_allow_html=True)
    st.markdown("""
    <div class='timeline-item'><span class='timeline-time'>12h45</span> Tập trung tại Cung văn hóa lao động (55B Nguyễn Thị Minh Khai, Q1)</div>
    <div class='timeline-item'><span class='timeline-time'>13h00</span> Khởi hành đến Khu bảo tồn TN-VH Đồng Nai</div>
    <div class='timeline-item'><span class='timeline-time'>15h00</span> Tham quan Bảo tàng "Đa dạng sinh học rừng Mã Đà"</div>
    <div class='timeline-item'><span class='timeline-time'>16h30</span> Di chuyển vào rừng Mã Đà</div>
    <div class='timeline-item'><span class='timeline-time'>17h00</span> Ăn tối, nhận đèn pin, dặn dò</div>
    <div class='timeline-item'><span class='timeline-time'>17h45</span> Trải nghiệm "Đêm huyền bí" cùng các chuyên gia</div>
    <div class='timeline-item'><span class='timeline-time'>20h00</span> Di chuyển về lại Cung văn hóa lao động</div>
    <div class='timeline-item'><span class='timeline-time'>22h00</span> Trả khách tại Cung văn hóa lao động</div>
    """, unsafe_allow_html=True)

    st.markdown("<div class='section-title nowrap-text'>2. CHUẨN BỊ VẬT DỤNG</div>", unsafe_allow_html=True)
    def render_prep(title, desc): return f"<div class='prep-card'><div class='prep-title'>{title}</div><div class='prep-desc'>{desc}</div></div>"
    
    r1c1, r1c2, r1c3 = st.columns(3)
    r1c1.markdown(render_prep("Áo quần dài", "Dùng che chắn tay chân tránh cây gai, côn trùng đốt"), unsafe_allow_html=True)
    r1c2.markdown(render_prep("Giày ba-ta + vớ cao", "Tự tin sải bước"), unsafe_allow_html=True)
    r1c3.markdown(render_prep("Sổ tay và bút", "Ghi chép thông tin liên quan đến chuyến đi và sinh vật"), unsafe_allow_html=True)
    r2c1, r2c2, r2c3 = st.columns(3)
    r2c1.markdown(render_prep("Balo gọn nhẹ", "Chứa các vật dụng cần thiết (bình nước, áo mưa, sổ bút)"), unsafe_allow_html=True)
    r2c2.markdown(render_prep("Bình nước", "Tối thiểu 500ml (BTC có dự phòng nếu quên)"), unsafe_allow_html=True)
    r2c3.markdown(render_prep("Áo mưa", "Dự phòng mưa bất chợt (BTC có dự phòng nếu quên)"), unsafe_allow_html=True)
    _, r3c2, _ = st.columns(3)
    r3c2.markdown(render_prep("Đèn pin đeo đầu", "Soi đường và quan sát (BTC trang bị lúc ăn tối)"), unsafe_allow_html=True)
    
    st.divider()
    b1, b2 = st.columns(2)
    b1.button("QUAY LẠI: THÔNG TIN TRIP", key="btn_back_21", on_click=change_step, args=(1,), use_container_width=True)
    b2.button("TIẾP TỤC: ĐĂNG KÝ", key="btn_next_23", on_click=change_step, args=(3,), use_container_width=True)

elif step == 3:
    st.markdown("<div class='section-title nowrap-text'>THÔNG TIN ĐĂNG KÝ</div>", unsafe_allow_html=True)
    if not trip_options:
        st.error("Rất tiếc! Hiện tại tất cả các đợt đều đã hết suất đăng ký.")
        st.stop()
        
    num_people = st.number_input("Bạn muốn đăng ký bao nhiêu người ạ?", min_value=1, max_value=20, value=1, step=1)
    
    with st.form("registration_form"):
        st.markdown("#### THÔNG TIN NGƯỜI THAM GIA")
        participants = []
        for i in range(num_people):
            st.markdown(f"<div class='person-box'><b>👤 Người thứ {i+1}</b>", unsafe_allow_html=True)
            col1, col2 = st.columns([2, 1])
            with col1: name = st.text_input(f"Họ và tên", key=f"name_{i}")
            with col2: yob = st.text_input(f"Năm sinh", key=f"yob_{i}")
            st.markdown("</div>", unsafe_allow_html=True)
            participants.append({"name": name, "yob": yob})
            
        st.markdown("#### THÔNG TIN LIÊN LẠC & CHỌN ĐỢT")
        phone = st.text_input("Số điện thoại liên hệ (Đại diện)", placeholder="VD: 0902800318")
        backup_phone = st.text_input("Số điện thoại dự phòng (Không bắt buộc)")
        selected_trip = st.selectbox("Đăng ký tham gia đợt:", options=trip_options)
        
        st.markdown("---")
        st.markdown("#### THÔNG TIN THANH TOÁN")
        st.markdown("- **Tài khoản:** To Van Quang _ Vietcombank _ 0251001799405\n- **Nội dung CK:** Tripdem - Tên người đăng kí - Số điện thoại *(Ví dụ: Tripdem Quang 0902800318)*")
        try: st.image("unnamed.jpg", caption="Quét mã QR để thanh toán", width=250)
        except: pass
        st.info("📌 Vui lòng chuyển khoản trước và đính kèm hình ảnh màn hình giao dịch thành công (Bill) bên dưới.")
        receipt_file = st.file_uploader("Tải lên Bill thanh toán", type=['png', 'jpg', 'jpeg'])
        
        st.markdown("---")
        st.markdown("#### MIỄN TRỪ TRÁCH NHIỆM")
        st.warning("Trong quá trình trải nghiệm, luôn có 3-4 người trong Ban tổ chức đi đầu, giữa và chốt đoàn để đảm bảo an toàn, hướng dẫn quan sát trải nghiệm cho đoàn tránh bị côn trùng, nhện, rắn... cắn (rủi ro bị cắn rất thấp). Người tham gia đã được thông báo về những rủi ro này, đồng ý tham gia trip và miễn trừ trách nhiệm, miễn bồi thường thiệt hại đối với các cá nhân, đơn vị tổ chức chương trình này nếu có tai nạn, rủi ro xảy ra đối với bản thân, tài sản của người tham gia và của người thân đi cùng.")
        is_agreed = st.checkbox("Tôi đã đọc, hiểu rõ và đồng ý với các nội dung miễn trừ trách nhiệm nêu trên.")
        
        submitted = st.form_submit_button("XÁC NHẬN ĐĂNG KÝ", type="secondary")

    # --- XỬ LÝ SUBMIT ---
    if submitted:
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
            with st.spinner("Đang xử lý đăng ký..."):
                timestamp = datetime.now(VN_TZ).strftime("%d/%m/%Y %H:%M:%S")
                safe_phone = f"'{phone}" 
                safe_backup = f"'{backup_phone}" if backup_phone else ""
                bill_status = "Đã đính kèm Bill" if receipt_file is not None else "Chưa có Bill"
                
                # TẠO BOOKING ID
                booking_id = f"BK-{datetime.now(VN_TZ).strftime('%H%M%S')}"
                
                rows_to_insert = []
                for p in participants:
                    row = [timestamp, p['name'], p['yob'], safe_phone, safe_backup, selected_trip, "Đã đồng ý", bill_status, booking_id]
                    rows_to_insert.append(row)
                    
                success = False
                for attempt in range(3):
                    try:
                        ws_output.append_rows(rows_to_insert, value_input_option='USER_ENTERED')
                        success = True
                        break
                    except Exception as e: time.sleep(2)
                    
                if success:
                    st.success("🎉 Đăng ký thành công! BTC sẽ liên hệ xác nhận lại với bạn sớm nhất.")
                    st.balloons()
                    st.cache_data.clear()
                    st.session_state.step = 1 # Reset về bước 1
                else: 
                    st.error("Hệ thống Google đang bận, vui lòng thử lại sau giây lát!")
