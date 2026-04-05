const ICON_MENU = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
</svg>`;

const ICON_THEME = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <circle cx="12" cy="12" r="5"/>
  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
</svg>`;

const THEME_CYCLE = { light: "dark", dark: null, undefined: "light" };

// Move TOC out of #content for CSS Grid layout
// Runtime DOM: body > #table-of-contents + #content
const initLayout = () => {
  const toc = document.getElementById("table-of-contents");
  const content = document.getElementById("content");
  if (!toc || !content) return;

  document.body.insertBefore(toc, content);

  const skipLink = document.createElement("a");
  skipLink.href = "#content";
  skipLink.className = "rtz-skip-link";
  skipLink.textContent = "Skip to content";
  document.body.insertBefore(skipLink, document.body.firstChild);

  const hamburger = document.createElement("button");
  hamburger.className = "rtz-hamburger";
  hamburger.setAttribute("aria-label", "Open navigation");
  hamburger.setAttribute("aria-expanded", "false");
  hamburger.innerHTML = ICON_MENU;

  const backdrop = document.createElement("div");
  backdrop.className = "rtz-nav-backdrop";
  backdrop.setAttribute("aria-hidden", "true");

  const themeToggle = document.createElement("button");
  themeToggle.className = "rtz-theme-toggle";
  themeToggle.setAttribute("aria-label", "Theme: auto");
  themeToggle.innerHTML = ICON_THEME;

  document.body.append(hamburger, backdrop);
  toc.append(themeToggle);
};

// Theme toggle: light → dark → auto (system)
const initThemeToggle = () => {
  const stored = localStorage.getItem("rtz-theme");
  if (stored) document.documentElement.dataset.theme = stored;

  const btn = document.querySelector(".rtz-theme-toggle");
  if (!btn) return;

  const applyTheme = (theme) => {
    if (theme) {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem("rtz-theme", theme);
    } else {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem("rtz-theme");
    }
    btn.setAttribute("aria-label", `Theme: ${theme ?? "auto"}`);
  };

  applyTheme(stored);
  btn.addEventListener("click", () => {
    applyTheme(THEME_CYCLE[document.documentElement.dataset.theme]);
  });
};

// TOC active heading tracking via IntersectionObserver (left TOC + right outline)
const initTocHighlight = () => {
  const tocList = document.getElementById("text-table-of-contents");
  const outline = document.getElementById("rtz-outline");
  if (!tocList && !outline) return;

  const headings = document.querySelectorAll("#content :is(h2, h3, h4)");
  if (!headings.length) return;

  const containers = [tocList, outline].filter(Boolean);
  const activeLinks = new WeakMap();

  const observer = new IntersectionObserver(
    (entries) => {
      for (const { isIntersecting, target } of entries) {
        if (!isIntersecting || !target.id) continue;
        for (const container of containers) {
          const link = container.querySelector(`a[href="#${CSS.escape(target.id)}"]`);
          if (!link) continue;
          activeLinks.get(container)?.classList.remove("is-active");
          link.classList.add("is-active");
          activeLinks.set(container, link);
        }
      }
    },
    { rootMargin: "-10% 0px -80% 0px" },
  );

  for (const heading of headings) observer.observe(heading);
};

// Build right outline panel from page headings (h2/h3)
const initOutline = () => {
  const content = document.getElementById("content");
  if (!content) return;

  const headings = content.querySelectorAll("h2, h3");
  if (!headings.length) return;

  const outline = document.createElement("nav");
  outline.id = "rtz-outline";
  outline.setAttribute("aria-label", "On this page");

  const title = document.createElement("p");
  title.className = "rtz-outline-title";
  title.textContent = "On this page";
  outline.append(title);

  const ul = document.createElement("ul");
  for (const heading of headings) {
    if (!heading.id) continue;
    const li = document.createElement("li");
    li.dataset.level = heading.tagName.toLowerCase();

    const a = document.createElement("a");
    a.href = `#${heading.id}`;

    const clone = heading.cloneNode(true);
    clone.querySelectorAll("span[class*='section-number']").forEach((el) => el.remove());
    a.textContent = clone.textContent.trim();

    li.append(a);
    ul.append(li);
  }
  outline.append(ul);
  document.body.append(outline);
};

// Mobile sidebar overlay with focus trap
const initMobileNav = () => {
  const hamburger = document.querySelector(".rtz-hamburger");
  const toc = document.getElementById("table-of-contents");
  const backdrop = document.querySelector(".rtz-nav-backdrop");
  if (!hamburger || !toc) return;

  const trapFocus = (e) => {
    if (e.key !== "Tab") return;
    const focusable = [...toc.querySelectorAll("a, button, [tabindex]")];
    if (!focusable.length) return;
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const openNav = () => {
    toc.classList.add("is-open");
    backdrop?.classList.add("is-visible");
    hamburger.setAttribute("aria-expanded", "true");
    toc.addEventListener("keydown", trapFocus);
    toc.querySelector("a")?.focus();
  };

  const closeNav = () => {
    toc.classList.remove("is-open");
    backdrop?.classList.remove("is-visible");
    hamburger.setAttribute("aria-expanded", "false");
    toc.removeEventListener("keydown", trapFocus);
    hamburger.focus();
  };

  hamburger.addEventListener("click", () =>
    toc.classList.contains("is-open") ? closeNav() : openNav(),
  );
  backdrop?.addEventListener("click", closeNav);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toc.classList.contains("is-open")) closeNav();
  });
};

// Code copy buttons on pre.src blocks
const initCopyButtons = () => {
  for (const pre of document.querySelectorAll("pre.src")) {
    const btn = document.createElement("button");
    btn.className = "rtz-copy-btn";
    btn.textContent = "Copy";
    btn.setAttribute("aria-label", "Copy code to clipboard");
    btn.setAttribute("role", "status");
    btn.setAttribute("aria-live", "polite");

    btn.addEventListener("click", async () => {
      const code = [...pre.childNodes]
        .filter((node) => node !== btn)
        .map((node) => node.textContent)
        .join("");
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = "Copied!";
        btn.setAttribute("aria-label", "Copied to clipboard");
      } catch {
        btn.textContent = "Failed";
        btn.setAttribute("aria-label", "Copy failed");
      } finally {
        setTimeout(() => {
          btn.textContent = "Copy";
          btn.setAttribute("aria-label", "Copy code to clipboard");
        }, 2000);
      }
    });

    pre.append(btn);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initLayout();
  initOutline();
  initThemeToggle();
  initTocHighlight();
  initMobileNav();
  initCopyButtons();
});
