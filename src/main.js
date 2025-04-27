// src/main.js
import './assets/css/global.css';
import './assets/css/index.css';

// import HTML pages ผ่าน html-loader
import washHtml      from './pages/wash.html';
import employeeHtml  from './pages/employee.html';
import uniformHtml   from './pages/uniform.html';
import inventoryHtml from './pages/inventory.html';

// กำหนด mapping ของชื่อ page → เนื้อหา HTML
const PAGES = {
  wash:      washHtml,
  employee:  employeeHtml,
  uniform:   uniformHtml,
  inventory: inventoryHtml,
};

const mainContent     = document.getElementById("main-content");
const navLinks        = document.querySelectorAll(".nav-link");
const loaderMessage   = document.getElementById("loaderMessage");
const loadingOverlay  = document.getElementById("loadingOverlay");

function showOverlay(msg = "Loading...") {
  loadingOverlay.querySelector(".loading-text").textContent = msg;
  loadingOverlay.classList.remove("hidden");
}
function hideOverlay() {
  loadingOverlay.classList.add("hidden");
}

async function loadPage(page = "wash") {
  showOverlay(`Loading ${page}...`);
  try {
    const html = PAGES[page];
    if (!html) throw new Error(`Page not found: ${page}`);
    mainContent.innerHTML = html;
    window.scrollTo(0, 0);
    updateActiveLink(page);
    window.history.pushState({}, "", `#${page}`);
    loadPageStyle(page);
    await initController(page);
  } catch (err) {
    mainContent.innerHTML = `
      <div style="padding:2rem;color:red">
        <strong>Error:</strong> ${err.message}
      </div>`;
  } finally {
    hideOverlay();
  }
}

function loadPageStyle(page) {
  document.querySelectorAll("link[data-page-style]").forEach(el => el.remove());

  if (!document.querySelector('link[data-global-style]')) {
    const g = document.createElement("link");
    g.rel = "stylesheet";
    g.href = `assets/css/index.css`;
    g.setAttribute("data-global-style", "");
    document.head.appendChild(g);
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `assets/css/${page}.css`;
  link.setAttribute("data-page-style", page);
  document.head.appendChild(link);
}


async function initController(page) {
  switch (page) {
    case "wash": {
      const { initWashPage } = await import(
        /* webpackChunkName: "wash" */ "./assets/js/Controllers/washController.js"
      );
      return initWashPage();
    }
    case "employee": {
      const { initEmployeePage } = await import(
        /* webpackChunkName: "employee" */ "./assets/js/Controllers/employeeController.js"
      );
      return initEmployeePage();
    }
    case "uniform": {
      const { initUniformPage } = await import(
        /* webpackChunkName: "uniform" */ "./assets/js/Controllers/uniformController.js"
      );
      return initUniformPage();
    }
    case "inventory": {
      const { initInventoryPage } = await import(
        /* webpackChunkName: "inventory" */ "./assets/js/Controllers/inventoryController.js"
      );
      return initInventoryPage();
    }
    default:
      console.warn(`No controller for page: ${page}`);
  }
}

function updateActiveLink(page) {
  navLinks.forEach(link => {
    link.classList.toggle("active", link.dataset.page === page);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const initial = location.hash.replace("#", "") || "wash";
  loadPage(initial);
});

navLinks.forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    loadPage(link.dataset.page);
  });
});

window.addEventListener("popstate", () => {
  const page = location.hash.replace("#", "") || "wash";
  loadPage(page);
});
