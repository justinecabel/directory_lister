const baseHost = window.location.hostname || "localhost";
const sortBtn = document.getElementById("sort");
const refreshBtn = document.getElementById("refresh");
const searchInput = document.getElementById("search");
const themeBtn = document.getElementById("theme");
const tabsContainer = document.getElementById("tabs-container");
const contentContainer = document.getElementById("content-container");

let allData = {};
let categories = [];
let sortModePerTab = {};
let activeTab = "";
const THEME_KEY = "theme-mode";
let themeMode = "dark";

const applyTheme = (mode) => {
  const root = document.documentElement;
  root.setAttribute("data-theme", mode);
  const isLight = mode === "light";
  themeBtn.textContent = isLight ? "☀" : "☾";
  const label = isLight ? "Light theme enabled" : "Dark theme enabled";
  themeBtn.setAttribute("aria-label", `${label}. Click to switch.`);
  themeBtn.setAttribute("title", `${label}. Click to switch.`);
};

const loadTheme = () => {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") {
    themeMode = saved;
  } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    themeMode = "light";
  }
  applyTheme(themeMode);
};

const toggleTheme = () => {
  themeMode = themeMode === "light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, themeMode);
  applyTheme(themeMode);
};

const normalizeStatus = (status) => {
  const value = String(status || "").trim().toLowerCase();
  if (value === "up") return "up";
  if (value === "down") return "down";
  return "checking";
};

const getStatusLabel = (status) => {
  if (status === "up") return "UP";
  if (status === "down") return "DOWN";
  return "CHECKING";
};

const createIndexedData = (data) => {
  const nextData = {};

  Object.keys(data).forEach((category) => {
    if (!Array.isArray(data[category]) || data[category].length === 0) return;
    nextData[category] = data[category].map((app, index) => ({
      ...app,
      status: normalizeStatus(app.status),
      _index: index
    }));
  });

  return nextData;
};

const switchTab = (tab) => {
  activeTab = tab;
  document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));

  document.querySelector(`[data-tab="${tab}"]`).classList.add("active");
  document.getElementById(`${tab}-content`).classList.add("active");

  if (tab === "all") {
    categories.forEach((category) => {
      const heading = document.getElementById(`${category}-all-heading`);
      if (heading) heading.style.display = "block";
    });
  } else {
    categories.forEach((category) => {
      const heading = document.getElementById(`${category}-all-heading`);
      if (heading) heading.style.display = "none";
    });
  }

  const currentSort = sortModePerTab[tab] || "list";
  if (currentSort === "list") {
    sortBtn.textContent = "Sort: List";
  } else if (currentSort === "az") {
    sortBtn.textContent = "Sort: A-Z";
  } else {
    sortBtn.textContent = "Sort: Z-A";
  }
};

const createDynamicTabs = (data) => {
  categories = Object.keys(data).sort().reverse();
  if (categories.length === 0) return;

  tabsContainer.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = "tab-button active";
  allBtn.dataset.tab = "all";
  allBtn.textContent = "all";
  allBtn.addEventListener("click", () => switchTab("all"));
  tabsContainer.appendChild(allBtn);

  categories.forEach((category) => {
    const btn = document.createElement("button");
    btn.className = "tab-button";
    btn.dataset.tab = category;
    btn.textContent = category;
    btn.addEventListener("click", () => switchTab(category));
    tabsContainer.appendChild(btn);
  });

  contentContainer.innerHTML = "";

  const allContent = document.createElement("div");
  allContent.className = "tab-content active";
  allContent.id = "all-content";

  let allHTML = "";
  categories.forEach((category) => {
    allHTML += `<h2 id="${category}-all-heading" style="font-size: 18px; margin: 0 0 16px; color: var(--muted);">${category}</h2>`;
    allHTML += `<section class="grid" id="${category}-all-grid"></section>`;
  });
  allContent.innerHTML = allHTML;
  contentContainer.appendChild(allContent);

  categories.forEach((category) => {
    const content = document.createElement("div");
    content.className = "tab-content";
    content.id = `${category}-content`;
    content.innerHTML = `
      <h2 id="${category}-heading" style="font-size: 18px; margin: 0 0 16px; color: var(--muted); display: none;">${category}</h2>
      <section class="grid" id="${category}-grid"></section>
      <div class="empty" id="${category}-empty" hidden>No ${category} found.</div>
    `;
    contentContainer.appendChild(content);
  });

  activeTab = "all";
};

const buildUrl = (app) => {
  const protocol = app.protocol || "http";
  return `${protocol}://${baseHost}:${app.path}`;
};

const getAppKey = (app, category) => {
  if (app.port) {
    return `${category}::${app.name}::${app.port}`;
  }
  return `${category}::${app.name}::${app.protocol || "http"}::${app.path}`;
};

const renderCards = (items, category) => {
  const grid = document.getElementById(`${category}-grid`);
  const emptyState = document.getElementById(`${category}-empty`);

  grid.innerHTML = "";
  if (!items.length) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  items.forEach((app, index) => {
    const card = document.createElement("article");
    card.className = "card";
    card.style.animationDelay = `${index * 40}ms`;

    const status = normalizeStatus(app.status);
    const key = getAppKey(app, category);

    let cardHTML = `
      <div class="card-head">
        <h3>${app.name}</h3>
        <span class="status status-${status}" data-app-key="${key}">${getStatusLabel(status)}</span>
      </div>
    `;

    if (app.webapp === true && app.path) {
      const url = buildUrl(app);
      cardHTML += `
        <div class="actions">
          <a href="${url}" target="_blank" rel="noopener">Open</a>
          <a class="secondary" href="${url}" target="_self">Open Here</a>
        </div>
      `;
    }

    card.innerHTML = cardHTML;
    grid.appendChild(card);
  });
};

const renderCardsForAll = (items, category) => {
  const grid = document.getElementById(`${category}-all-grid`);
  if (!grid) return;

  grid.innerHTML = "";
  items.forEach((app, index) => {
    const card = document.createElement("article");
    card.className = "card";
    card.style.animationDelay = `${index * 40}ms`;

    const status = normalizeStatus(app.status);
    const key = getAppKey(app, category);

    let cardHTML = `
      <div class="card-head">
        <h3>${app.name}</h3>
        <span class="status status-${status}" data-app-key="${key}">${getStatusLabel(status)}</span>
      </div>
    `;

    if (app.webapp === true && app.path) {
      const url = buildUrl(app);
      cardHTML += `
        <div class="actions">
          <a href="${url}" target="_blank" rel="noopener">Open</a>
          <a class="secondary" href="${url}" target="_self">Open Here</a>
        </div>
      `;
    }

    card.innerHTML = cardHTML;
    grid.appendChild(card);
  });
};

const applyFilters = () => {
  const query = searchInput.value.trim().toLowerCase();
  const hasQuery = query.length > 0;

  categories.forEach((category) => {
    let filtered = allData[category].filter((app) => {
      const searchText = app.name + (app.path || "") + (app.port || "") + (app.protocol || "");
      return searchText.toLowerCase().includes(query);
    });

    const currentSort = sortModePerTab[activeTab] || "list";
    if (currentSort === "list") {
      filtered = filtered.sort((a, b) => a._index - b._index);
    } else if (currentSort === "az") {
      filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      filtered = filtered.sort((a, b) => b.name.localeCompare(a.name));
    }

    renderCards(filtered, category);
    renderCardsForAll(filtered, category);

    const tabBtn = document.querySelector(`[data-tab="${category}"]`);
    const content = document.getElementById(`${category}-content`);
    const heading = document.getElementById(`${category}-heading`);

    if (hasQuery) {
      if (tabBtn) tabBtn.classList.add("active");
      if (content) content.classList.add("active");
      if (heading) heading.style.display = "block";
    } else {
      if (tabBtn) tabBtn.classList.remove("active");
      if (content) content.classList.remove("active");
      if (heading) heading.style.display = "none";
    }
  });

  if (!hasQuery && categories.length > 0 && (!activeTab || activeTab === "")) {
    switchTab("all");
  }
};

const toggleSort = () => {
  if (activeTab === "all") {
    const currentSort = sortModePerTab.all || "list";
    const newSort = currentSort === "list" ? "az" : currentSort === "az" ? "za" : "list";
    sortModePerTab.all = newSort;
    categories.forEach((category) => {
      sortModePerTab[category] = newSort;
    });
  } else {
    const currentSort = sortModePerTab[activeTab] || "list";
    sortModePerTab[activeTab] = currentSort === "list" ? "az" : currentSort === "az" ? "za" : "list";
  }

  const currentSort = sortModePerTab[activeTab] || "list";
  if (currentSort === "list") {
    sortBtn.textContent = "Sort: List";
  } else if (currentSort === "az") {
    sortBtn.textContent = "Sort: A-Z";
  } else {
    sortBtn.textContent = "Sort: Z-A";
  }
  applyFilters();
};

const loadApps = async () => {
  const response = await fetch("/api/apps", {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Status API failed with ${response.status}`);
  }
  return response.json();
};

const refreshStatuses = async () => {
  categories.forEach((category) => {
    allData[category] = allData[category].map((app) => ({
      ...app,
      status: "checking"
    }));
  });
  applyFilters();

  const data = createIndexedData(await loadApps());
  Object.keys(data).forEach((category) => {
    allData[category] = data[category];
  });
  applyFilters();
};

sortBtn.addEventListener("click", toggleSort);
refreshBtn.addEventListener("click", () => {
  refreshStatuses().catch((error) => {
    console.error("Error refreshing statuses:", error);
  });
});
sortBtn.textContent = "Sort: List";
searchInput.addEventListener("input", applyFilters);
themeBtn.addEventListener("click", toggleTheme);
loadTheme();

loadApps()
  .then((data) => {
    allData = createIndexedData(data);
    createDynamicTabs(allData);

    categories.forEach((category) => {
      sortModePerTab[category] = "list";
    });
    sortModePerTab.all = "list";

    applyFilters();
  })
  .catch((error) => {
    contentContainer.innerHTML = `<div class="empty" style="color: var(--status-down-fg);">Error loading apps: ${error.message}</div>`;
  });
