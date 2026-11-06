# ĐỨC ANH PROJECT — Module Khách hàng & Đăng ký dự án
Trạng thái: Bản thiết kế triển khai để duyệt. Chưa ghi dữ liệu Firestore và chưa thay Firestore Rules đang chạy.

## 1. Quy tắc nghiệp vụ đã chốt
- Một khách hàng chỉ thuộc về một Sale.
- Sale đã sở hữu khách hàng được phép đăng ký thêm dự án của chính khách hàng đó.
- Sale khác bị chặn khi khách hàng đã thuộc Sale hiện tại; không tự chuyển chủ. Admin xử lý chuyển Sale.
- Đăng ký hợp lệ giữ quyền ngay lập tức; thời hạn mặc định 30 ngày, Admin có thể điều chỉnh.
- Trùng chính xác: người đăng ký đầu tiên hợp lệ thắng. Giao dịch Firestore phải nguyên tử.
- Hết hạn chuyển sang Admin xem xét, không tự động nhả khách hàng/dự án.
- Chỉ Admin được sửa thông tin gốc của khách hàng/dự án, chuyển Sale, gia hạn, lưu trữ.
- Xóa là lưu trữ, không xóa vĩnh viễn.
- Form dự án: tên dự án; địa chỉ công trình; tỉnh/thành; loại công trình; quy mô/tầng/số lượng thang/thời gian dự kiến (không bắt buộc); tải trọng và số điểm dừng (bắt buộc).
- Không có nhóm tải hồ sơ/chứng cứ trong giai đoạn này.

## 2. Cấu trúc Firestore đề xuất
### users/{uid} — giữ cấu trúc hiện có
Các trường hiện dùng: displayName, role, active, email (nếu có). Không đổi hồ sơ hiện tại.

### customers/{customerId}
- name: string
- phone: string — số điện thoại chuẩn hóa dạng +84...
- secondaryPhone: string | null
- normalizedName: string
- customerType: string
- contactAddress: string | null
- ownerSaleUid: string — UID Sale sở hữu duy nhất
- status: "active" | "archived"
- createdAt, updatedAt: server timestamp
- createdBy: uid

### customer_phone_locks/{canonicalPhone}
- customerId, ownerSaleUid, createdAt
- Tạo cùng transaction với customer; không cho ghi đè lock đã tồn tại.
- Khóa cả số chính và số phụ nếu có. Nếu hai số đang trỏ tới hai khách hàng khác nhau thì dừng đăng ký và yêu cầu Admin rà soát.

### projects/{projectId}
- customerId, ownerSaleUid
- projectName, siteAddress, normalizedSiteAddress, provinceCity, projectType
- buildingSize?, floors?, expectedElevatorQuantity?, expectedDeploymentAt?
- capacityKg: number — bắt buộc
- stops: number — bắt buộc
- status: "new_contact" | "survey" | "consulting" | "quote_sent" | "negotiating" | "signed" | "lost" | "expired_review"
- claimStartedAt, claimExpiresAt: server timestamps
- status, archivedAt?, archivedBy?
- createdAt, updatedAt, createdBy

### project_address_locks/{addressKey}
- projectId, customerId, ownerSaleUid, createdAt
- Một khóa địa chỉ công trình chỉ được tạo một lần trong transaction.
- Nếu địa chỉ trùng chính xác, giao dịch bị từ chối; địa chỉ gần giống chỉ tạo cảnh báo/rà soát, không tự ghép.

### project_activities/{activityId}
- projectId, customerId, actorUid, actorRole
- action, summary, createdAt
- Sale được thêm hoạt động chăm sóc; không được sửa thông tin gốc.

### project_history/{historyId}
- customerId, projectId?, fromSaleUid?, toSaleUid?, action, actorUid, reason, createdAt
- Ghi lại thay đổi chủ sở hữu, gia hạn, lưu trữ và các quyết định của Admin.

### audit_logs/{logId}
- actorUid, action, targetType, targetId, createdAt, metadata

## 3. Luồng đăng ký nguyên tử
1. Chuẩn hóa số điện thoại về một định dạng duy nhất (+84...) và chuẩn hóa địa chỉ ở trình duyệt.
2. Transaction đọc tất cả khóa số điện thoại và khóa địa chỉ trước khi ghi.
3. Nếu số điện thoại thuộc khách hàng của Sale khác: từ chối; hiển thị tên Sale đang phụ trách, không tiết lộ dữ liệu nhạy cảm ngoài mức cần thiết.
4. Nếu số điện thoại thuộc khách hàng của chính Sale: dùng lại customerId; không tạo khách hàng thứ hai.
5. Nếu các số điện thoại khớp nhiều customerId khác nhau: dừng và chuyển Admin rà soát.
6. Nếu khóa địa chỉ đã có: dừng đăng ký dự án trùng.
7. Nếu hợp lệ, tạo customer (nếu mới), các phone locks còn thiếu, project, address lock và history trong cùng transaction.
8. Dùng serverTimestamp() cho thời gian tạo; thời hạn 30 ngày tính từ claimStartedAt. Không dùng đồng hồ thiết bị để quyết định thắng/thua.

## 4. Kiểm tra trùng nghiêm ngặt
- Lớp 1: số điện thoại chính/phụ chuẩn hóa — trùng chính xác thì chặn/ghép vào hồ sơ cùng Sale.
- Lớp 2: địa chỉ công trình chuẩn hóa — trùng chính xác thì chặn.
- Lớp 3: tên khách hàng + địa chỉ gần giống — cảnh báo Admin/Sale rà soát; không tự động gộp.
- Tìm kiếm gần giống là cảnh báo hỗ trợ, không thay thế khóa nguyên tử.

## 5. Giới hạn kỹ thuật cần hiểu trước khi bật live
- Giữ Firebase Spark: không dùng Cloud Functions, Cloud Scheduler hoặc dịch vụ cần Blaze.
- Firestore transaction từ trình duyệt có thể chạy trên Spark và xử lý tranh chấp cùng document lock.
- Vì không có backend tin cậy, chuẩn hóa địa chỉ/điện thoại được thực hiện trong ứng dụng; Firestore Rules có thể khóa quyền sở hữu và ngăn ghi đè lock, nhưng không thể tự thực hiện thuật toán chuẩn hóa Unicode/fuzzy matching. Cần yêu cầu nhập số điện thoại theo định dạng chuẩn +84 và dùng khóa địa chỉ canonical do ứng dụng tạo. Đây là giới hạn chống gian lận có chủ đích; nếu cần xác minh chuẩn hóa phía máy chủ tuyệt đối thì phải có backend, không nằm trong phương án Spark-only.
- Không tạo thông báo tự động theo lịch vì cần scheduler/backend. Hạn 30 ngày được tính khi đọc dữ liệu; Admin xem danh sách sắp hết hạn/hết hạn và xử lý thủ công.

## 6. Phân quyền dự kiến
- Sale: đọc khách hàng/dự án do mình phụ trách; tạo khách hàng/dự án qua transaction; thêm hoạt động chăm sóc; không được sửa ownerSaleUid, status hệ thống, claimExpiresAt hoặc thông tin gốc sau khi tạo.
- Admin: đọc toàn bộ; sửa thông tin gốc; chuyển Sale; gia hạn; lưu trữ; xử lý hồ sơ hết hạn.
- User không thể tự đổi role hoặc active.
- Tất cả collection mới mặc định đóng nếu không có rule cụ thể.

## 7. Kế hoạch triển khai theo checkpoint
- P1: duyệt schema và Firestore Rules diff.
- P2: tạo rules bản dự thảo, kiểm tra logic quyền; chưa publish.
- P3: triển khai giao diện danh sách/tạo khách hàng/đăng ký dự án và transaction.
- P4: kiểm thử bằng hai tài khoản Sale đăng ký đồng thời, số điện thoại trùng, địa chỉ trùng, cùng khách hàng khác Sale, hết hạn và Admin chuyển Sale.
- P5: chỉ sau khi duyệt mới publish Firestore Rules và bật module.
