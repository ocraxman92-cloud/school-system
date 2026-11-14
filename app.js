const $ = (id) => document.getElementById(id);
const STU = "Active,Ka baxay,Qalin-jabiyey";
const REF = {
  classes: { table: "school_classes", label: (r) => r.class_name || "—", rows: [] },
  students: { table: "students", label: (r) => (r.full_name || "—") + (r.student_no ? " (" + r.student_no + ")" : ""), rows: [] },
  exams: { table: "exams", label: (r) => (r.exam_name || "—") + (r.subject ? " - " + r.subject : ""), rows: [] }
};
const MODULES = {
  students: { title: "Ardayda", desc: "Diiwaangeli ardayda. Ardayga lama tirtiro; beddel xaaladdiisa.", table: "students", noDelete: true, fields: [["full_name","Magaca oo buuxa","text"],["student_no","Lambarka ardayga","text"],["gender","Jinsi","select","Lab,Dheddig"],["class_id","Fasalka","ref","classes"],["birth_date","Taariikhda dhalashada","date"],["parent_name","Magaca waalidka","text"],["parent_phone","Telefoonka waalidka","tel"],["address","Cinwaanka","text"],["status","Xaaladda","select",STU]] },
  teachers: { title: "Macallimiinta", desc: "Maamul xogta macallimiinta.", table: "teachers", fields: [["full_name","Magaca oo buuxa","text"],["staff_no","Lambarka shaqaalaha","text"],["subject","Maaddada","text"],["phone","Telefoon","tel"],["email","Email","email"],["status","Xaaladda","select","Active,Ka baxay"]] },
  classes: { title: "Fasallada", desc: "Fasallada iyo tirada ardayda Active ah.", table: "school_classes", countCol: true, fields: [["class_name","Magaca fasalka","text"],["grade_level","Heerka","text"],["room","Qolka","text"],["capacity","Awoodda ardayda","number"]] },
  attendance: { title: "Xaadirinta", desc: "Taariikhda xaadirinta ardayga.", table: "attendance", readOnly: true, order: "attendance_date", fields: [["student_id","Ardayga","ref","students"],["class_id","Fasalka","ref","classes"],["attendance_date","Taariikh","date"],["status","Xaaladda","text"]] },
  exams: { title: "Imtixaannada", desc: "Jadwalka imtixaannada.", table: "exams", fields: [["exam_name","Magaca imtixaanka","text"],["subject","Maaddada","text"],["class_id","Fasalka","ref","classes"],["exam_date","Taariikhda","date"],["total_marks","Dhibcaha guud","number"]] },
  results: { title: "Natiijooyinka", desc: "Dhibcaha ardayda.", table: "results", teacherEdit: true, fields: [["student_id","Ardayga","ref","students"],["exam_id","Imtixaanka","ref","exams"],["subject","Maaddada","text"],["marks","Dhibcaha","number"],["grade","Darajada","text"]] },
  fees: { title: "Lacagaha iskuulka", desc: "Lacagaha ardayda: la rabo iyo la bixiyey.", table: "school_fees", fields: [["student_id","Ardayga","ref","students"],["fee_month","Bisha","month"],["amount_due","La rabo ($)","number"],["amount_paid","La bixiyey ($)","number"],["status","Xaaladda","select","Lacag la'aan,Qayb,La bixiyey"],["paid_at","Taariikhda bixinta","date"]] }
};
const NAV = { admin: null, teacher: ["dashboard","students","classes","attendance","exams","results"], student: ["dashboard","attendance","results","fees"], parent: ["dashboard","attendance","results","fees"] };
const ROLE_SO = { admin: "Maamule", teacher: "Macallin", student: "Arday", parent: "Waalid" };
let sb = null, user = null, role = null, activeModule = "students", editingId = null, records = [], att = {};
const configured = () => window.SUPABASE_URL && window.SUPABASE_ANON_KEY && !/PASTE_/.test(window.SUPABASE_URL + window.SUPABASE_ANON_KEY);
const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
function showMessage(id, msg, error = true) { $(id).textContent = msg; $(id).style.color = error ? "#b42318" : "#16804a"; }
const canEdit = (m) => role === "admin" || (role === "teacher" && !!MODULES[m]?.teacherEdit);
const lab = (k, id) => { const r = REF[k].rows.find((x) => x.id === id); return r ? REF[k].label(r) : "—"; };

async function init() {
  $("today").textContent = new Date().toLocaleDateString("so-SO", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  if (!configured()) return showMessage("loginMessage", "Marka hore ku buuxi config.js xogta Supabase-kaaga.");
  sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const { data: { session } } = await sb.auth.getSession();
  if (session) await enterApp(session.user);
}
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!sb) return showMessage("loginMessage", "Fadlan marka hore diyaari config.js.");
  showMessage("loginMessage", "Waa la hubinayaa...", false);
  const { data, error } = await sb.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
  if (error) return showMessage("loginMessage", "Email ama password waa khaldan yihiin.");
  await enterApp(data.user);
});
async function enterApp(u) {
  user = u;
  const { data: p } = await sb.from("profiles").select("role,full_name").eq("id", u.id).maybeSingle();
  if (!p) { await sb.auth.signOut(); return showMessage("loginMessage", "Akoonkan weli doorka (role) lagama dhigin. La xidhiidh maamulaha."); }
  role = p.role;
  $("loginView").classList.add("hidden"); $("appView").classList.remove("hidden");
  $("userEmail").textContent = u.email || "User"; $("userRole").textContent = ROLE_SO[role] || role;
  $("welcomeName").textContent = p.full_name || (u.email || "").split("@")[0];
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("hidden", !!NAV[role] && !NAV[role].includes(b.dataset.page)));
  await loadRefs(); navigate("dashboard");
}
async function loadRefs() {
  for (const k of Object.keys(REF)) {
    const { data } = await sb.from(REF[k].table).select("*").limit(2000);
    REF[k].rows = data || [];
  }
}
function navigate(page) {
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  $("dashboardPage").classList.toggle("hidden", page !== "dashboard"); $("modulePage").classList.toggle("hidden", page === "dashboard");
  $("pageTitle").textContent = page === "dashboard" ? "Dashboard" : (MODULES[page]?.title || "Warbixinnada");
  if (page === "dashboard") loadDashboard();
  else if (page === "reports") loadReports();
  else if (page === "attendance" && (role === "admin" || role === "teacher")) { activeModule = page; renderAttendance(); }
  else if (MODULES[page]) { activeModule = page; renderModule(); }
  document.querySelector(".sidebar").classList.remove("open");
}
$("nav").addEventListener("click", (e) => { const b = e.target.closest("[data-page]"); if (b) navigate(b.dataset.page); });
document.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.goto)));
$("menuBtn").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));
$("logoutBtn").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });
$("addBtn").addEventListener("click", () => openForm());
$("refreshBtn").addEventListener("click", async () => { await loadRefs(); navigate(activeModule); });
$("searchInput").addEventListener("input", () => renderTable());

async function loadDashboard() {
  const n = (r) => (r.error ? "—" : (r.count ?? 0));
  const head = (t) => sb.from(t).select("*", { count: "exact", head: true });
  const d = todayISO();
  const [s, t, c, a] = await Promise.all([head("students").eq("status", "Active"), head("teachers"), head("school_classes"),
    head("attendance").eq("attendance_date", d).eq("status", "Jooga")]);
  $("studentCount").textContent = n(s); $("teacherCount").textContent = n(t); $("classCount").textContent = n(c); $("attendanceCount").textContent = n(a);
}
function renderModule() {
  const m = MODULES[activeModule];
  $("addBtn").classList.toggle("hidden", !canEdit(activeModule) || !!m.readOnly);
  $("moduleTitle").textContent = m.title; $("moduleDescription").textContent = m.desc;
  $("formPanel").classList.add("hidden"); $("searchInput").value = ""; $("moduleMessage").textContent = ""; loadRecords();
}
async function loadRecords() {
  const m = MODULES[activeModule]; $("tableWrap").innerHTML = "<p class='muted' style='padding:20px'>Xogta ayaa la soo rarayaa...</p>";
  const { data, error } = await sb.from(m.table).select("*").order(m.order || "created_at", { ascending: false }).limit(500);
  if (error) { records = []; $("tableWrap").innerHTML = "<p class='message' style='padding:20px'>" + esc(error.message) + "</p>"; return; }
  records = data || []; renderTable();
}
function cell(f, r) { return f[2] === "ref" ? lab(f[3], r[f[0]]) : (r[f[0]] ?? "—"); }
function renderTable() {
  const m = MODULES[activeModule], term = $("searchInput").value.toLowerCase();
  const rows = records.filter((r) => m.fields.some((f) => String(cell(f, r)).toLowerCase().includes(term)));
  if (!rows.length) { $("tableWrap").innerHTML = "<p class='muted' style='padding:20px'>Wax xog ah lama helin.</p>"; return; }
  const showAct = canEdit(activeModule) && !m.readOnly;
  let h = "<table><thead><tr>" + m.fields.map((f) => `<th>${esc(f[1])}</th>`).join("") + (m.countCol ? "<th>Ardayda</th>" : "") + (showAct ? "<th>Ficil</th>" : "") + "</tr></thead><tbody>";
  h += rows.map((r) => "<tr>" + m.fields.map((f) => `<td>${esc(cell(f, r))}</td>`).join("")
    + (m.countCol ? `<td><b>${REF.students.rows.filter((s) => s.class_id === r.id && s.status === "Active").length}</b></td>` : "")
    + (showAct ? `<td><button data-edit="${esc(r.id)}">Wax ka beddel</button>${role === "admin" && !m.noDelete ? `<button class="danger" data-delete="${esc(r.id)}">Tirtir</button>` : ""}</td>` : "") + "</tr>").join("");
  $("tableWrap").innerHTML = h + "</tbody></table>";
  $("tableWrap").querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openForm(records.find((r) => r.id === b.dataset.edit))));
  $("tableWrap").querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => deleteRecord(b.dataset.delete)));
}
function openForm(record = null) {
  if (!canEdit(activeModule)) return showMessage("moduleMessage", "Rukhsad uma lihid inaad xogtan beddesho.");
  const m = MODULES[activeModule]; editingId = record?.id || null;
  $("formTitle").textContent = editingId ? "Wax ka beddel xogta" : "Ku dar: " + m.title;
  const html = m.fields.map((f, i) => {
    const [name, label, type, extra] = f;
    let val = record?.[name] ?? "";
    let input;
    if (type === "select") {
      if (!val && name === "status") val = extra.split(",")[0];
      input = `<select name="${name}">${"<option value=''>Dooro...</option>"}${extra.split(",").map((v) => `<option ${val === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>`;
    } else if (type === "ref") {
      input = `<select name="${name}"><option value="">Dooro...</option>${REF[extra].rows.map((r) => `<option value="${esc(r.id)}" ${val === r.id ? "selected" : ""}>${esc(REF[extra].label(r))}</option>`).join("")}</select>`;
    } else {
      if (type === "date" && !val && !record) val = todayISO();
      input = `<input name="${name}" type="${type}" value="${esc(val)}" ${i === 0 && type === "text" ? "required" : ""}>`;
    }
    return `<label>${esc(label)}${input}</label>`;
  }).join("");
  $("recordForm").innerHTML = html + `<div class="form-actions"><button class="primary" type="submit">Kaydi</button><button class="secondary" type="button" id="cancelForm">Jooji</button></div>`;
  $("formPanel").classList.remove("hidden"); $("cancelForm").onclick = () => $("formPanel").classList.add("hidden");
  $("recordForm").onsubmit = saveRecord;
}
async function saveRecord(e) {
  e.preventDefault();
  const m = MODULES[activeModule], obj = {};
  for (const f of m.fields) {
    const el = e.target.elements[f[0]]; if (!el) continue;
    let v = el.value.trim();
    if (v === "") v = null; else if (f[2] === "number") v = Number(v);
    obj[f[0]] = v;
  }
  if (activeModule === "students") {
    obj.class_name = obj.class_id ? lab("classes", obj.class_id) : null;
    if (obj.status === "Ka baxay" || obj.status === "Qalin-jabiyey") obj.left_at = todayISO(); else obj.left_at = null;
  }
  const req = editingId ? sb.from(m.table).update(obj).eq("id", editingId) : sb.from(m.table).insert(obj);
  const { error } = await req; if (error) return showMessage("moduleMessage", "Khalad: " + error.message);
  $("formPanel").classList.add("hidden"); showMessage("moduleMessage", "Xogta waa la kaydiyey.", false);
  await loadRefs(); await loadRecords();
}
async function deleteRecord(id) {
  const m = MODULES[activeModule];
  if (role !== "admin" || m.noDelete || !confirm("Ma hubtaa inaad tirtirayso xogtan?")) return;
  const { error } = await sb.from(m.table).delete().eq("id", id);
  if (error) return showMessage("moduleMessage", error.message);
  await loadRefs(); await loadRecords();
}

/* Xaadirinta maalinlaha ah (✓ Jooga / X Maqan) */
function renderAttendance() {
  $("addBtn").classList.add("hidden"); $("formPanel").classList.add("hidden"); $("moduleMessage").textContent = "";
  $("moduleTitle").textContent = "Xaadirinta maalinlaha ah"; $("moduleDescription").textContent = "Dooro fasalka iyo taariikhda, kadibna calaamadee ardayda.";
  const cls = REF.classes.rows;
  if (!cls.length) { $("tableWrap").innerHTML = "<p class='muted' style='padding:20px'>Fasal lama aad loo xilsaarin. La xidhiidh maamulaha.</p>"; return; }
  $("tableWrap").innerHTML = `<div class="att-bar"><select id="attClass">${cls.map((c) => `<option value="${esc(c.id)}">${esc(c.class_name)}</option>`).join("")}</select><input id="attDate" type="date" value="${todayISO()}"><button class="secondary" id="attAll">✓ Dhammaan Jooga</button><button class="primary" id="attSave">Kaydi</button></div><div id="attList"></div>`;
  $("attClass").onchange = loadAttendance; $("attDate").onchange = loadAttendance;
  $("attAll").onclick = () => { stuOf().forEach((s) => (att[s.id] = "Jooga")); drawAtt(); };
  $("attSave").onclick = saveAttendance;
  $("attList").addEventListener("click", (e) => { const b = e.target.closest("[data-s]"); if (b) { att[b.dataset.id] = b.dataset.s; drawAtt(); } });
  loadAttendance();
}
const stuOf = () => REF.students.rows.filter((s) => s.class_id === $("attClass").value && s.status === "Active");
async function loadAttendance() {
  att = {};
  const { data, error } = await sb.from("attendance").select("student_id,status").eq("class_id", $("attClass").value).eq("attendance_date", $("attDate").value);
  if (error) return showMessage("moduleMessage", error.message);
  (data || []).forEach((r) => { att[r.student_id] = r.status === "Maqan" || r.status === "Absent" ? "Maqan" : "Jooga"; });
  drawAtt();
}
function drawAtt() {
  const list = stuOf();
  $("attList").innerHTML = list.length ? list.map((s) => `<div class="att-row"><span>${esc(s.full_name)}</span><span><button class="att-btn ${att[s.id] === "Jooga" ? "pres" : ""}" data-id="${esc(s.id)}" data-s="Jooga">✓ Jooga</button><button class="att-btn ${att[s.id] === "Maqan" ? "abs" : ""}" data-id="${esc(s.id)}" data-s="Maqan">X Maqan</button></span></div>`).join("") : "<p class='muted' style='padding:20px'>Fasalkan ardayda Active ah ma laha.</p>";
}
async function saveAttendance() {
  const rows = stuOf().filter((s) => att[s.id]).map((s) => ({ student_id: s.id, class_id: $("attClass").value, attendance_date: $("attDate").value, status: att[s.id] }));
  if (!rows.length) return showMessage("moduleMessage", "Marka hore calaamadee ugu yaraan hal arday.");
  const { error } = await sb.from("attendance").upsert(rows, { onConflict: "student_id,attendance_date" });
  if (error) return showMessage("moduleMessage", "Khalad: " + error.message);
  showMessage("moduleMessage", `Xaadirinta ${$("attDate").value} waa la kaydiyey (${rows.length} arday).`, false);
}

/* Warbixinnada (Admin) */
async function loadReports() {
  $("moduleTitle").textContent = "Warbixinnada"; $("moduleDescription").textContent = "Tirakoobka fasallada iyo xaadirinta maanta.";
  $("addBtn").classList.add("hidden"); $("formPanel").classList.add("hidden");
  const d = todayISO();
  const [a, f] = await Promise.all([sb.from("attendance").select("class_id,status").eq("attendance_date", d), sb.from("school_fees").select("amount_due,amount_paid")]);
  const att = a.data || [], st = REF.students.rows;
  const cnt = (s) => st.filter((x) => x.status === s).length;
  const due = (f.data || []).reduce((t, r) => t + (Number(r.amount_due) || 0), 0), paid = (f.data || []).reduce((t, r) => t + (Number(r.amount_paid) || 0), 0);
  const stat = (l, v) => `<article class="stat"><div><small>${l}</small><strong>${v}</strong></div></article>`;
  $("tableWrap").innerHTML = `<div class="stats" style="padding:18px">${stat("Ardayda Active", cnt("Active"))}${stat("Ka baxay", cnt("Ka baxay"))}${stat("Qalin-jabiyey", cnt("Qalin-jabiyey"))}${stat("Lacag la rabo / la bixiyey", "$" + due + " / $" + paid)}</div>`
    + `<table><thead><tr><th>Fasalka</th><th>Ardayda Active</th><th>Jooga maanta</th><th>Maqan maanta</th></tr></thead><tbody>`
    + REF.classes.rows.map((c) => `<tr><td>${esc(c.class_name)}</td><td>${st.filter((s) => s.class_id === c.id && s.status === "Active").length}</td><td>${att.filter((r) => r.class_id === c.id && r.status === "Jooga").length}</td><td>${att.filter((r) => r.class_id === c.id && r.status === "Maqan").length}</td></tr>`).join("") + "</tbody></table>";
}
init();
