/* Theme toggle: light / dark con persistenza su localStorage.
   Inietta automaticamente un pulsante alla fine della .nav-links di ogni pagina. */
(function () {
  const KEY = "acn-theme";
  const root = document.documentElement;

  // Applica subito il tema salvato (prima del paint per evitare flicker)
  const saved = localStorage.getItem(KEY) || "dark";
  root.setAttribute("data-theme", saved);

  function setTheme(mode) {
    root.setAttribute("data-theme", mode);
    localStorage.setItem(KEY, mode);
  }

  function injectToggle() {
    const links = document.querySelector(".nav .nav-links");
    if (!links || links.querySelector(".theme-toggle")) return;

    const btn = document.createElement("button");
    btn.className = "theme-toggle";
    btn.setAttribute("aria-label", "Cambia tema");
    btn.title = "Cambia tema (chiaro/scuro)";
    btn.innerHTML = `
      <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
      <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
    `;
    btn.addEventListener("click", () => {
      const cur = root.getAttribute("data-theme") || "dark";
      setTheme(cur === "light" ? "dark" : "light");
    });
    links.appendChild(btn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectToggle);
  } else {
    injectToggle();
  }
})();
