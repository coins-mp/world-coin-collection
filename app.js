"use strict";

const CONTINENTS = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"];
const GRADES = ["G", "VG", "F", "VF", "XF", "AU", "UNC"];
const STATUS_LABELS = { collection: "In collection", missing: "Missing", duplicate: "Duplicate", found: "Found" };
const state = { coins: [], continent: "", view: "cards", page: 1 };
let local=false, selectedId="", activePhoto="", countryCodes={}, zoomScale=1;
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function flag(code) {
  return /^[A-Z]{2}$/.test(code || "")
    ? [...code].map(char => String.fromCodePoint(127397 + char.charCodeAt(0))).join("")
    : "";
}

function safeImage(path) {
  return /^images\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(path||'') || (/^images\/coins\/[^/]+\/[^/]+\.(jpg|jpeg|png|webp)$/i.test(path||'') && !path.split('/').some(p=>p==='.'||p==='..'));
}
function photos(coin) {
  const legacy=coin.image || (coin.imageFile?`images/coins/${coin.country}/${coin.imageFile}`:'');
  return [...new Set([...(coin.images||[]),legacy].filter(safeImage))];
}
function imagePath(coin) { return photos(coin)[0] || ''; }
function imageTag(path,alt) { return safeImage(path)?`<img src="${escapeHtml(path)}" alt="${escapeHtml(alt)}">`:'<span class="placeholder">No image</span>'; }

function imageMarkup(coin) {
  const path = imagePath(coin);
  return path
    ? `<img src="${escapeHtml(path)}" alt="${escapeHtml(coin.name || coin.denomination)}" loading="lazy">`
    : `<span class="placeholder">${escapeHtml(coin.denomination)}</span>`;
}

function badges(coin) {
  return `<span class="badges">${coin.condition ? `<span class="badge quality">${escapeHtml(coin.condition)}</span>` : ""}<span class="badge ${coin.status}">${STATUS_LABELS[coin.status]}</span></span>`;
}

function normalizeCatalog(raw) {
  if (!Array.isArray(raw)) throw new Error("Catalog must contain an array.");
  const ids = new Set();
  return raw.map(coin => {
    if (!coin || typeof coin !== "object") throw new Error("Invalid coin record.");
    const normalized = { ...coin };
    for (const key of ["id", "country", "countryCode", "continent", "denomination", "name", "condition", "status", "imageFile", "notes"]) {
      normalized[key] = String(coin[key] ?? "").trim();
    }
    normalized.description = Array.isArray(coin.description)?coin.description:(coin.description?[{text:String(coin.description)}]:[]);
    normalized.images = Array.isArray(coin.images)?coin.images:[];
    normalized.countryCode=countryCodes[coin.country]||normalized.countryCode;
    normalized.status = normalized.status.toLowerCase() || "collection";
    normalized.countryCode = normalized.countryCode.toUpperCase();
    normalized.condition = normalized.condition.toUpperCase();
    if (!normalized.id || ids.has(normalized.id)) throw new Error("Each coin requires a unique ID.");
    if (!normalized.country || !normalized.denomination) throw new Error(`Country and denomination are required for ${normalized.id}.`);
    if (!CONTINENTS.includes(normalized.continent)) throw new Error(`Invalid continent for ${normalized.id}.`);
    if (!Object.hasOwn(STATUS_LABELS, normalized.status)) throw new Error(`Invalid status for ${normalized.id}.`);
    if (coin.year === "" || coin.year === null || coin.year === undefined) normalized.year = "";
    else {
      normalized.year = Number(coin.year);
      if (!Number.isInteger(normalized.year) || normalized.year < -9999 || normalized.year > 9999) throw new Error(`Invalid year for ${normalized.id}.`);
    }
    ids.add(normalized.id);
    return normalized;
  });
}

function filteredCoins() {
  const query = $("searchInput").value.trim().toLowerCase();
  const coins = state.coins.filter(coin =>
    (!state.continent || coin.continent === state.continent) &&
    (!$("countryFilter").value || coin.country === $("countryFilter").value) &&
    (!$("yearFilter").value || String(coin.year) === $("yearFilter").value) &&
    (!$("conditionFilter").value || coin.condition === $("conditionFilter").value) &&
    (!$("statusFilter").value || coin.status === $("statusFilter").value) &&
    (!query || [coin.country, coin.name, coin.denomination, coin.year].join(" ").toLowerCase().includes(query))
  );
  const sort = $("sortFilter").value;
  return coins.sort((a, b) => {
    if (sort.startsWith("year")) {
      if (a.year === "" && b.year !== "") return 1;
      if (b.year === "" && a.year !== "") return -1;
      const result = sort === "year-desc" ? Number(b.year) - Number(a.year) : Number(a.year) - Number(b.year);
      if (result) return result;
    }
    return a.country.localeCompare(b.country, "en") || (a.name || a.denomination).localeCompare(b.name || b.denomination, "en");
  });
}

function populateOptions(id, values, label) {
  const select = $(id);
  const previous = select.value;
  select.replaceChildren(new Option(label, ""), ...values.map(value => new Option(String(value), String(value))));
  if (values.some(value => String(value) === previous)) select.value = previous;
}

function populateFilters() {
  const coins = state.coins.filter(coin => !state.continent || coin.continent === state.continent);
  populateOptions("countryFilter", [...new Set(coins.map(c => c.country))].sort((a, b) => a.localeCompare(b, "en")), "All countries");
  populateOptions("yearFilter", [...new Set(coins.map(c => c.year).filter(y => y !== ""))].sort((a, b) => b - a), "All years");
  populateOptions("conditionFilter", [...new Set(coins.map(c => c.condition).filter(Boolean))].sort((a, b) => (GRADES.indexOf(a) < 0 ? 99 : GRADES.indexOf(a)) - (GRADES.indexOf(b) < 0 ? 99 : GRADES.indexOf(b)) || a.localeCompare(b)), "All conditions");
}

function renderContinentCards() {
  const artwork = {
    "Africa": "africa",
    "Asia": "asia",
    "Europe": "europe",
    "North America": "north-america",
    "South America": "south-america",
    "Oceania": "oceania"
  };

  $("continentCards").innerHTML = ["", ...CONTINENTS]
    .map(continent => {
      const map = continent
        ? `<img class="continent-map" src="images/maps/continents/${artwork[continent]}-rectangular.jpeg" alt="" aria-hidden="true" style="object-fit:cover">`
        : `<img class="continent-map"
                src="images/maps/world-map.jpg"
                alt="">`;

      const count = state.coins.filter(
        coin => !continent || coin.continent === continent
      ).length;

      return `
        <button type="button"
                class="stat-card"
                data-continent="${continent}"
                aria-pressed="${state.continent === continent}">
          ${map}
          <span class="stat-label">
            ${continent || "All Coins"}
          </span>
          <span class="stat-value">${count}</span>
        </button>
      `;
    })
    .join("");

  $("continentCards").querySelectorAll("button")
    .forEach(button => {
      button.addEventListener("click", () => {
        state.continent = button.dataset.continent; state.page=1;
        $("countryFilter").value = "";

        populateFilters();
        renderContinentCards();
        render();

        $("sectionTitle").scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    });
}

function attachImages(container) {
  container.querySelectorAll("img").forEach(img => img.addEventListener("error", () => {
    const placeholder = document.createElement("span");
    placeholder.className = "placeholder";
    placeholder.textContent = "No image";
    img.replaceWith(placeholder);
  }, { once: true }));
}

function render() {
  const allCoins = filteredCoins();
  state.page=Math.max(1,Math.min(state.page,Math.ceil(allCoins.length/24)||1));
  const coins=allCoins.slice((state.page-1)*24,state.page*24);
  $("sectionTitle").textContent = state.continent || "All Coins";
  $("resultCount").textContent = `${allCoins.length} coin${allCoins.length === 1 ? "" : "s"}`;
  $("catalogMessage").hidden = coins.length > 0;
  $("catalogMessage").textContent = state.coins.length ? "No coins match the selected filters." : "Your world coin collection is ready. No coins have been added yet.";
  $("coinGrid").hidden = state.view !== "cards";
  $("tableWrap").hidden = state.view !== "table" || coins.length === 0;
  $("coinGrid").innerHTML = coins.map(coin => `<button type="button" class="coin-card" data-id="${escapeHtml(coin.id)}" aria-label="Open ${escapeHtml(coin.country)} ${escapeHtml(coin.name || coin.denomination)}"><span class="coin-image">${imageMarkup(coin)}</span><span class="coin-info"><span class="coin-top"><span>${flag(coin.countryCode)} ${escapeHtml(coin.country)}</span><span>${escapeHtml(coin.year)}</span></span><span class="coin-name">${escapeHtml(coin.name || coin.denomination)}</span><span class="coin-meta">${escapeHtml(coin.denomination)} · ${escapeHtml(coin.continent)}</span>${badges(coin)}</span></button>`).join("");
  $("tableBody").innerHTML = coins.map(coin => `<tr><td>${flag(coin.countryCode)} ${escapeHtml(coin.country)}</td><td>${escapeHtml(coin.continent)}</td><td>${escapeHtml(coin.year)}</td><td><button class="coin-table-button" type="button" data-id="${escapeHtml(coin.id)}">${escapeHtml(coin.name || coin.denomination)}</button></td><td>${escapeHtml(coin.denomination)}</td><td>${escapeHtml(coin.condition)}</td><td>${STATUS_LABELS[coin.status]}</td></tr>`).join("");
  for (const container of [$("coinGrid"), $("tableBody")]) {
    container.querySelectorAll("[data-id]").forEach(button => button.addEventListener("click", () => openCoin(button.dataset.id)));
  }
  attachImages($("coinGrid"));
  const pages=Math.ceil(allCoins.length/24);
  $('pagination').innerHTML=pages>1?Array.from({length:pages},(_,i)=>`<button class="secondary-btn ${state.page===i+1?'selected':''}" data-page="${i+1}" aria-label="Page ${i+1}" ${state.page===i+1?'aria-current="page"':''}>${i+1}</button>`).join(''):'';
  $('pagination').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.page=Number(b.dataset.page);render();$('sectionTitle').scrollIntoView({behavior:'smooth'});});
}

function blocksMarkup(coin) {
  return (coin.description||[]).map(b=>`<article class="description-block ${b.image?'with-image':''}">${safeImage(b.image)?`<figure><button class="description-image" type="button" data-image="${escapeHtml(b.image)}">${imageTag(b.image,b.caption||b.title||coin.name)}</button>${b.caption?`<figcaption>${escapeHtml(b.caption)}</figcaption>`:''}</figure>`:''}<div>${b.title?`<h4>${escapeHtml(b.title)}</h4>`:''}${b.text?`<p>${escapeHtml(b.text)}</p>`:''}${/^https?:\/\//.test(b.link||'')?`<a href="${escapeHtml(b.link)}" target="_blank" rel="noopener noreferrer">Read more</a>`:''}</div></article>`).join('') || '<p class="muted">No description yet.</p>';
}
function selectPhoto(path,coin) {
  activePhoto=path;$('mainPhoto').innerHTML=imageTag(path,coin.name||coin.denomination);$('mainPhoto').disabled=!safeImage(path);
  $('photoThumbnails').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.image===path)));
}
function openCoin(id) {
  const coin=state.coins.find(c=>c.id===id);if(!coin)return;selectedId=id;
  const images=photos(coin);
  $('photoThumbnails').innerHTML=images.length>1?images.map((path,i)=>`<button type="button" data-image="${escapeHtml(path)}" aria-label="Photograph ${i+1}" aria-pressed="false">${imageTag(path,`Photograph ${i+1}`)}</button>`).join(''):'';
  $('photoThumbnails').querySelectorAll('button').forEach(b=>b.onclick=()=>selectPhoto(b.dataset.image,coin));
  selectPhoto(images[0]||'',coin);
  $('mainPhoto').onclick=()=>zoom(activePhoto,coin.name||coin.denomination);
  $('coinSummary').innerHTML=`<p class="summary-country">${flag(coin.countryCode)} ${escapeHtml(coin.country)} <span>${escapeHtml(coin.year)}</span></p><h2>${escapeHtml(coin.name||coin.denomination)}</h2><p class="muted">${escapeHtml(coin.denomination)} · ${escapeHtml(coin.continent)}</p>${badges(coin)}`;
  const details=[['Country',coin.country],['Year',coin.year],['Denomination',coin.denomination],['Condition',coin.condition],['Metal',coin.metal],['Weight',coin.weight],['Diameter',coin.diameter],['Mint',coin.mint],['Mintage',coin.mintage],...(coin.details||[]).map(d=>[d.label,d.value])].filter(([k,v])=>v!==''&&v!==undefined&&v!==null);
  $('coinDetails').innerHTML=details.map(([k,v])=>`<div class="detail-box"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join('');
  $('coinDescription').innerHTML=blocksMarkup(coin);
  $('coinDescription').querySelectorAll('[data-image]').forEach(b=>b.onclick=()=>zoom(b.dataset.image,coin.name));
  $('coinNotes').innerHTML=coin.notes?`<h3>My notes</h3><p>${escapeHtml(coin.notes)}</p>`:'';
  const list=filteredCoins(),i=list.findIndex(c=>c.id===id),label=c=>c?`${c.country}${c.year!==''?' · '+c.year:''}`:'—';
  $('previousCoin').disabled=i<=0;$('nextCoin').disabled=i>=list.length-1;$('previousLabel').textContent=label(list[i-1]);$('nextLabel').textContent=label(list[i+1]);$('coinPosition').textContent=`${i+1} / ${list.length}`;
  $('descriptionScroll').scrollTop=0;
  if(!$('coinDialog').open)$('coinDialog').showModal();
}
function navigate(delta){const list=filteredCoins(),i=list.findIndex(c=>c.id===selectedId);if(list[i+delta])openCoin(list[i+delta].id);}
function readDescription(){
  const coin=state.coins.find(c=>c.id===selectedId);if(!coin)return;
  $('readingContent').innerHTML=`<h2>${escapeHtml(coin.name||coin.denomination)}</h2><p class="muted">${flag(coin.countryCode)} ${escapeHtml(coin.country)} · ${escapeHtml(coin.year)}</p><h3>Description</h3>`+blocksMarkup(coin)+$('coinNotes').innerHTML;
  $('readingContent').querySelectorAll('[data-image]').forEach(b=>{const img=b.querySelector('img');if(img)b.replaceWith(img);});
  $('descriptionDialog').showModal();$('descriptionDialog').scrollTop=0;
}
function applyZoom(){
  const viewport=$('zoomViewport'),img=$('zoomImage'),fit=Math.min(viewport.clientWidth/img.naturalWidth,viewport.clientHeight/img.naturalHeight);
  if(!Number.isFinite(fit)||fit<=0)return;
  img.style.width=`${img.naturalWidth*fit*zoomScale}px`;img.style.height=`${img.naturalHeight*fit*zoomScale}px`;img.style.cursor=zoomScale===1?'zoom-in':'zoom-out';
}
function zoom(path,alt){if(!safeImage(path))return;zoomScale=1;$('zoomImage').onload=applyZoom;$('zoomImage').src=path;$('zoomImage').alt=alt||'';$('zoomDialog').showModal();requestAnimationFrame(applyZoom);}
function toggleZoom(event){
  const img=$('zoomImage'),viewport=$('zoomViewport');if(!img.naturalWidth)return;
  if(zoomScale!==1){zoomScale=1;applyZoom();viewport.scrollLeft=0;viewport.scrollTop=0;return;}
  const rect=img.getBoundingClientRect(),x=event.clientX===undefined?.5:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y=event.clientY===undefined?.5:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));
  zoomScale=3;applyZoom();requestAnimationFrame(()=>{viewport.scrollLeft=img.offsetLeft+x*img.clientWidth-viewport.clientWidth/2;viewport.scrollTop=img.offsetTop+y*img.clientHeight-viewport.clientHeight/2;});
}
function bindViewer(){
  $('closeZoom').onclick=()=>$('zoomDialog').close();$('zoomImage').onclick=toggleZoom;$('zoomImage').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleZoom({});}};
  $('zoomDialog').onclick=e=>{if(e.target===$('zoomDialog')||e.target===$('zoomViewport'))$('zoomDialog').close();};
  $('closeDescription').onclick=()=>$('descriptionDialog').close();$('expandDescription').onclick=readDescription;
  $('descriptionDialog').onclick=e=>{const img=e.target.closest('img');if(img)zoom(img.getAttribute('src'),img.alt);else if(!e.target.closest('a'))$('descriptionDialog').close();};
  $('coinDescription').onclick=e=>{if(!e.target.closest('button,a'))readDescription();};
  $('previousCoin').onclick=()=>navigate(-1);$('nextCoin').onclick=()=>navigate(1);
  window.addEventListener('resize',()=>{if($('zoomDialog').open)applyZoom();});
  $('coinDialog').onclick=e=>{if(e.target===$('coinDialog'))$('coinDialog').close();};
}
function startHeartbeat(){
  const clientId=crypto.randomUUID();let last=Date.now();for(const e of ['pointerdown','keydown','wheel','touchstart'])document.addEventListener(e,()=>last=Date.now(),{passive:true});
  const beat=()=>fetch('/api/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,idleSeconds:(Date.now()-last)/1000})}).catch(()=>{});beat();let timer=setInterval(beat,15000);
  window.addEventListener('pagehide',()=>{clearInterval(timer);navigator.sendBeacon('/api/leave',new Blob([JSON.stringify({clientId})],{type:'application/json'}));});window.addEventListener('pageshow',e=>{if(e.persisted){last=Date.now();beat();timer=setInterval(beat,15000);}});
}
async function loadCatalog(){
  const response=await fetch(local?'/api/catalog':'data/coins.json',{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Catalog unavailable');
  state.coins=normalizeCatalog(local?data.coins:data).filter(c=>local||c.status!=='found');
  if(local)$('pendingCount').textContent=`Local mode · ${data.pending.length} pending change${data.pending.length===1?'':'s'}`;
  populateFilters();renderContinentCards();render();
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("themeToggle").textContent = theme === "dark" ? "☀️ Light" : "🌙 Dark";
  try { localStorage.setItem("worldCoinTheme", theme); } catch {}
}

async function initialize() {
  bindViewer();
  let theme = "light";
  try { theme = localStorage.getItem("worldCoinTheme") === "dark" ? "dark" : "light"; } catch {}
  setTheme(theme);
  $("themeToggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  $("viewToggle").addEventListener("click", () => { state.view = state.view === "cards" ? "table" : "cards"; $("viewToggle").textContent = state.view === "cards" ? "▦ Table" : "▦ Cards"; render(); });
  for (const id of ["countryFilter", "yearFilter", "conditionFilter", "statusFilter", "sortFilter"]) $(id).addEventListener("change",()=>{state.page=1;render();});
  $("searchInput").addEventListener("input",()=>{state.page=1;render();});
  $("resetFilters").addEventListener("click", () => { for (const id of ["countryFilter", "yearFilter", "conditionFilter", "statusFilter", "searchInput"]) $(id).value = ""; $("sortFilter").value = "country"; state.page=1;render(); });
  $("closeDialog").addEventListener("click", () => $("coinDialog").close());
  renderContinentCards();
  try {
    const codes=await fetch('data/countries.json');if(codes.ok)countryCodes=await codes.json();
    if(['localhost','127.0.0.1'].includes(location.hostname)){try{const r=await fetch('/api/info');local=r.ok&&(await r.json()).project==='world';}catch{}}
    if(local){$('localStrip').hidden=false;$('foundOption').hidden=false;document.querySelectorAll('a[href="https://coins-mp.github.io/"]').forEach(a=>a.href='http://127.0.0.1:8765/');document.querySelectorAll('a[href="https://coins-mp.github.io/zero-euro-collection/"]').forEach(a=>a.href='http://127.0.0.1:8767/');startHeartbeat();}
    $('reloadCatalog').onclick=()=>loadCatalog().catch(e=>{ $('catalogMessage').hidden=false;$('catalogMessage').textContent=e.message;});
    await loadCatalog();
  } catch (error) {
    $("catalogMessage").hidden = false;
    $("catalogMessage").textContent = `Could not load the catalog. ${error.message}`;
    $("resultCount").textContent = "Catalog unavailable";
  }
}

initialize();
