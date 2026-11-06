import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const loginView = document.querySelector("#login-view");
const appView = document.querySelector("#app-view");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const profileMessage = document.querySelector("#profile-message");
const submitButton = loginForm.querySelector("button[type=submit]");

function showLogin(message = "") {
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");
  loginMessage.textContent = message;
}
function showApp() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
}
function friendlyError(error) {
  const map = {
    "auth/invalid-credential": "Email hoặc mật khẩu không chính xác.",
    "auth/too-many-requests": "Bạn thử đăng nhập quá nhiều lần. Vui lòng chờ rồi thử lại.",
    "auth/network-request-failed": "Không thể kết nối mạng. Vui lòng thử lại.",
    "permission-denied": "Firestore đang khóa quyền truy cập. Chưa có thay đổi dữ liệu nào được thực hiện."
  };
  return map[error.code] || error.message || "Đã xảy ra lỗi. Vui lòng thử lại.";
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  submitButton.disabled = true;
  submitButton.textContent = "Đang đăng nhập…";
  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showLogin(friendlyError(error));
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Đăng nhập <span>→</span>';
  }
});

document.querySelector("#logout-btn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }
  showApp();
  document.querySelector("#welcome-title").textContent = "Xin chào";
  document.querySelector("#role-chip").textContent = "ĐANG XÁC MINH QUYỀN";
  profileMessage.textContent = "Đang kiểm tra hồ sơ và quyền truy cập…";
  try {
    const profileSnap = await getDoc(doc(db, "users", user.uid));
    if (!profileSnap.exists()) {
      document.querySelector("#role-chip").textContent = "CHƯA ĐƯỢC CẤP QUYỀN";
      profileMessage.textContent = "Tài khoản đã đăng nhập nhưng chưa có hồ sơ users tương ứng. Vui lòng Admin thiết lập hồ sơ trước khi sử dụng.";
      return;
    }
    const profile = profileSnap.data();
    if (profile.active !== true || !["admin", "sale"].includes(profile.role)) {
      document.querySelector("#role-chip").textContent = "TÀI KHOẢN CHƯA KÍCH HOẠT";
      profileMessage.textContent = "Tài khoản chưa được kích hoạt hoặc vai trò không hợp lệ. Vui lòng liên hệ Admin.";
      return;
    }
    document.querySelector("#welcome-title").textContent = profile.displayName || user.email || "Người dùng";
    document.querySelector("#role-chip").textContent = profile.role === "admin" ? "ADMINISTRATOR" : "SALES";
    profileMessage.textContent = "Đăng nhập thành công. Các module nghiệp vụ sẽ được bật sau khi hoàn tất kiểm thử quyền dữ liệu.";
    profileMessage.classList.add("success");
  } catch (error) {
    document.querySelector("#role-chip").textContent = "CHƯA XÁC MINH ĐƯỢC QUYỀN";
    profileMessage.textContent = friendlyError(error);
  }
});
