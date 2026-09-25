// XỬ LÝ RENDER VIEW CHO TRA CỨU
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
                    <div style="color: #091221; font-size: 1.1rem; margin-top: 5px; font-weight: 600;">Số tiền đối soát: <span style="color: #D32F2F; font-weight: 900;">${blockData.totalMoney.toLocaleString('vi-VN')} VNĐ</span></div>
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
