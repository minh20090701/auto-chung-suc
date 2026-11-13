# Chung Sức Shop V4 — Vercel + Supabase + SePay

**Bản thử nghiệm tích hợp, chưa sẵn sàng nhận tiền thật.** Giao diện khách đăng ký/đăng nhập, ví riêng, QR nạp, lịch sử đơn và nạp, danh mục giá bán, quản trị. Backend Chung Sức chính thức (`api/v1.php`) giữ API key trên server; khách không có mục Kết nối API hay mật khẩu quản trị chung. Giá vốn chỉ admin thấy. Gói sản phẩm một suất/mã (tối đa 200), đặt lẻ một mã theo lượt/gói. Chỉ bật dịch vụ hợp lệ, cố định, được phép bán lại; không tích hợp mua acc clone, mở rương riêng hoặc hoạt động may rủi.

## 0. Điều kiện
- Vercel Hobby chỉ cho dự án cá nhân/phi thương mại; cần gói phù hợp (Pro hoặc hosting cho kinh doanh) trước khi bán có thu tiền. https://vercel.com/legal/terms
- Kiểm tra điều khoản Chung Sức về bán lại, điều khoản trò chơi, ngân hàng và SePay, nghĩa vụ kinh doanh/thuế/quyền riêng tư tại nơi hoạt động. Nếu chưa đủ tuổi giao kết dịch vụ, nhờ phụ huynh/người giám hộ hỗ trợ đúng quy định, không dùng thông tin/giấy tờ người khác để vượt điều kiện. Chỉ nhận tiền qua tài khoản hợp lệ do chủ tài khoản cho phép.
- Mô hình ví chỉ là tín dụng mua dịch vụ tại shop, không chuyển giữa khách, không rút tiền qua web. Cần chính sách hoàn tiền, xử lý nạp nhầm và kênh hỗ trợ trước khi mở bán.
- Giả định chi phí 1 Xu nhà cung cấp = 1 VNĐ khi quy đổi; đối chiếu tỷ lệ nạp thực, phí, chiết khấu trước khi đặt giá. Chênh lệch dự kiến không phải lợi nhuận ròng. Tiền ngân hàng khách chuyển tới shop, không tự nạp vào Chung Sức; phải duy trì số dư nhà cung cấp bằng nguồn hợp lệ.

## 1. Upload
Giải nén ZIP. Dùng repo Vercel hiện có `auto-chung-suc`, upload/thay file theo đúng đường dẫn (không thay toàn bộ repo bằng một thư mục con). Giữ `public/.well-known/chungsucliqi-verify.txt` nếu đã xác minh. Không upload `.env` thật. V4 thay `api/gateway.js`; xóa `lib/chungsuc.js` cũ (không còn dùng) và tests/scripts cũ nếu muốn sạch repo. Không có endpoint quản trị bằng APP_PASSWORD nữa. Vercel tự build `npm run build`, output `public`, Other, Node 22. Tránh deploy public bản V4 cho đến khi cấu hình Auth/giới hạn xong; hai cờ live mặc định false.

## 2. Supabase (database và Auth)
1. Tạo project **mới** trên https://supabase.com/dashboard; dùng project test riêng biệt với production. SQL Editor → New query → dán toàn bộ `supabase/schema.sql` → Run. Tạo 6 bảng, các RPC ví và đơn, bật RLS, không cấp quyền dữ liệu trực tiếp cho anon/authenticated. Không dùng service_role ở frontend.
2. Authentication → Providers → Email: bật email/password và Confirm email. URL Configuration: Site URL = URL Vercel thật, ví dụ `https://auto-chung-suc-virid.vercel.app`, thêm redirect URL tương ứng. Cấu hình SMTP hợp lệ (dịch vụ email mặc định giới hạn và dành thử nghiệm). Mật khẩu tối thiểu 10 ký tự; cân nhắc CAPTCHA/rate limit, MFA admin và email reset trước production.
3. Project Settings → API Keys: lấy Project URL và **legacy anon + service_role JWT** (code này dùng các key đó). Không gửi key thật lên chat. Thêm env trên Vercel (Production). `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Nếu đã dùng new publishable/secret keys, adapter này chưa kiểm tra tương thích; dùng legacy keys trong giai đoạn test hoặc cập nhật adapter theo tài liệu Supabase.
4. Redeploy. Đăng ký tài khoản admin bằng email bạn kiểm soát, xác nhận email, đăng nhập. Supabase → Authentication → Users → copy UUID của admin; thêm `ADMIN_USER_ID` đúng UUID đó. Redeploy, đăng nhập lại; nút Quản trị hiện ra. Không tự đặt role từ trình duyệt.
5. Test SQL: sau khi tạo test user trong project test, chạy `supabase/smoke-test.sql` để kiểm tra cộng/trừ/hoàn/khóa trùng trong một transaction rollback. Chưa chạy script này trên DB thật.

## 3. Vercel Environment Variables
| Key | Giá trị |
|---|---|
| SUPABASE_URL | URL project dạng https://xxx.supabase.co |
| SUPABASE_ANON_KEY | Legacy anon key |
| SUPABASE_SERVICE_ROLE_KEY | Legacy service_role key — Secret |
| ADMIN_USER_ID | UUID admin, không phải email |
| CS_API_KEY | Key Chung Sức mới — Secret; thu hồi key đã lộ |
| SHOP_LIVE | false |
| SHOP_MAX_ORDER_TOTAL | 100000 (ví dụ giới hạn đ mỗi đơn, bắt buộc số dương) |
| DEPOSITS_LIVE | false |
| SEPAY_WEBHOOK_KEY | Secret ngẫu nhiên tối thiểu 24 ký tự, tạo riêng cho webhook |
| BANK_ACCOUNT | Số tài khoản nhận tiền khớp accountNumber trong webhook |
| BANK_NAME | Mã ngân hàng hỗ trợ VietQR, ví dụ VCB |
| BANK_OWNER | Tên chủ tài khoản |
| BANK_MEMO_PREFIX | Tùy chọn tiền tố bắt buộc ngân hàng, ví dụ SEVQR nếu áp dụng |

Mỗi lần sửa env → Deployments → Redeploy. Biến V2/V3 `APP_PASSWORD`, `CS_ENABLE_ORDER`, `CS_MAX_ORDER_TOTAL` không còn dùng trong V4; có thể xóa khỏi project sau khi xác nhận chuyển đổi thành công. `CS_API_KEY` vẫn dùng. Không đặt secrets ở Preview nếu không có project test riêng.

## 4. SePay
Tài liệu: https://docs.sepay.vn/tich-hop-webhooks.html ; https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc ; https://developer.sepay.vn/vi/tien-ich-khac/tao-qr-code
1. Đăng nhập https://my.sepay.vn/ và liên kết tài khoản ngân hàng đủ điều kiện. Bản này hỗ trợ tài khoản mà `accountNumber` webhook đúng `BANK_ACCOUNT`, không mặc định hỗ trợ VA riêng hoặc nhiều ngân hàng. Kiểm tra tên chủ, số tài khoản, yêu cầu VA/tiền tố của ngân hàng. Không đưa mật khẩu ngân hàng/OTP vào web.
2. Tích hợp → Webhooks → Thêm webhook. URL: `https://auto-chung-suc-virid.vercel.app/api/sepay` (thay URL nếu khác). Sự kiện Có tiền vào, chọn đúng tài khoản, JSON, bật retry ngoài 2xx. Bảo mật API Key: dùng key riêng khớp `SEPAY_WEBHOOK_KEY`; header SePay `Authorization: Apikey ...`. Không chọn không xác thực. Khuyến nghị nâng HMAC trước vận hành quy mô lớn; bản này chọn API Key qua HTTPS theo tài liệu.
3. Test trên **project/db test, SePay Test mode**: đặt `DEPOSITS_LIVE=true` riêng môi trường test, tạo yêu cầu nạp 10.000 và mô phỏng giao dịch đúng mã. Server đối chiếu tài khoản, chiều tiền vào, ID giao dịch, mã duy nhất `CS` + 16 ký tự hex, số tiền khớp chính xác. `shop_credit` cộng ví trong transaction, unique ID chống replay. Webhook trả HTTP 201 `{"success":true}` khi đã ghi nhận; giao dịch không khớp được ghi `unmatched/amount_mismatch/already_paid` để admin đối soát chứ không tự cộng. Không bật webhook giả lập vào DB production. Không dùng nút Gửi thử để cộng tiền thật.
4. Kiểm tra trên ví khách và Quản trị → Giao dịch SePay; mô phỏng gửi lại cùng ID, không tăng ví lần hai. Tiền gửi sai không được tự cộng; chủ shop đối chiếu sao kê và hoàn/điều chỉnh theo quy trình hỗ trợ được kiểm toán (bản này chưa có nút điều chỉnh tiền thủ công). Không chuyển tiền thật để thử trước khi đủ điều kiện vận hành.

## 5. Chỉnh giá và xử lý đơn
Admin → Quản trị → Tải danh sách. Giá gốc đọc từ API, nhập giá bán (ví dụ vốn 20.000 Xu, bán 25.000 đ nếu tỷ giá 1:1), bật checkbox Đang bán và Lưu. Không có giá bán mặc định được mở; chỉ bật dịch vụ hợp lệ. Khách thấy giá bán, không thấy vốn hoặc mã upstream. Server kiểm tra giá mới và giới hạn, trừ ví trong giao dịch trước khi gọi Chung Sức, dùng UUID đơn làm client_ref; khách có thể theo dõi trạng thái và tải CSV 100 đơn gần nhất.

- Nếu upstream từ chối rõ ràng hoặc xác nhận hủy, hoàn số dư ví đúng một lần. Nếu timeout/không rõ kết quả, chuyển `review` và giữ khoản tiền, không tự gửi lại. Admin phải đối chiếu tại nhà cung cấp, nhập mã đơn đã xác nhận; backend kiểm tra mã sự kiện, giá, loại/sản phẩm. Trường hợp không tìm thấy đơn (kể cả lỗi sau khi giữ ví nhưng trước gửi), cần đối soát và quy trình hoàn thủ công có kiểm toán; chưa tự động xử lý mọi trường hợp. Không thao tác SQL trực tiếp trên ví thật tùy tiện.
- API nhà cung cấp 30 lệnh/phút/key; cache danh mục 20 giây mỗi instance, giá khi gửi vẫn đọc mới. Chưa có rate limiter phân tán/queue; không mở số lượng lớn khách trước khi bổ sung. Không tự polling hàng loạt hoặc chạy định kỳ. Đơn được cập nhật khi khách bấm Chi tiết → Cập nhật trạng thái. Giá upstream có thể đổi giữa báo giá và gửi (ghi giá thực, admin đối soát); cần quy trình chênh lệch và giới hạn ngân sách nhà cung cấp trước production.
- Chỉ bật `SHOP_LIVE=true`, `DEPOSITS_LIVE=true` trong môi trường thật sau khi hoàn tất test, quyền kinh doanh, bảo mật, hỗ trợ/hoàn tiền, sao lưu và đối soát. Gói hosting phù hợp. Không có lịch tự chạy nền.

## 6. Kiểm thử
`npm run build` kiểm tra cú pháp. `npm test` 8 bài mock: phân quyền, không lộ vốn, kiểm tra giá và cờ live, đặt gói và lẻ, request ID, timeout/refund, webhook, QR. Không thực hiện giao dịch thật. SQL có smoke test riêng chưa chạy trên Postgres thực; chưa E2E trên Vercel/Supabase/SePay, chưa audit bảo mật/tải, chưa đủ điều kiện production. Tài khoản test và DB test không dùng chung tiền thật.
