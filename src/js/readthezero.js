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

// Move TOC out of #content for 2-column CSS Grid layout
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

// Restructure TOC links that contain TODO/DONE badges
// Wraps non-badge content so flex-column ordering works cleanly
const initTocItems = () => {
  for (const a of document.querySelectorAll("#table-of-contents a")) {
    const badge = a.querySelector(":is(.todo, .done)");
    if (!badge) continue;

    const tag = a.querySelector(".tag");
    const otherNodes = [...a.childNodes].filter((n) => n !== badge && n !== tag);

    const label = document.createElement("span");
    label.className = "rtz-toc-label";
    for (const n of otherNodes) label.append(n);

    a.prepend(label);
    a.prepend(badge);
  }
};

// TOC active heading tracking via IntersectionObserver
const initTocHighlight = () => {
  const tocList = document.getElementById("text-table-of-contents");
  if (!tocList) return;

  const headings = document.querySelectorAll("#content :is(h2, h3, h4)");
  if (!headings.length) return;

  const activeLink = { current: null };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const { isIntersecting, target } of entries) {
        if (!isIntersecting || !target.id) continue;
        const link = tocList.querySelector(`a[href="#${CSS.escape(target.id)}"]`);
        if (!link) continue;
        activeLink.current?.classList.remove("is-active");
        link.classList.add("is-active");
        activeLink.current = link;
      }
    },
    { rootMargin: "-10% 0px -80% 0px" },
  );

  for (const heading of headings) observer.observe(heading);
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

// Human-friendly labels for Org src-block language classes
const LANG_LABELS = {
  "emacs-lisp": "Emacs Lisp",
  elisp: "Emacs Lisp",
  javascript: "JavaScript",
  js: "JavaScript",
  typescript: "TypeScript",
  ts: "TypeScript",
  python: "Python",
  css: "CSS",
  html: "HTML",
  json: "JSON",
  yaml: "YAML",
  bash: "Bash",
  shell: "Shell",
  sh: "Shell",
  rust: "Rust",
  go: "Go",
  c: "C",
  cpp: "C++",
  haskell: "Haskell",
  nix: "Nix",
  sql: "SQL",
};

const prettyLang = (lang) =>
  LANG_LABELS[lang] ?? lang.charAt(0).toUpperCase() + lang.slice(1);

// Code block enhancements: language label + copy-to-clipboard button.
// Both controls live in a toolbar on the wrapping .org-src-container so the
// language sits top-start and the copy button top-end without overlapping,
// and neither pollutes the code text captured for copying.
const initCodeBlocks = () => {
  for (const pre of document.querySelectorAll("pre.src")) {
    const container = pre.closest(".org-src-container") ?? pre;
    const codeText = pre.textContent;

    const toolbar = document.createElement("div");
    toolbar.className = "rtz-code-toolbar";

    const langClass = [...pre.classList].find(
      (c) => c.startsWith("src-") && c !== "src",
    );
    if (langClass) {
      const label = document.createElement("span");
      label.className = "rtz-code-lang";
      label.textContent = prettyLang(langClass.slice(4));
      toolbar.append(label);
    }

    const btn = document.createElement("button");
    btn.className = "rtz-copy-btn";
    btn.type = "button";
    btn.textContent = "Copy";
    btn.setAttribute("aria-label", "Copy code to clipboard");
    btn.setAttribute("aria-live", "polite");

    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(codeText);
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

    toolbar.append(btn);
    container.prepend(toolbar);
  }
};

// Wrap wide tables so they scroll horizontally instead of breaking layout
// on narrow viewports, and pick up the rounded .table-container frame.
const initTables = () => {
  for (const table of document.querySelectorAll("#content table")) {
    if (table.closest(".table-container")) continue;
    const wrap = document.createElement("div");
    wrap.className = "table-container";
    table.replaceWith(wrap);
    wrap.append(table);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initLayout();
  initTocItems();
  initThemeToggle();
  initTocHighlight();
  initMobileNav();
  initCodeBlocks();
  initTables();
});
