# Chung Sức Auto Order V3 — Vercel

Bản cập nhật theo ảnh tài liệu API chính thức do người dùng cung cấp. Giữ giao diện V2 và bổ sung đặt lẻ, trạng thái hệ thống, lịch sử có tổng đơn/tổng chi. Không chứa API key hoặc token thật. Không gửi đơn thật trong kiểm thử.

## Cập nhật repo Vercel đang dùng

1. Giải nén ZIP bản vá, tải các file vào **gốc** repo `auto-chung-suc` (nhánh `main`), giữ nguyên các thư mục. Các file trùng tên được thay thế. Không xóa `public/.well-known/chungsucliqi-verify.txt` đã tạo; bản ZIP không chứa token.
2. Commit, Vercel tự deploy. Nếu cần Deployments → Redeploy. Build command `npm run build`, output `public`, preset Other.
3. Settings → Environment Variables, Production:
   - `CS_API_KEY` (Secret): key mới tạo sau khi thu hồi key đã lộ trong ảnh.
   - `APP_PASSWORD` (Secret): mật khẩu riêng, tối thiểu 16 ký tự.
   - `CS_ENABLE_ORDER` (Config): `false` để thử đọc dữ liệu.
   - `CS_MAX_ORDER_TOTAL` (Config): số nguyên dương, ví dụ `5000` Xu, giới hạn **mỗi đơn**, không phải tổng ngày. Chỉ dùng giá trị phù hợp ngân sách.
4. Các biến `CS_API_KEY_HEADER`, `CS_API_KEY_PREFIX`, `CS_*_PATH` của V2 không còn được sử dụng; có thể để nguyên hoặc xóa. Backend cố định URL HTTPS chính thức và header `X-API-Key`.
5. Redeploy sau khi chỉnh biến. Mở domain Vercel → Kết nối API → nhập APP_PASSWORD → Kết nối thật. Kiểm tra số dư, sản phẩm, giá, trạng thái và lịch sử. Không cần nhập key thật vào web. Nếu báo 401, kiểm tra mật khẩu web hoặc key đã thu hồi; 429 thì theo Retry-After, không bấm liên tục.
6. Chỉ khi đọc được dữ liệu đúng và muốn thực sự đặt đơn, sửa `CS_ENABLE_ORDER=true` rồi Redeploy. Xem kỹ giá và số mã trước khi xác nhận. Có thể đổi lại false để khóa. Đơn thật trừ Xu ngay. Không tự gửi lại khi mất mạng; kiểm tra lịch sử.

## API thực tế

`https://chungsucliqi.com/api/v1.php?action=...`, header `X-API-Key`, response `ok/data`, lỗi `error.code/error.message`. Backend map `me`, `products`, `status`, `retail`, `history`, GET `order`, POST `order` / `retail_order` thành giao diện V2. Không cần verify để thử GET me từ server theo tài liệu. Giữ file xác minh domain đang có. Không gọi API từ trình duyệt trực tiếp. Không sử dụng nạp Xu, mua acc clone, mở rương riêng hay đặt đơn tự động theo lịch; chỉ hỗ trợ đơn sản phẩm và đặt lẻ, xem lịch sử các loại.

- Đơn sản phẩm: mỗi mã một suất, tối đa 200 mã; giá × số mã. Không gửi quantity hoặc allow_duplicate=true. Mã nhập một dòng hoặc dấu phẩy; tự lọc trùng trong một đơn.
- Đặt lẻ: một mã 5–40 ký tự, số lượt/gói theo min/max trả về, giá lấy từ retail. Nhiều mã phải tạo từng đơn riêng.
- Mỗi đơn cần client_ref, sinh bằng UUID, lưu tham chiếu chưa xác nhận trong localStorage theo hash nội dung (không lưu key/mật khẩu). Nếu gửi lại cùng nội dung trong cùng trình duyệt, dùng lại tham chiếu khi chưa rõ kết quả; nhà cung cấp quy định trả đơn cũ, không trừ Xu lần hai. Không đảm bảo chống trùng nếu đổi trình duyệt, xóa dữ liệu, đổi nội dung hoặc đặt lại một đơn đã xác nhận. Không tự retry POST. Khi lỗi mạng, kiểm tra lịch sử trước.
- Backend kiểm tra giá hiện tại, trạng thái dịch vụ và giới hạn chi trước khi gửi. Không có giao dịch giá nguyên tử phía nhà cung cấp; giá vẫn có thể thay đổi giữa đọc và tạo đơn. Đọc số dư thực tế trước khi chi. Không có giới hạn tổng ngày bền vững.
- 30 lệnh/phút/key theo tài liệu; mỗi lần kết nối/refresh dùng 5 lệnh đọc, đặt đơn dùng thêm lệnh kiểm tra. Không polling tự động. API trả 429 và Retry-After khi có; không retry tự động. Có thể dùng Cloudflare/Vercel firewall bổ sung rate-limit đăng nhập nếu công khai. Mật khẩu lưu bộ nhớ tab.

## Kiểm thử
`npm test`: mock API (không gọi thật), kiểm tra xác thực, response, lịch sử, giá, giới hạn, payload order/retail, duplicate_request, 429, gateway. `npm run build`: kiểm tra entry. `node --check public/app.js`: kiểm tra cú pháp. Chưa thử API live bằng key thật, chưa kiểm thử end-to-end trình duyệt hoặc deploy V3 vào tài khoản. Gói Hobby chỉ dùng phi thương mại. Hosting miễn phí không miễn phí dịch vụ Chung Sức.
