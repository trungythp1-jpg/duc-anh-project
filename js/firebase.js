import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCYXe43vWTSNMCfGYucryQ01SuTcBmso0Zk",
  authDomain: "duc-anh-project.firebaseapp.com",
  projectId: "duc-anh-project",
  storageBucket: "duc-anh-project.firebasestorage.app",
  messagingSenderId: "835267260025",
  appId: "1:835267260025:web:54b1d227ad9c73d6036ea8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
