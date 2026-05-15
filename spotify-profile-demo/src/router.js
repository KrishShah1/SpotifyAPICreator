const views = new Map();
const rendered = new Set();
let activeTab = null;

export function registerView(name, renderFn) {
  views.set(name, renderFn);
}

export function activateTab(name) {
  if (!views.has(name)) throw new Error(`Unknown tab: ${name}`);

  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
  });
  document.querySelectorAll(".panel").forEach((p) => {
    p.hidden = p.dataset.panel !== name;
  });

  activeTab = name;

  if (!rendered.has(name)) {
    const panel = document.querySelector(`.panel[data-panel="${name}"]`);
    rendered.add(name);
    renderInto(name, panel);
  }
}

export function invalidateTab(name) {
  rendered.delete(name);
  if (activeTab === name) {
    const panel = document.querySelector(`.panel[data-panel="${name}"]`);
    panel.innerHTML = "";
    rendered.add(name);
    renderInto(name, panel);
  }
}

async function renderInto(name, panel) {
  panel.innerHTML = '<p class="loading">Loading…</p>';
  try {
    const fn = views.get(name);
    panel.innerHTML = "";
    await fn(panel);
  } catch (e) {
    if (e.status === 401) {
      const { logout } = await import("./auth.js");
      logout();
      return;
    }
    const msg = e.status === 429
      ? `Rate limited. Try again in ${e.retryAfter ?? "a few"} seconds.`
      : `Couldn't load: ${e.message}`;
    panel.innerHTML = `<p class="error">${msg}</p>`;
    rendered.delete(name);
  }
}

export function mountRouter(initialTab = "overview") {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });
  activateTab(initialTab);
}
