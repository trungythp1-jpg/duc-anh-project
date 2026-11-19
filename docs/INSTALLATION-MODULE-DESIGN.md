# ĐỨC ANH PROJECT — Thiết kế module Quản lý công trình thi công

Trạng thái: BẢN THIẾT KẾ ĐÃ CHỐT PHẠM VI — CHƯA ÁP DỤNG FIRESTORE RULES / CHƯA GHI DỮ LIỆU FIREBASE

## Nguyên tắc bảo toàn hệ thống
- Giữ nguyên module Sale, đăng ký khách hàng/công trình, khóa chống trùng, quyền sở hữu, đăng nhập và single-session.
- Không đổi schema hoặc Rules của các collection hiện hữu.
- Module thi công dùng collection riêng, chỉ Admin đọc và ghi.
- Firebase Spark và GitHub Pages tiếp tục được sử dụng.
- Phát triển trên nhánh feature/installation-management-design; không publish lên main.

## Điều hướng module
- Tổng quan thi công
- Công trình thi công
- Đội lắp đặt
- Kỹ thuật
- Nhật ký hoạt động

Chỉ hiển thị và khởi tạo khu vực module thi công sau khi xác minh profile role=admin. Firestore Rules vẫn là lớp bảo vệ quyết định; ẩn giao diện không được xem là kiểm soát bảo mật.

## Mô hình dữ liệu đề xuất

### execution_projects/{executionProjectId}
- sourceProjectId: ID của projects/{projectId} trong CRM Sale
- sourceCustomerId: ID khách hàng nguồn
- contractNumber: số hợp đồng (Admin nhập)
- projectName, customerName, siteAddress: snapshot hiển thị tại thời điểm lập kế hoạch
- notes: ghi chú
- defaultTeamId, defaultTeamCodeSnapshot, defaultTeamNameSnapshot
- status: NOT_STARTED | IN_PROGRESS | INSPECTION_ISSUE | COMPLETED | SUSPENDED | CANCELLED
- suspendedAt, suspendedBy, suspensionReason
- createdAt, createdBy, updatedAt, updatedBy

Một hồ sơ thi công liên kết một hồ sơ Sale; có thể chứa nhiều thang. Không ghi ngược vào projects/{projectId}. Khi tạo hồ sơ, app đọc hồ sơ Sale và lưu snapshot cần thiết. Chỉ Admin được truy cập hồ sơ nguồn và hồ sơ thi công.

### execution_projects/{executionProjectId}/elevators/{elevatorId}
- elevatorLabel / elevatorNumber
- specifications: stops, capacityKg, tractionMachine, controlCabinet, hasFrame, elevatorType (glass | stainless_steel | flat_cable | homelift)
- assignedTeamId, assignedTeamCodeSnapshot, assignedTeamNameSnapshot
- stage fields: shipment, installation, operation, tapeRemoval, inspection, handover
- status tổng hợp của thang
- isSuspended, suspendedAt, suspendedBy, suspensionReason
- createdAt, createdBy, updatedAt, updatedBy

Mỗi stage lưu plannedDate, actualDate, status và dữ liệu chuyên biệt:
- shipment: NOT_STARTED | IN_PROGRESS | DONE
- installation: NOT_STARTED | IN_PROGRESS | DONE
- operation: NOT_STARTED | IN_PROGRESS | DONE; actualTechnicianId, technicianNameSnapshot
- tapeRemoval: NOT_STARTED | IN_PROGRESS | DONE; actualTechnicianId, technicianNameSnapshot
- inspection: NOT_INSPECTED | REGISTERED | PASSED | FAILED; actualDate, latestResult, note
- handover: NOT_HANDED_OVER | IN_PROGRESS | HANDED_OVER; actualDate

Giai đoạn 4 có nhãn giao diện chính xác: “Bóc băng keo”.

### installation_teams/{teamId}
- teamCode (mã đội)
- teamName (tên đội)
- isActive, createdAt, createdBy, updatedAt, updatedBy

### technicians/{technicianId}
- name
- phone
- isActive, createdAt, createdBy, updatedAt, updatedBy

Danh mục chỉ có hai trường nghiệp vụ do người dùng yêu cầu. Trường trạng thái và metadata là trường hệ thống. Đội/nhân sự ngừng hoạt động không bị xóa cứng và vẫn hiển thị trong lịch sử; không dùng trạng thái để chặn lựa chọn trong kế hoạch mới nếu Admin muốn tiếp tục phân công. Danh mục đã sử dụng vẫn có thể chọn lại.

### project_activity_logs/{logId}
- executionProjectId, elevatorId (nếu áp dụng)
- action, field
- oldValue, newValue
- actorUid, actorRole=admin
- createdAt
- note

Tạo log cùng transaction/batch với thao tác thay đổi. Rules cho phép Admin tạo log nhưng không cho sửa/xóa log. Đây là nhật ký ứng dụng append-only, không phải audit log chống giả mạo trước một Admin có quyền thao tác trực tiếp.

## Quy tắc nghiệp vụ
1. Một công trình có nhiều thang.
2. Có đội mặc định ở cấp công trình; từng thang có thể ghi đè đội.
3. Mỗi công đoạn có ngày dự kiến, ngày thực tế và trạng thái.
4. Chỉ Admin được xem và cập nhật module thi công.
5. Đổi đội lắp đặt hoặc kỹ thuật viên bất kỳ lúc nào; lưu lịch sử trước/sau, người đổi và thời điểm.
6. Thay đổi phân công không xóa tiến độ đã ghi.
7. Kỹ thuật viên thực hiện công việc được lưu riêng với tài khoản Admin thao tác.
8. Kiểm định chỉ lưu kết quả mới nhất; lịch sử thay đổi vẫn ở activity log.
9. Tạm dừng công trình và tạm dừng từng thang độc lập; không ghi đè trạng thái tiến độ. Tiếp tục thì khôi phục trạng thái trước khi dừng.
10. Chỉ hoàn thành công trình khi mọi thang đã bàn giao.
11. Điều kiện DONE: xuất hàng/lắp đặt có actualDate; vận hành/bóc băng keo có actualDate và kỹ thuật viên; kiểm định PASSED có ngày; bàn giao cần kiểm định PASSED và actualDate.
12. Handover chỉ cần ngày bàn giao, không cần người xác nhận.

## Phân quyền dự kiến
- execution_projects: get/list/create/update/delete — Admin only.
- elevators subcollection: get/list/create/update/delete — Admin only.
- installation_teams: get/list/create/update/delete — Admin only.
- technicians: get/list/create/update/delete — Admin only.
- project_activity_logs: get/list/create — Admin only; update/delete — deny.
- Mọi tài khoản Sale bị từ chối toàn bộ thao tác với các collection trên.
- Không thay đổi các match hiện có của users/customers/projects/locks/history/delete_requests.

## Kiểm thử nghiệm thu
- Sale không đọc được collection thi công, kể cả truy cập trực tiếp SDK.
- Sale vẫn đăng nhập và sử dụng toàn bộ CRM hiện tại như trước.
- Admin tạo công trình liên kết CRM, thêm nhiều thang, quản lý đội/kỹ thuật.
- Danh mục có thể chỉnh sửa; hồ sơ lịch sử giữ snapshot cũ.
- Đổi đội/kỹ thuật không làm mất tiến độ.
- Đổi phân công có log old/new, actor và timestamp.
- Tạm dừng/tiếp tục đúng cấp công trình hoặc thang.
- Không thể bàn giao khi kiểm định chưa PASSED.
- Công trình chỉ hoàn tất khi mọi thang đã bàn giao.
- Kiểm tra giao diện mobile/iPad và trình duyệt desktop.

## Rủi ro / giới hạn cần công khai
- Firestore Rules bảo vệ quyền truy cập; app chạy client-side trên Spark không có backend tin cậy. Log append-only có ích cho kiểm soát nghiệp vụ nhưng không thể cam kết chống giả mạo tuyệt đối trước Admin có quyền ghi.
- Không dùng Firebase Admin SDK, Cloud Functions hoặc dịch vụ yêu cầu Blaze trong thiết kế này.
- Trước khi cập nhật Rules thật, cần duyệt chính xác diff và kiểm thử Rules (Firebase Emulator nếu môi trường hỗ trợ).
- Chưa có kiểm tra dữ liệu Firestore thực tế; cấu trúc đề xuất không giả định collection technicians đã tồn tại.

## Phạm vi chưa thực hiện
Không sửa firestore.rules hiện hành; không tạo collection/dữ liệu Firebase; không thay đổi main; không publish GitHub Pages.
