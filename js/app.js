import { auth, db } from "./firebase.js";
import { initProjectModule } from "./projects.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {
  doc, getDoc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const loginView = document.querySelector("#login-view");
const appView = document.querySelector("#app-view");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const profileMessage = document.querySelector("#profile-message");
const submitButton = loginForm.querySelector("button[type=submit]");
const adminTools = document.querySelector("#admin-tools");
const saleForm = document.querySelector("#sale-form");
const saleMessage = document.querySelector("#sale-message");
const createSaleButton = document.querySelector("#create-sale-btn");

let currentAdmin = null;

function showLogin(message = "") {
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");
  adminTools.classList.add("hidden");
  loginMessage.textContent = message;
  currentAdmin = null;
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
    "permission-denied": "Firestore từ chối thao tác. Hãy kiểm tra tài khoản Admin và Firestore Rules.",
    "already-exists": "UID này đã có hồ sơ trong hệ thống. Không ghi đè dữ liệu hiện có."
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

saleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  saleMessage.classList.remove("success");
  saleMessage.textContent = "";

  const uid = document.querySelector("#sale-uid").value.trim();
  const enteredName = document.querySelector("#sale-name").value.trim();
  const displayName = enteredName || `Sale ${uid.slice(-6)}`;

  if (!currentAdmin || currentAdmin.role !== "admin") {
    saleMessage.textContent = "Bạn không có quyền tạo hồ sơ Sale.";
    return;
  }
  if (!uid || uid.length > 128 || /\s/.test(uid)) {
    saleMessage.textContent = "UID không hợp lệ. Hãy dán chính xác UID trong Firebase Authentication.";
    return;
  }
  createSaleButton.disabled = true;
  createSaleButton.textContent = "Đang tạo hồ sơ…";
  try {
    const profileRef = doc(db, "users", uid);
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(profileRef);
      if (existing.exists()) {
        throw Object.assign(new Error("UID này đã có hồ sơ trong hệ thống. Không ghi đè dữ liệu hiện có."), { code: "already-exists" });
      }
      transaction.set(profileRef, {
        displayName,
        role: "sale",
        active: true,
        createdAt: serverTimestamp(),
        createdBy: currentAdmin.uid
      });
    });

    saleMessage.textContent = "Đã tạo hồ sơ Sale thành công. Tài khoản Auth tương ứng có thể đăng nhập bằng email và mật khẩu đã được tạo trong Firebase Authentication.";
    saleMessage.classList.add("success");
    saleForm.reset();
  } catch (error) {
    saleMessage.textContent = friendlyError(error);
  } finally {
    createSaleButton.disabled = false;
    createSaleButton.innerHTML = 'Tạo hồ sơ Sale <span>＋</span>';
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }

  showApp();
  adminTools.classList.add("hidden");
  currentAdmin = null;
  document.querySelector("#welcome-title").textContent = "Xin chào";
  document.querySelector("#role-chip").textContent = "ĐANG XÁC MINH QUYỀN";
  profileMessage.textContent = "Đang kiểm tra hồ sơ và quyền truy cập…";
  profileMessage.classList.remove("success");
  saleMessage.textContent = "";

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
    document.querySelector("#business-module")?.classList.remove("hidden");
    initProjectModule({ db, user, profile });
    document.querySelector("#role-chip").textContent = profile.role === "admin" ? "ADMINISTRATOR" : "SALES";
    profileMessage.textContent = "Đăng nhập thành công.";
    profileMessage.classList.add("success");

    if (profile.role === "admin") {
      currentAdmin = { uid: user.uid, role: "admin" };
      adminTools.classList.remove("hidden");
    }
  } catch (error) {
    document.querySelector("#role-chip").textContent = "CHƯA XÁC MINH ĐƯỢC QUYỀN";
    profileMessage.textContent = friendlyError(error);
  }
});
