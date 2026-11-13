# Chung Sức Auto Order V2 — Vercel Edition

## 1. Trạng thái
Port từ bản Cloudflare V2. Giữ nguyên giao diện HTML/CSS/JS, chế độ demo, sáng/tối, nhập TXT và lọc trùng, đặt nhiều mã có xác nhận, lịch sử, chi tiết, CSV, tìm kiếm, phân trang và giới hạn chi phí. Backend là Vercel Node.js Function, route `/api` giữ nguyên qua rewrite. Không cần Cloudflare, database hoặc Netlify.

Đã chạy `npm run build`, kiểm tra cú pháp JS và `npm test` trên Node 22 (2 nhóm test pass, có kiểm thử entry Vercel, xác thực, giới hạn, kiểm tra giá, mock các endpoint và POST). Kiểm thử trình duyệt tự động bị môi trường chặn điều hướng; chưa kiểm tra end-to-end trên Vercel thật. API nhà cung cấp vẫn chưa được xác minh; demo dùng dữ liệu giả, không mất Xu. Đặt đơn thật mặc định tắt. Chỉ dùng mã mời được phép sử dụng.

## 2. Deploy miễn phí trên Vercel (không cần cài Node.js)
1. Giải nén ZIP. Tạo repo mới tại https://github.com/new, ví dụ `autochungsuc-vercel`, khuyên dùng Private. Repo Cloudflare cũ có thể giữ nguyên; không cần xóa deployment đang kẹt.
2. Upload **nội dung bên trong ZIP**, không upload nguyên ZIP. Ở thư mục gốc repo cần có `api/`, `lib/`, `public/`, `scripts/`, `tests/`, `package.json`, `vercel.json`, `.gitignore`, `.env.example`. Không upload file chứa key thật. Nếu trình duyệt không upload được file ẩn, giữ chúng bằng Git hoặc tự tạo lại theo ZIP. Không cần tạo `.env` trên GitHub.
3. Đăng nhập https://vercel.com/signup bằng GitHub. Chọn Hobby nếu chỉ sử dụng cá nhân phi thương mại; dự án thương mại cần gói phù hợp. Vào https://vercel.com/new, Import Git Repository, cấp quyền repo vừa tạo, bấm Import.
4. Project Name: `autochungsuc-vercel` (hoặc tên còn trống); Framework Preset: Other; Root Directory: mặc định `./`; Build Command: `npm run build`; Output Directory: `public`; Install Command: mặc định. Node.js 22.x đã được khai báo trong package.json. `vercel.json` đã định nghĩa các cài đặt chính, không cần sửa. Không chọn Root Directory là public vì sẽ bỏ qua API.
5. Bấm Deploy. Khi thành công mở domain production do Vercel cấp, ví dụ `https://autochungsuc-vercel.vercel.app` (tên thực tế phụ thuộc tên còn trống). Demo chạy không cần key. Đặt đơn demo rồi kiểm tra lịch sử.
6. Kiểm tra backend bằng cách mở `https://TEN-MIEN-THAT.vercel.app/api?action=balance`. Khi chưa cấu hình, phải trả JSON với status 503 và message thiếu cấu hình; sau khi có key và mật khẩu sẽ trả 401 nếu không có mật khẩu. Không dán mật khẩu vào URL. Nếu trả HTML/404, kiểm tra root và rewrite trong vercel.json.

## 3. API key và biến môi trường
Vào https://chungsucliqi.com/profile.php → API đặt đơn tự động → Tạo API key. Lưu key riêng tư; bấm Tài liệu API để lấy thông tin chính thức. Không gửi key/token thật vào chat.

Vercel → project → Settings → Environment Variables → Add. Chọn Production. Với APP_PASSWORD và CS_API_KEY, bật Sensitive nếu có. Không dùng biến NEXT_PUBLIC_ hoặc đặt key trong public/. Nhập giá trị không kèm dấu nháy.

| Name | Value |
| --- | --- |
| APP_PASSWORD | Mật khẩu riêng ngẫu nhiên tối thiểu 16 ký tự |
| CS_API_KEY | API key Chung Sức |
| CS_ENABLE_ORDER | false |
| CS_API_KEY_HEADER | Tên header chính xác trong tài liệu API |
| CS_API_KEY_PREFIX | Tiền tố theo tài liệu; bỏ qua nếu không có |
| CS_BALANCE_PATH | Path lấy số dư, bắt đầu bằng / |
| CS_SERVICES_PATH | Path danh sách dịch vụ |
| CS_ORDERS_PATH | Path lịch sử |
| CS_DETAIL_PATH | Path chi tiết |
| CS_ORDER_PATH | Path đặt đơn |
| CS_MAX_ORDER_TOTAL | Số dương, giới hạn Xu mỗi lượt |

Không đoán các giá trị path hoặc header. Sau khi thêm hoặc sửa biến, vào Deployments → dấu ... cạnh bản production → Redeploy. Thay đổi env chỉ có hiệu lực ở deployment mới. Mở web → Kết nối API → nhập APP_PASSWORD → Kết nối thật. Không nhập API key vào giao diện.

## 4. Giới hạn API thật
Adapter chỉ gọi HTTPS chungsucliqi.com, không theo redirect. Hiện dự kiến xác thực bằng header, GET đọc, POST JSON đặt đơn, response `{success:true,data:...}`, payload `{package_id,quantity,referral_codes,note}`. Các giả định này phải đối chiếu tài liệu API thật; nếu khác, sửa lib/chungsuc.js và public/app.js. Giá = giá gói × số lượng × số mã; chỉ bật CS_ENABLE_ORDER=true sau khi xác minh giá, phương thức, schema, quyền sử dụng và kiểm thử đọc. Không tự retry khi timeout vì có thể đơn đã được tạo. Giới hạn chi phí áp dụng từng request, không phải tổng ngày. Chưa có idempotency hay rate limit bền vững; nên bổ sung bảo vệ trước khi dùng chung hoặc triển khai sản xuất lâu dài. Không đặt tự động theo lịch.

Nếu nhà cung cấp yêu cầu xác minh domain, nhập hostname Vercel thực tế (không có https://) và làm theo tài liệu. Backend gọi server-to-server nên CORS trình duyệt không cần thiết; verify chưa được triển khai do thiếu đặc tả.

## 5. Kiểm thử local tùy chọn
Node.js 22.x. `npm run build` kiểm tra file nguồn; `npm test` chạy mock không tốn Xu. `npm run dev` dùng Vercel CLI (lần đầu có thể yêu cầu tải và đăng nhập). Copy `.env.example` thành `.env.local` nếu cần, điền cấu hình riêng và giữ đặt đơn tắt. Không commit file này.

## 6. Cập nhật sau này
Upload/commit thay đổi lên branch main của repo Vercel, Vercel sẽ tự deploy nếu bật Git integration. Không sửa repo Cloudflare cũ nếu muốn tránh kích hoạt build cũ. Không cần xóa Cloudflare để Vercel hoạt động.

Tài liệu: https://vercel.com/docs/functions/runtimes/node-js ; https://vercel.com/docs/builds/configure-a-build ; https://vercel.com/docs/environment-variables/managing-environment-variables ; https://vercel.com/docs/deployments/managing-deployments .
