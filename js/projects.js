import {
  collection, doc, getDoc, getDocs, query, where, limit, runTransaction,
  serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const $ = (s, root=document) => root.querySelector(s);
const esc = (v="") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = v => String(v||"").normalize("NFC").trim().toLocaleLowerCase("vi").replace(/[.,;:/-]+/g," ").replace(/\s+/g," ");
function phoneKey(value) {
  let d=String(value||"").replace(/\D/g,"");
  if(d.startsWith("0084")) d=d.slice(2);
  if(d.startsWith("84")) d=d.slice(2);
  if(d.startsWith("0")) d=d.slice(1);
  if(d.length<9 || d.length>10) throw new Error("Số điện thoại chưa đúng. Nhập số di động Việt Nam.");
  return "84"+d;
}
async function hashKey(value) {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
const statusName = s => ({new_contact:"Mới tiếp cận",survey:"Khảo sát",consulting:"Tư vấn",quote_sent:"Đã gửi báo giá",negotiating:"Đàm phán",signed:"Đã ký hợp đồng",lost:"Không thành công",expired_review:"Chờ Admin xem xét",archived:"Đã lưu trữ"})[s]||s||"—";
const dateName = v => {if(!v)return "—";const d=v.toDate?v.toDate():new Date(v);return isNaN(d)? "—":d.toLocaleDateString("vi-VN");};
const expiryOf = p => {if(!p.claimStartedAt)return null;const start=p.claimStartedAt.toDate?p.claimStartedAt.toDate():new Date(p.claimStartedAt);return new Date(start.getTime()+(Number(p.claimDurationDays)||30)*86400000);};

export function initProjectModule({db,user,profile}) {
  const root=$("#business-module"); if(!root)return;
  const admin=profile.role==="admin", owner=admin?null:user.uid, msg=$("#business-message");
  const say=(t,ok=false)=>{msg.textContent=t;msg.className="message"+(ok?" success":"");};
  const registrationError=$("#registration-error");
  const showRegistrationError=(t)=>{
    // Lỗi đăng ký chỉ hiển thị tại form, không đẩy lên dòng thông báo tổng quan.
    msg.textContent="";
    msg.className="message hidden";
    registrationError.textContent=t;
    registrationError.classList.toggle("hidden",!t);
    registrationError.classList.toggle("is-duplicate",/trùng|đã có dự án|Sale khác|đã được/i.test(t));
    if(t) requestAnimationFrame(()=>registrationError.scrollIntoView?.({behavior:"smooth",block:"center"}));
  };
  let customers=[],projects=[];
  const nav=[...root.querySelectorAll("[data-view]")];
  function view(name){root.querySelectorAll(".module-view").forEach(x=>x.classList.toggle("hidden",x.id!=="view-"+name));nav.forEach(x=>x.classList.toggle("active",x.dataset.view===name));if(name==="customers")load();if(name==="projects")load();}
  nav.forEach(b=>b.addEventListener("click",()=>view(b.dataset.view)));
  $("#open-new-project").addEventListener("click",()=>view("register"));
  $("#register-form").addEventListener("submit",register);
  $("#customer-filter").addEventListener("input",()=>renderCustomers($("#customer-filter").value));
  $("#project-filter").addEventListener("input",()=>renderProjects($("#project-filter").value));
  $("#refresh-business").addEventListener("click",load);
  // Phần tử admin-operations chưa có trong giao diện hiện tại; kiểm tra tồn tại trước khi thao tác.
  if(admin) $("#admin-operations")?.classList.remove("hidden");
  view("register");load();

  async function fetchRows(name){
    const c=collection(db,name), q=owner?query(c,where("ownerSaleUid","==",owner),limit(500)):query(c,limit(800));
    const s=await getDocs(q);return s.docs.map(d=>({id:d.id,...d.data()}));
  }
  async function load(){
    try{
      [customers,projects]=await Promise.all([fetchRows("customers"),fetchRows("projects")]);
      $("#stat-customers").textContent=customers.filter(x=>x.status!=="archived").length;
      $("#stat-projects").textContent=projects.filter(x=>x.status!=="archived").length;
      $("#stat-expiring").textContent=projects.filter(x=>expiryOf(x)&&expiryOf(x).getTime()<Date.now()+5*86400000&&x.status!=="signed"&&x.status!=="archived").length;
      renderCustomers();renderProjects();fillCustomerOptions();
    }catch(e){say(errorText(e));}
  }
  function renderCustomers(term=""){
    const q=norm(term), rows=customers.filter(c=>norm([c.name,c.phone,c.contactAddress,c.ownerSaleName].join(" ")).includes(q));
    $("#customers-table").innerHTML=rows.length?rows.map(c=>"<tr><td><b>"+esc(c.name)+"</b></td><td>"+esc(c.phone)+"</td><td>"+esc(c.customerType||"—")+"</td><td>"+esc(c.ownerSaleName||c.ownerSaleUid||"—")+"</td><td>"+(c.status==="archived"?"Lưu trữ":"Đang hoạt động")+"</td></tr>").join(""):'<tr><td colspan="5" class="empty-cell">Chưa có khách hàng</td></tr>';
  }
  function renderProjects(term=""){
    const q=norm(term), rows=projects.filter(p=>norm([p.projectName,p.customerName,p.siteAddress,p.provinceCity].join(" ")).includes(q));
    $("#projects-table").innerHTML=rows.length?rows.map(p=>"<tr><td><b>"+esc(p.projectName)+"</b><small>"+esc(p.customerName||"")+"</small></td><td>"+esc(p.siteAddress)+"</td><td>"+esc(p.capacityKg)+" kg · "+esc(p.stops)+" điểm dừng</td><td>"+esc(statusName(p.status))+"</td><td>"+dateName(expiryOf(p))+"</td><td>"+(admin&&p.status!=="archived"?'<button class="table-action" data-archive="'+esc(p.id)+'">Lưu trữ</button>':"—")+"</td></tr>").join(""):'<tr><td colspan="6" class="empty-cell">Chưa có dự án</td></tr>';
    $("#projects-table").querySelectorAll("[data-archive]").forEach(b=>b.addEventListener("click",()=>archive(b.dataset.archive)));
  }
  function fillCustomerOptions(){
    const s=$("#project-customer-select");if(!s)return;
    s.innerHTML='<option value="">Chọn khách hàng</option>'+customers.filter(c=>c.status!=="archived").map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+' · '+esc(c.phone)+'</option>').join("");
  }
  async function register(ev){
    ev.preventDefault();const f=ev.currentTarget,b=f.querySelector("button[type=submit]");say("");showRegistrationError("");
    const val=id=>{
        const field=f.querySelector(id);
        if(!field) throw new Error("Thiếu trường dữ liệu "+id+" trong biểu mẫu. Hãy tải lại trang để cập nhật phiên bản mới.");
        return String(field.value??"").trim();
      };
    let stage="kiểm tra dữ liệu biểu mẫu";
    try{
      const name=val("#reg-customer-name"), phone=phoneKey(val("#reg-phone")), secondary=val("#reg-secondary-phone")?phoneKey(val("#reg-secondary-phone")):null;
      const phones=[...new Set([phone,secondary].filter(Boolean))], projectName=val("#reg-project-name"), site=val("#reg-site-address"), province=val("#reg-province");
      const capacity=Number(val("#reg-capacity")), stops=Number(val("#reg-stops"));
      if(!name||!projectName||!site||!province)throw new Error("Vui lòng nhập đủ tên khách hàng, tên dự án và địa chỉ công trình.");
      if(!(capacity>0)||!Number.isInteger(stops)||stops<=0)throw new Error("Tải trọng và số điểm dừng phải là số lớn hơn 0.");
      const addrNorm=norm(site+" "+province), addrId=await hashKey(addrNorm);
      const newCustomer=doc(collection(db,"customers")), project=doc(collection(db,"projects"));
      const locks=phones.map(p=>doc(db,"customer_phone_locks",p)), addrLock=doc(db,"project_address_locks",addrId);
      b.disabled=true;b.textContent="Đang kiểm tra trùng…";

      // Kiểm tra số điện thoại trước giao dịch để hiển thị lỗi nghiệp vụ dễ hiểu.
      // Giao dịch bên dưới vẫn là lớp bảo vệ cuối cùng, tránh hai Sale đăng ký đồng thời.
      stage="kiểm tra số điện thoại đã đăng ký";
      const phoneLockSnaps = await Promise.all(
        phones.map(p => getDoc(doc(db,"customer_phone_locks",p)))
      );
      const foreignPhoneLock = phoneLockSnaps.find(s =>
        s.exists() && s.data().ownerSaleUid !== user.uid
      );
      if (foreignPhoneLock) {
        throw new Error("SỐ ĐIỆN THOẠI ĐÃ ĐƯỢC ĐĂNG KÝ BỞI SALE KHÁC. Vui lòng kiểm tra lại số điện thoại hoặc liên hệ Admin.");
      }

      stage="đọc khóa chống trùng trong giao dịch";
      await runTransaction(db,async tx=>{
        const lockSnaps=await Promise.all(locks.map(r=>tx.get(r))), addrSnap=await tx.get(addrLock);
        if(addrSnap.exists())throw new Error("Địa chỉ công trình đã có dự án đăng ký. Hệ thống chặn hồ sơ trùng.");
        const existingLocks=lockSnaps.filter(s=>s.exists());
        const ids=[...new Set(existingLocks.map(s=>s.data().customerId))];
        if(ids.length>1)throw new Error("Hai số điện thoại đang thuộc hai hồ sơ khác nhau. Cần Admin rà soát.");
        if(!admin && existingLocks.some(s=>s.data().ownerSaleUid!==user.uid)){
          throw new Error("SỐ ĐIỆN THOẠI ĐÃ ĐƯỢC ĐĂNG KÝ BỞI SALE KHÁC. Vui lòng kiểm tra lại số điện thoại hoặc liên hệ Admin.");
        }
        const customerId=ids[0]||newCustomer.id;let old=null;
        if(ids.length){
          stage="kiểm tra hồ sơ khách hàng hiện có";
          const oldSnap=await tx.get(doc(db,"customers",customerId));
          if(!oldSnap.exists())throw new Error("Khóa khách hàng không hợp lệ. Liên hệ Admin.");
          old=oldSnap.data();
          if(old.ownerSaleUid!==user.uid&&!admin)throw new Error("Khách hàng đang thuộc Sale khác. Chỉ Admin mới xử lý chuyển Sale.");
          if(old.status==="archived")throw new Error("Khách hàng đang lưu trữ. Liên hệ Admin.");
        }
        stage="ghi hồ sơ khách hàng, khóa chống trùng, dự án và lịch sử";
        if(!old)tx.set(doc(db,"customers",customerId),{name,phone,secondaryPhone:secondary,normalizedName:norm(name),normalizedPhone:phone,normalizedPhones:phones,customerType:val("#reg-customer-type"),contactAddress:val("#reg-contact-address")||null,ownerSaleUid:user.uid,ownerSaleName:profile.displayName||user.email||"Sale",status:"active",createdAt:serverTimestamp(),updatedAt:serverTimestamp(),createdBy:user.uid});
        locks.forEach((r,i)=>{if(!lockSnaps[i].exists())tx.set(r,{customerId,ownerSaleUid:user.uid,createdAt:serverTimestamp()});});
        tx.set(addrLock,{projectId:project.id,customerId,ownerSaleUid:user.uid,createdAt:serverTimestamp()});
        tx.set(project,{customerId,customerName:name,ownerSaleUid:user.uid,ownerSaleName:profile.displayName||user.email||"Sale",projectName,siteAddress:site,normalizedSiteAddress:addrNorm,addressLockId:addrId,provinceCity:province,projectType:val("#reg-project-type"),expectedElevatorQuantity:val("#reg-elevator-qty")?Number(val("#reg-elevator-qty")):null,expectedDeploymentAt:val("#reg-deployment")||null,capacityKg:capacity,stops,status:"new_contact",claimStartedAt:serverTimestamp(),claimDurationDays:30,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),createdBy:user.uid});
        tx.set(doc(collection(db,"project_history")),{customerId,projectId:project.id,action:"project_registered",actorUid:user.uid,actorRole:profile.role,createdAt:serverTimestamp()});
      });
      f.reset();showRegistrationError("");say("Đăng ký khách hàng và dự án thành công. Quyền phụ trách đã được ghi nhận.",true);await load();view("projects");
    }catch(e){
      console.error("[ĐỨC ANH PROJECT] Lỗi đăng ký:",{stage,code:e?.code||"unknown",message:e?.message||String(e),error:e});
      const message = e?.code === "permission-denied"
        ? "FIREBASE TỪ CHỐI QUYỀN TRUY CẬP tại bước: "+stage+". Đây là lỗi phân quyền, không phải thông báo trùng số điện thoại. Vui lòng báo Admin kiểm tra Firestore Rules."
        : (e?.message || errorText(e,stage));
      showRegistrationError(message);
    }
    finally{b.disabled=false;b.textContent="Đăng ký khách hàng và dự án";}
  }
  async function archive(id){
    if(!admin||!confirm("Đưa dự án vào lưu trữ? Dữ liệu không bị xóa vĩnh viễn."))return;
    try{await updateDoc(doc(db,"projects",id),{status:"archived",archivedAt:serverTimestamp(),archivedBy:user.uid,updatedAt:serverTimestamp()});say("Đã lưu trữ dự án.",true);await load();}
    catch(e){say(errorText(e));}
  }
  function errorText(e,stage="thao tác dữ liệu"){
    if(e?.code==="permission-denied"){
      return "Firebase từ chối quyền tại bước: "+stage+". Kiểm tra Rules của collection tương ứng và quyền của tài khoản đang đăng nhập. (permission-denied)";
    }
    if(e?.code==="unavailable")return "Không thể kết nối Firebase tại bước: "+stage+". Kiểm tra mạng và thử lại.";
    if(e?.code==="failed-precondition")return "Firebase chưa đáp ứng điều kiện tại bước: "+stage+". Chi tiết: "+(e.message||"");
    return (e?.message||"Có lỗi xảy ra.")+" [Bước: "+stage+"]";
  }
}