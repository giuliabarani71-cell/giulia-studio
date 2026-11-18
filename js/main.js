/* Avvio e router (hash) */
(function () {
  const GB = window.GB;
  GB.state = { user: undefined };

  async function route() {
    const hash = location.hash.replace(/^#/, "") || "/";
    const parts = hash.split("/").filter(Boolean);
    window.scrollTo(0, 0);
    document.body.classList.remove("client-mode");
    if (GB.tour && !GB.tour.running) GB.tour.end();

    // Galleria del cliente: pubblica, nessun login
    if (parts[0] === "g") return GB.client.render(parts[1]);

    if (GB.db.mode === "firebase") {
      if (GB.state.user === undefined) {
        document.getElementById("app").innerHTML = `<div class="center-screen"><div class="spinner"></div></div>`;
        return;
      }
      if (!GB.state.user) return GB.admin.login();
    }
    GB.admin.shell(parts[0] || "progetti");
    try {
      switch (parts[0] || "progetti") {
        case "progetti":
          return await GB.admin.dashboard();
        case "clienti":
          return await GB.admin.clients();
        case "cliente":
          return await GB.admin.clientProfile(parts[1]);
        case "progetto":
          if (parts[2] === "scelte") return await GB.admin.results(parts[1]);
          return await GB.admin.editor(parts[1], parts[2]);
        case "guida":
          return await GB.guide.page();
        default:
          location.hash = "#/";
      }
    } catch (e) {
      console.error(e);
      const denied = e && e.code === "permission-denied";
      const offline = e && (e.code === "unavailable" || /offline/i.test(e.message || ""));
      const who = (GB.state.user && GB.state.user.email) || "";
      const hint = denied
        ? `Firestore ha rifiutato l'accesso. Controlla in Firebase › Firestore › Regole che l'email scritta sia esattamente <b>${GB.esc(who)}</b> e premi Pubblica.`
        : offline
        ? "Non riesco a raggiungere Firebase. Controlla la connessione e riprova."
        : GB.esc(e.message || e);
      GB.$("#view").innerHTML = `<div class="empty"><h2>Qualcosa non ha funzionato</h2><p class="muted">${hint}</p><button class="btn" onclick="GB.db.refresh && GB.db.refresh(); GB.route()">Riprova</button></div>`;
    } finally {
      const v = GB.$("#view");
      if (v) v.classList.remove("busy");
    }
  }
  GB.route = route;

  window.addEventListener("hashchange", route);
  window.addEventListener("DOMContentLoaded", async () => {
    try {
      await GB.db.init();
    } catch (e) {
      document.getElementById("app").innerHTML = `<div class="center-screen"><div class="card narrow"><h2>Connessione non riuscita</h2><p class="muted">${GB.esc(
        e.message
      )}</p><p class="muted">Controlla la connessione o i valori in js/config.js.</p></div></div>`;
      return;
    }
    GB.db.onAuth((u) => {
      const first = GB.state.user === undefined;
      GB.state.user = u;
      if (first || !location.hash.startsWith("#/g/")) route();
    });
  });
})();
