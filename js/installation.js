import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $ = (s, root=document) => root.querySelector(s);
const STAGES = [
  ["shipment","Xuất hàng"],["installation","Lắp đặt"],["operation","Vận hành"],
  ["tapeRemoval","Bóc băng keo"],["inspection","Kiểm định"],["handover","Bàn giao"]
];
const STATUS = ["Chưa bắt đầu","Đang thực hiện","Hoàn thành"];
const statusValue = ["NOT_STARTED","IN_PROGRESS","DONE"];
const dateText = v => v ? (typeof v==="string" ? v : v.toDate?.().toISOString?.().slice(0,10) || "") : "";

export function initInstallationModule({db,user,profile}) {
  if(profile?.role!=="admin" || profile?.active!==true) return;
  const root=$("#installation-module");
  if(!root) return;
  root.classList.remove("hidden");
  let projects=[], sourceProjects=[], teams=[], technicians=[], selected=null, elevators=[];
  const say=(message,ok=false)=>{const el=$("#installation-message",root);el.textContent=message;el.className="message"+(ok?" success":"");};
  const col=name=>collection(db,name);
  const log=async (projectId,elevatorId,action,field,oldValue,newValue)=>{
    await addDoc(col("project_activity_logs"),{executionProjectId:projectId,elevatorId:elevatorId||null,action,field,oldValue:oldValue??null,newValue:newValue??null,actorUid:user.uid,actorRole:"admin",createdAt:serverTimestamp()});
  };
  const getTeams=()=>teams.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.teamCode)+' · '+esc(t.teamName)+(t.isActive===false?' (Ngừng hoạt động)':'')+'</option>').join("");
  const getTechs=()=>technicians.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+' · '+esc(t.phone)+(t.isActive===false?' (Ngừng hoạt động)':'')+'</option>').join("");

  root.innerHTML = `
    <section class="install-shell">
      <div class="install-head"><div><p class="eyebrow">INSTALLATION MANAGEMENT</p><h3>Quản lý công trình thi công</h3><p class="install-muted">Khu vực quản trị riêng — chỉ Admin được truy cập.</p></div><button type="button" class="quiet-btn" id="install-refresh">↻ Làm mới</button></div>
      <div class="install-tabs"><button data-tab="overview" class="active">Tổng quan</button><button data-tab="projects">Công trình</button><button data-tab="teams">Đội lắp đặt</button><button data-tab="techs">Kỹ thuật</button><button data-tab="logs">Nhật ký</button></div>
      <p id="installation-message" class="message" role="status"></p>
      <section data-panel="overview" class="install-panel"><div class="install-stats" id="install-stats"></div><div class="install-card"><h4>Tiến độ công trình</h4><div id="install-overview-list"></div></div></section>
      <section data-panel="projects" class="install-panel hidden">
        <div class="install-card"><h4>Tạo hồ sơ thi công từ công trình Sale</h4><form id="execution-create" class="install-form">
          <label>Chọn công trình Sale *</label><select id="execution-source" required><option value="">Chọn công trình đã đăng ký</option></select>
          <div class="install-grid"><div><label>Số hợp đồng</label><input id="execution-contract" placeholder="Nhập số hợp đồng"></div><div><label>Đội lắp đặt mặc định</label><select id="execution-team"><option value="">Chưa phân công</option>${getTeams()}</select></div></div>
          <label>Ghi chú</label><textarea id="execution-notes" rows="2"></textarea><button class="primary-btn" type="submit">Tạo hồ sơ thi công</button>
        </form></div>
        <div class="install-card"><h4>Danh sách công trình thi công</h4><div id="execution-list"></div></div>
        <div class="install-card hidden" id="execution-detail"><div class="install-detail-head"><div><p class="eyebrow">PROJECT DETAIL</p><h4 id="execution-detail-title"></h4><p id="execution-detail-meta" class="install-muted"></p></div><button class="quiet-btn" id="execution-back">Quay lại danh sách</button></div>
          <form id="elevator-create" class="install-form"><h5>Thêm thang máy</h5>
            <div class="install-grid"><div><label>Tên / số thang *</label><input id="elevator-label" required placeholder="Thang 1"></div><div><label>Đội lắp đặt</label><select id="elevator-team"><option value="">Dùng đội mặc định</option>${getTeams()}</select></div>
            <div><label>Tải trọng (kg)</label><input id="elevator-capacity" type="number" min="1"></div><div><label>Số điểm dừng</label><input id="elevator-stops" type="number" min="1"></div>
            <div><label>Máy kéo</label><input id="elevator-machine"></div><div><label>Tủ điều khiển</label><input id="elevator-cabinet"></div>
            <div><label>Loại thang</label><select id="elevator-type"><option value="stainless_steel">Inox</option><option value="glass">Kính</option><option value="flat_cable">Cáp dẹt</option><option value="homelift">Homelift</option></select></div><div><label>Khung</label><select id="elevator-frame"><option value="false">Không</option><option value="true">Có</option></select></div></div>
            <button class="primary-btn" type="submit">＋ Thêm thang vào công trình</button>
          </form><div id="elevator-list"></div>
        </div>
      </section>
      <section data-panel="teams" class="install-panel hidden"><div class="install-card"><h4>Danh mục đội lắp đặt</h4><form id="team-form" class="install-form"><div class="install-grid"><div><label>Mã đội *</label><input id="team-code" required></div><div><label>Tên đội *</label><input id="team-name" required></div></div><button class="primary-btn" type="submit">＋ Thêm đội lắp đặt</button></form><div id="team-list"></div></div></section>
      <section data-panel="techs" class="install-panel hidden"><div class="install-card"><h4>Danh mục kỹ thuật</h4><form id="tech-form" class="install-form"><div class="install-grid"><div><label>Họ và tên *</label><input id="tech-name" required></div><div><label>Số điện thoại *</label><input id="tech-phone" type="tel" required></div></div><button class="primary-btn" type="submit">＋ Thêm kỹ thuật</button></form><div id="tech-list"></div></div></section>
      <section data-panel="logs" class="install-panel hidden"><div class="install-card"><h4>Nhật ký hoạt động gần đây</h4><div id="install-logs"></div></div></section>
    </section>`;
  root.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));
  function showTab(name){root.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));root.querySelectorAll("[data-panel]").forEach(p=>p.classList.toggle("hidden",p.dataset.panel!==name));if(name==="logs")loadLogs();}
  async function loadLogs(){
    const target=$("#install-logs",root);if(!target)return;
    try{
      const snap=await getDocs(query(col("project_activity_logs"),orderBy("createdAt","desc")));
      const rows=snap.docs.slice(0,100).map(d=>({id:d.id,...d.data()}));
      target.innerHTML=rows.length?rows.map(x=>'<div class="install-overview-row"><strong>'+esc(x.action||x.field||"Thay đổi")+'</strong><span>'+esc(x.field||"")+' · '+esc(x.actorUid||"")+'</span></div>').join(""):'<p class="install-empty">Chưa có nhật ký hoạt động.</p>';
    }catch(e){target.textContent="Không tải được nhật ký: "+e.message;}
  }
  async function loadAll(){
    say("Đang tải dữ liệu…");
    try{
      const [p,t,tech,s]=await Promise.all([
        getDocs(query(col("execution_projects"),orderBy("updatedAt","desc"))),
        getDocs(col("installation_teams")),getDocs(col("technicians")),
        getDocs(query(col("projects"),orderBy("createdAt","desc")))
      ]);
      projects=p.docs.map(d=>({id:d.id,...d.data()}));
      teams=t.docs.map(d=>({id:d.id,...d.data()}));
      technicians=tech.docs.map(d=>({id:d.id,...d.data()}));
      sourceProjects=s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.status==="signed");
      renderAll();say("Đã tải dữ liệu.",true);
    }catch(e){say("Không tải được dữ liệu thi công: "+(e.message||e));}
  }
  function renderAll(){
    $("#execution-source",root).innerHTML='<option value="">Chọn công trình đã đăng ký</option>'+sourceProjects.filter(s=>!projects.some(p=>p.sourceProjectId===s.id)).map(s=>'<option value="'+esc(s.id)+'">'+esc(s.projectName)+' · '+esc(s.customerName||"")+' · '+esc(s.siteAddress||"")+'</option>').join("");
    $("#execution-team",root).innerHTML='<option value="">Chưa phân công</option>'+getTeams();
    $("#elevator-team",root).innerHTML='<option value="">Dùng đội mặc định</option>'+getTeams();
    $("#team-list",root).innerHTML=teams.length?'<div class="install-table">'+teams.map(t=>'<div class="install-row"><strong>'+esc(t.teamCode)+'</strong><span>'+esc(t.teamName)+'</span><button data-team-edit="'+esc(t.id)+'">Sửa</button><button data-team-toggle="'+esc(t.id)+'">'+(t.isActive===false?'Kích hoạt':'Ngừng hoạt động')+'</button></div>').join("")+'</div>':'<p class="install-empty">Chưa có đội lắp đặt.</p>';
    $("#tech-list",root).innerHTML=technicians.length?'<div class="install-table">'+technicians.map(t=>'<div class="install-row"><strong>'+esc(t.name)+'</strong><span>'+esc(t.phone)+'</span><button data-tech-edit="'+esc(t.id)+'">Sửa</button><button data-tech-toggle="'+esc(t.id)+'">'+(t.isActive===false?'Kích hoạt':'Ngừng hoạt động')+'</button></div>').join("")+'</div>':'<p class="install-empty">Chưa có kỹ thuật.</p>';
    $("#execution-list",root).innerHTML=projects.length?projects.map(p=>'<button class="install-project-row" data-open-project="'+esc(p.id)+'"><span><strong>'+esc(p.projectName)+'</strong><small>'+esc(p.contractNumber||"Chưa có số HĐ")+' · '+esc(p.siteAddress||"")+'</small></span><b>'+esc(p.status||"NOT_STARTED")+'</b></button>').join(""):'<p class="install-empty">Chưa có hồ sơ thi công.</p>';
    const complete=projects.filter(p=>p.status==="COMPLETED").length;
    $("#install-stats",root).innerHTML='<div><small>Tổng công trình</small><strong>'+projects.length+'</strong></div><div><small>Đang thi công</small><strong>'+projects.filter(p=>p.status==="IN_PROGRESS").length+'</strong></div><div><small>Hoàn thành</small><strong>'+complete+'</strong></div>';
    $("#install-overview-list",root).innerHTML=projects.slice(0,8).map(p=>'<div class="install-overview-row"><strong>'+esc(p.projectName)+'</strong><span>'+esc(p.status||"NOT_STARTED")+'</span></div>').join("")||'<p class="install-empty">Chưa có công trình.</p>';
    root.querySelectorAll("[data-team-toggle]").forEach(b=>b.addEventListener("click",()=>toggleCatalog("installation_teams",b.dataset.teamToggle,teams)));
    root.querySelectorAll("[data-team-edit]").forEach(b=>b.addEventListener("click",()=>editCatalog("installation_teams",b.dataset.teamEdit,teams,"teamCode","teamName")));
    root.querySelectorAll("[data-tech-edit]").forEach(b=>b.addEventListener("click",()=>editCatalog("technicians",b.dataset.techEdit,technicians,"name","phone")));
    root.querySelectorAll("[data-tech-toggle]").forEach(b=>b.addEventListener("click",()=>toggleCatalog("technicians",b.dataset.techToggle,technicians)));
    root.querySelectorAll("[data-open-project]").forEach(b=>b.addEventListener("click",()=>openProject(b.dataset.openProject)));
  }
  async function editCatalog(name,id,rows,fieldA,fieldB){
    const item=rows.find(x=>x.id===id);if(!item)return;
    const a=prompt(fieldA==="teamCode"?"Mã đội":"Họ và tên",item[fieldA]||"");if(a===null)return;
    const b=prompt(fieldB==="teamName"?"Tên đội":"Số điện thoại",item[fieldB]||"");if(b===null)return;
    if(!a.trim()||!b.trim()){say("Thông tin không được để trống.");return;}
    try{
      await updateDoc(doc(db,name,id),{[fieldA]:a.trim(),[fieldB]:b.trim(),updatedAt:serverTimestamp(),updatedBy:user.uid});
      await log(null,null,"catalog_updated",name,{[fieldA]:item[fieldA],[fieldB]:item[fieldB]},{[fieldA]:a.trim(),[fieldB]:b.trim()});
      await loadAll();say("Đã cập nhật danh mục. Snapshot ở kế hoạch cũ được giữ nguyên.",true);
    }catch(e){say("Không sửa được danh mục: "+e.message);}
  }
  async function toggleCatalog(name,id,rows){
    const item=rows.find(x=>x.id===id);if(!item)return;
    try{await updateDoc(doc(db,name,id),{isActive:item.isActive===false,updatedAt:serverTimestamp(),updatedBy:user.uid});await log(null,null,"catalog_status_changed",name,{id,isActive:item.isActive!==false},{id,isActive:item.isActive===false});await loadAll();}
    catch(e){say("Không cập nhật được danh mục: "+e.message);}
  }
  $("#team-form",root).addEventListener("submit",async e=>{
    e.preventDefault();const teamCode=$("#team-code",root).value.trim(),teamName=$("#team-name",root).value.trim();
    if(!teamCode||!teamName)return;
    try{await addDoc(col("installation_teams"),{teamCode,teamName,isActive:true,createdAt:serverTimestamp(),createdBy:user.uid,updatedAt:serverTimestamp(),updatedBy:user.uid});e.target.reset();await loadAll();}
    catch(err){say("Không thêm được đội: "+err.message);}
  });
  $("#tech-form",root).addEventListener("submit",async e=>{
    e.preventDefault();const name=$("#tech-name",root).value.trim(),phone=$("#tech-phone",root).value.trim();
    if(!name||!phone)return;
    try{await addDoc(col("technicians"),{name,phone,isActive:true,createdAt:serverTimestamp(),createdBy:user.uid,updatedAt:serverTimestamp(),updatedBy:user.uid});e.target.reset();await loadAll();}
    catch(err){say("Không thêm được kỹ thuật: "+err.message);}
  });
  $("#execution-create",root).addEventListener("submit",async e=>{
    e.preventDefault();const sourceId=$("#execution-source",root).value,src=sourceProjects.find(x=>x.id===sourceId);if(!src)return;
    const teamId=$("#execution-team",root).value,team=teams.find(x=>x.id===teamId);
    try{
      const ref=await addDoc(col("execution_projects"),{sourceProjectId:src.id,sourceCustomerId:src.customerId||null,contractNumber:$("#execution-contract",root).value.trim(),projectName:src.projectName||"",customerName:src.customerName||"",siteAddress:src.siteAddress||"",provinceCity:src.provinceCity||"",notes:$("#execution-notes",root).value.trim(),defaultTeamId:team?.id||null,defaultTeamCodeSnapshot:team?.teamCode||null,defaultTeamNameSnapshot:team?.teamName||null,status:"NOT_STARTED",createdAt:serverTimestamp(),createdBy:user.uid,updatedAt:serverTimestamp(),updatedBy:user.uid});
      await log(ref.id,null,"execution_project_created","project",null,{sourceProjectId:src.id,projectName:src.projectName,team:team?.teamName||null});
      e.target.reset();await loadAll();await openProject(ref.id);
    }catch(err){say("Không tạo được hồ sơ thi công: "+err.message);}
  });
  async function openProject(id){
    selected=projects.find(p=>p.id===id);if(!selected)return;
    $("#execution-detail",root).classList.remove("hidden");$("#execution-list",root).classList.add("hidden");
    $("#execution-detail-title",root).textContent=selected.projectName;
    $("#execution-detail-meta",root).textContent=(selected.contractNumber||"Chưa có số HĐ")+" · "+(selected.siteAddress||"");
    const snap=await getDocs(collection(db,"execution_projects",id,"elevators"));
    elevators=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderElevators();
  }
  $("#execution-back",root).addEventListener("click",()=>{$("#execution-detail",root).classList.add("hidden");$("#execution-list",root).classList.remove("hidden");});
  $("#elevator-create",root).addEventListener("submit",async e=>{
    e.preventDefault();if(!selected)return;
    const teamId=$("#elevator-team",root).value,team=teams.find(t=>t.id===teamId)||teams.find(t=>t.id===selected.defaultTeamId);
    const data={label:$("#elevator-label",root).value.trim(),capacityKg:Number($("#elevator-capacity",root).value)||null,stops:Number($("#elevator-stops",root).value)||null,tractionMachine:$("#elevator-machine",root).value.trim(),controlCabinet:$("#elevator-cabinet",root).value.trim(),elevatorType:$("#elevator-type",root).value,hasFrame:$("#elevator-frame",root).value==="true",assignedTeamId:team?.id||null,assignedTeamCodeSnapshot:team?.teamCode||null,assignedTeamNameSnapshot:team?.teamName||null,stages:Object.fromEntries(STAGES.map(([k])=>[k,{status:"NOT_STARTED",plannedDate:"",actualDate:""}])),status:"NOT_STARTED",isSuspended:false,createdAt:serverTimestamp(),createdBy:user.uid,updatedAt:serverTimestamp(),updatedBy:user.uid};
    try{const ref=await addDoc(collection(db,"execution_projects",selected.id,"elevators"),data);await log(selected.id,ref.id,"elevator_created","elevator",null,data.label);e.target.reset();await openProject(selected.id);}
    catch(err){say("Không thêm được thang: "+err.message);}
  });
  function renderElevators(){
    const target=$("#elevator-list",root);
    target.innerHTML=elevators.length?elevators.map(el=>{
      const stages=STAGES.map(([key,label])=>{
        const s=el.stages?.[key]||{},isTech=["operation","tapeRemoval"].includes(key);
        const opts=key==="inspection"?[["NOT_INSPECTED","Chưa kiểm định"],["REGISTERED","Đã đăng ký"],["PASSED","Đạt"],["FAILED","Không đạt"]]:key==="handover"?[["NOT_HANDED_OVER","Chưa bàn giao"],["IN_PROGRESS","Đang bàn giao"],["HANDED_OVER","Đã bàn giao"]]:statusValue.map((v,i)=>[v,STATUS[i]]);
        return '<div class="install-stage"><div class="install-stage-title">'+label+'</div><div class="install-grid"><div><label>Trạng thái</label><select data-stage="'+key+'" data-field="status" data-elevator="'+esc(el.id)+'">'+opts.map(([v,n])=>'<option value="'+v+'" '+(s.status===v?'selected':'')+'>'+n+'</option>').join("")+'</select></div><div><label>Ngày dự kiến</label><input type="date" data-stage="'+key+'" data-field="plannedDate" data-elevator="'+esc(el.id)+'" value="'+esc(s.plannedDate||"")+'"></div><div><label>Ngày thực tế</label><input type="date" data-stage="'+key+'" data-field="actualDate" data-elevator="'+esc(el.id)+'" value="'+esc(s.actualDate||"")+'"></div>'+(isTech?'<div><label>Kỹ thuật thực hiện</label><select data-stage="'+key+'" data-field="technicianId" data-elevator="'+esc(el.id)+'"><option value="">Chọn kỹ thuật</option>'+technicians.map(t=>'<option value="'+esc(t.id)+'" '+(s.technicianId===t.id?'selected':'')+'>'+esc(t.name)+' · '+esc(t.phone)+'</option>').join("")+'</select></div>':'')+'</div></div>';
      }).join("");
      return '<article class="install-elevator"><div class="install-elevator-head"><div><h5>'+esc(el.label)+'</h5><p>'+esc(el.capacityKg||"—")+' kg · '+esc(el.stops||"—")+' điểm dừng · '+esc(el.assignedTeamNameSnapshot||"Chưa phân công đội")+'</p></div><button data-team-change="'+esc(el.id)+'" class="quiet-btn">Đổi đội</button></div><div class="install-grid"><div><label>Đội lắp đặt hiện tại</label><select data-elevator-team="'+esc(el.id)+'"><option value="">Chưa phân công</option>'+teams.map(t=>'<option value="'+esc(t.id)+'" '+(el.assignedTeamId===t.id?'selected':'')+'>'+esc(t.teamCode)+' · '+esc(t.teamName)+'</option>').join("")+'</select></div><div><label>Trạng thái thang</label><span class="install-status">'+esc(el.status||"NOT_STARTED")+'</span></div></div><div class="install-stages">'+stages+'</div></article>';
    }).join(""):'<p class="install-empty">Chưa có thang máy trong công trình này.</p>';
    target.querySelectorAll("[data-stage]").forEach(input=>input.addEventListener("change",()=>saveStage(input)));
    target.querySelectorAll("[data-elevator-team]").forEach(input=>input.addEventListener("change",()=>changeTeam(input)));
  }
  async function saveStage(input){
    const elevator=elevators.find(x=>x.id===input.dataset.elevator);if(!elevator)return;
    const key=input.dataset.stage,field=input.dataset.field,value=input.value,old=elevator.stages?.[key]?.[field]??"";
    if(old===value)return;
    const next={...(elevator.stages||{}),[key]:{...(elevator.stages?.[key]||{status:key==="inspection"?"NOT_INSPECTED":key==="handover"?"NOT_HANDED_OVER":"NOT_STARTED",plannedDate:"",actualDate:""}),[field]:value}};
    const s=next[key];
    if(field==="status"){
      if(["shipment","installation","operation","tapeRemoval"].includes(key)&&value==="DONE"&&!s.actualDate){say("Vui lòng nhập ngày thực tế trước khi hoàn thành công đoạn.");input.value=old;return;}
      if(["operation","tapeRemoval"].includes(key)&&value==="DONE"&&!s.technicianId){say("Vui lòng chọn kỹ thuật viên thực hiện.");input.value=old;return;}
      if(key==="inspection"&&value==="PASSED"&&!s.actualDate){say("Kiểm định đạt phải có ngày kiểm định thực tế.");input.value=old;return;}
      if(key==="handover"&&value==="HANDED_OVER"&&(!s.actualDate||next.inspection?.status!=="PASSED")){say("Chỉ được bàn giao khi kiểm định đã đạt và có ngày bàn giao thực tế.");input.value=old;return;}
    }
    if(field==="actualDate"&&value===""&&((key==="handover"&&s.status==="HANDED_OVER")||(key==="inspection"&&s.status==="PASSED")||(s.status==="DONE"))){say("Không thể bỏ ngày thực tế khi công đoạn đã hoàn thành.");input.value=old;return;}
    if(field==="technicianId"&&value){const tech=technicians.find(t=>t.id===value);s.technicianNameSnapshot=tech?.name||"";s.technicianPhoneSnapshot=tech?.phone||"";}
    const elevatorStatus=next.handover?.status==="HANDED_OVER"?"COMPLETED":Object.values(next).some(x=>x.status&& !["NOT_STARTED","NOT_INSPECTED","NOT_HANDED_OVER"].includes(x.status))?"IN_PROGRESS":"NOT_STARTED";
    try{
      await updateDoc(doc(db,"execution_projects",selected.id,"elevators",elevator.id),{stages:next,status:elevatorStatus,updatedAt:serverTimestamp(),updatedBy:user.uid});
      const allSnap=await getDocs(collection(db,"execution_projects",selected.id,"elevators"));
      const all=allSnap.docs.map(d=>d.id===elevator.id?{...d.data(),stages:next}:d.data());
      const projectStatus=all.length&&all.every(x=>x.stages?.handover?.status==="HANDED_OVER")?"COMPLETED":all.some(x=>Object.values(x.stages||{}).some(v=>v.status&& !["NOT_STARTED","NOT_INSPECTED","NOT_HANDED_OVER"].includes(v.status)))?"IN_PROGRESS":"NOT_STARTED";
      await updateDoc(doc(db,"execution_projects",selected.id),{status:projectStatus,updatedAt:serverTimestamp(),updatedBy:user.uid});
      await log(selected.id,elevator.id,"stage_updated",key+"."+field,old,value);
      elevator.stages=next;elevator.status=elevatorStatus;selected.status=projectStatus;renderElevators();say("Đã cập nhật tiến độ.",true);
    }catch(err){say("Không cập nhật được tiến độ: "+err.message);input.value=old;}
  }
  async function changeTeam(input){
    const elevator=elevators.find(x=>x.id===input.dataset.elevatorTeam);if(!elevator)return;
    const team=teams.find(t=>t.id===input.value)||null;
    const old={id:elevator.assignedTeamId||null,name:elevator.assignedTeamNameSnapshot||null};
    const next={id:team?.id||null,code:team?.teamCode||null,name:team?.teamName||null};
    try{await updateDoc(doc(db,"execution_projects",selected.id,"elevators",elevator.id),{assignedTeamId:next.id,assignedTeamCodeSnapshot:next.code,assignedTeamNameSnapshot:next.name,updatedAt:serverTimestamp(),updatedBy:user.uid});await log(selected.id,elevator.id,"team_changed","assignedTeam",old,next);elevator.assignedTeamId=next.id;elevator.assignedTeamNameSnapshot=next.name;say("Đã thay đổi đội lắp đặt.",true);renderElevators();}
    catch(err){say("Không đổi được đội: "+err.message);input.value=old.id||"";}
  }
  $("#install-refresh",root).addEventListener("click",loadAll);
  loadAll();
}
