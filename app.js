"use strict";

const CONTINENTS = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"];
const GRADES = ["G", "VG", "F", "VF", "XF", "AU", "UNC"];
const STATUS_LABELS = { collection: "In collection", missing: "Missing", duplicate: "Duplicate" };
const state = { coins: [], continent: "", view: "cards" };
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function flag(code) {
  return /^[A-Z]{2}$/.test(code || "")
    ? [...code].map(char => String.fromCodePoint(127397 + char.charCodeAt(0))).join("")
    : "";
}

function imagePath(coin) {
  if (!coin.imageFile) return "";
  return `./images/coins/${encodeURIComponent(coin.country)}/${encodeURIComponent(coin.imageFile)}`;
}

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
    for (const key of ["id", "country", "countryCode", "continent", "denomination", "name", "condition", "status", "imageFile", "description", "notes"]) {
      normalized[key] = String(coin[key] ?? "").trim();
    }
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
      if (!Number.isInteger(normalized.year) || normalized.year < 1) throw new Error(`Invalid year for ${normalized.id}.`);
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
        state.continent = button.dataset.continent;
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
  const coins = filteredCoins();
  $("sectionTitle").textContent = state.continent || "All Coins";
  $("resultCount").textContent = `${coins.length} coin${coins.length === 1 ? "" : "s"}`;
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
}

function openCoin(id) {
  const coin = state.coins.find(c => c.id === id);
  if (!coin) return;
  $("coinDetails").innerHTML = `<div class="detail-image">${imageMarkup(coin)}</div><h2>${escapeHtml(coin.name || coin.denomination)}</h2><p>${flag(coin.countryCode)} ${escapeHtml(coin.country)} · ${escapeHtml(coin.continent)}${coin.year === "" ? "" : ` · ${coin.year}`}</p><p>${escapeHtml(coin.denomination)}</p>${badges(coin)}${coin.description ? `<h3>Description</h3><p class="detail-text">${escapeHtml(coin.description)}</p>` : ""}${coin.notes ? `<h3>My notes</h3><p class="detail-text">${escapeHtml(coin.notes)}</p>` : ""}`;
  attachImages($("coinDetails"));
  $("coinDialog").showModal();
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("themeToggle").textContent = theme === "dark" ? "Light" : "Dark";
  try { localStorage.setItem("worldCoinTheme", theme); } catch {}
}

async function initialize() {
  let theme = "light";
  try { theme = localStorage.getItem("worldCoinTheme") === "dark" ? "dark" : "light"; } catch {}
  setTheme(theme);
  $("themeToggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  $("viewToggle").addEventListener("click", () => { state.view = state.view === "cards" ? "table" : "cards"; $("viewToggle").textContent = state.view === "cards" ? "Table" : "Cards"; render(); });
  for (const id of ["countryFilter", "yearFilter", "conditionFilter", "statusFilter", "sortFilter"]) $(id).addEventListener("change", render);
  $("searchInput").addEventListener("input", render);
  $("resetFilters").addEventListener("click", () => { for (const id of ["countryFilter", "yearFilter", "conditionFilter", "statusFilter", "searchInput"]) $(id).value = ""; $("sortFilter").value = "country"; render(); });
  $("closeDialog").addEventListener("click", () => $("coinDialog").close());
  renderContinentCards();
  try {
    const response = await fetch(`./data/coins.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Catalog request failed (${response.status}).`);
    state.coins = normalizeCatalog(await response.json());
    populateFilters(); renderContinentCards(); render();
  } catch (error) {
    $("catalogMessage").hidden = false;
    $("catalogMessage").textContent = `Could not load the catalog. ${error.message}`;
    $("resultCount").textContent = "Catalog unavailable";
  }
}

initialize();
