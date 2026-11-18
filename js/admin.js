/* Area amministratore (Giulia) */
(function () {
  const GB = window.GB;
  const { $, $$, esc } = GB;
  const A = (GB.admin = {});
  const ui = (GB.ui = {});
  const view = () => $("#view");

  /* ---------- Componenti condivisi ---------- */
  ui.badge = (st) => `<span class="badge ${GB.STATUS[st].cls}">${GB.STATUS[st].label}</span>`;
  ui.initials = (n) =>
    (n || "?")
      .split(/[\s&]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");

  // Scala a 5 punti per un asse di stile (-2 … +2)
  ui.scale = (axis, value, lang = "it", project, readonly = false) => {
    const a = GB.axisLabel(axis, "a", lang, project),
      b = GB.axisLabel(axis, "b", lang, project);
    return `<div class="scale ${readonly ? "ro" : ""}" data-axis="${axis}">
      <span class="end">${esc(a)}</span>
      <div class="dots">${[-2, -1, 0, 1, 2]
        .map(
          (v) =>
            `<button type="button" class="dot d${Math.abs(v)} ${value === v ? "on" : ""}" data-v="${v}" title="${esc(
              GB.styleWord(axis, v, lang, project)
            )}" ${readonly ? "disabled" : ""}></button>`
        )
        .join("")}</div>
      <span class="end">${esc(b)}</span></div>`;
  };
  ui.bindScales = (root, onChange) => {
    $$(".scale:not(.ro)", root).forEach((s) =>
      $$(".dot", s).forEach((d) =>
        d.addEventListener("click", () => {
          $$(".dot", s).forEach((x) => x.classList.remove("on"));
          d.classList.add("on");
          onChange(s.dataset.axis, +d.dataset.v);
        })
      )
    );
  };
  // Riassunto in chip delle preferenze
  ui.prefChips = (prefs, lang = "it") => {
    if (!prefs) return `<span class="muted small">Nessuna preferenza registrata</span>`;
    const chips = GB.AXES.filter((ax) => prefs[ax.key] != null && prefs[ax.key] !== 0).map(
      (ax) => `<span class="chip ${prefs[ax.key] < 0 ? "a" : "b"}">${esc(GB.styleWord(ax.key, prefs[ax.key], lang))}</span>`
    );
    return chips.length ? chips.join("") : `<span class="muted small">Nessuna preferenza marcata</span>`;
  };

  /* ---------- Shell e login ---------- */
  A.shell = (active) => {
    const map = { cliente: "clienti", progetto: "progetti" };
    active = map[active] || active;
    if (!$("#shell")) {
      const demo = GB.db.mode === "local";
      $("#app").innerHTML = `<div id="shell">
        <header class="nav"><div class="nav-in">
          <a href="#/" class="brand" aria-label="Home"><img src="img/logo.png" alt="Giulia Barani" class="logo"></a>
          <nav class="nav-links">
            <a data-nav="progetti" href="#/" data-tour="nav-projects">Progetti</a>
            <a data-nav="clienti" href="#/clienti" data-tour="nav-clients">Clienti</a>
            <a data-nav="temi" href="#/temi" data-tour="nav-themes">Temi</a>
            <a data-nav="guida" href="#/guida" data-tour="nav-guide">Guida</a>
          </nav>
          <div class="nav-right">
            <div class="bell-wrap" data-tour="bell">
              <button type="button" class="theme-btn bell" id="bell" aria-label="Notifiche" title="Notifiche">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
                <span class="bell-n" id="bellN" hidden>0</span>
              </button>
              <div class="notif-panel" id="notifPanel" hidden></div>
            </div>
            ${GB.theme.button()}
            ${demo ? `<span class="pill" title="I dati restano in questo browser">Demo</span>` : `<button class="btn ghost small" id="logout">Esci</button>`}
          </div>
        </div></header>
        ${
          demo
            ? `<div class="demo-bar">Modalità demo: i dati sono salvati solo in questo browser. Per usarla con i clienti collega Firebase (vedi README).</div>`
            : ""
        }
        <main id="view" class="view"></main></div>`;
      const lo = $("#logout");
      if (lo) lo.onclick = () => GB.db.signOut();
      A.notif.start();
    }
    $$(".nav-links a").forEach((a) => a.classList.toggle("active", a.dataset.nav === active));
    // La pagina precedente resta visibile (attenuata) finché la nuova è pronta: niente schermo bianco
    if (!view().children.length) view().innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
    else view().classList.add("busy");
  };

  A.login = () => {
    $("#app").innerHTML = `<div class="login-theme">${GB.theme.button()}</div><div class="center-screen login">
      <form class="card narrow" id="loginForm">
        <img src="img/logo.png" class="logo big" alt="Giulia Barani">
        <h2>Accedi allo studio</h2>
        <label>Email<input type="email" name="email" required autocomplete="username" value="${esc(
          (window.GB_CONFIG || {}).adminEmail || ""
        )}"></label>
        <label>Password<input type="password" name="pw" required autocomplete="current-password"></label>
        <p class="err" id="loginErr"></p>
        <button class="btn primary wide">Accedi</button>
        <button type="button" class="link" id="forgot">Password dimenticata?</button>
      </form></div>`;
    const f = $("#loginForm");
    f.onsubmit = async (e) => {
      e.preventDefault();
      $("#loginErr").textContent = "";
      try {
        await GB.db.signIn(f.email.value.trim(), f.pw.value);
      } catch (err) {
        const msg = {
          "auth/operation-not-allowed": "L'accesso con email e password non è attivo in Firebase (Authentication › Metodo di accesso).",
          "auth/user-not-found": "Non esiste un utente con questa email in Firebase.",
          "auth/wrong-password": "Password non corretta.",
          "auth/invalid-credential": "Email o password non corrette, oppure l'utente non esiste in Firebase.",
          "auth/invalid-email": "L'email non è valida.",
          "auth/too-many-requests": "Troppi tentativi: riprova tra qualche minuto o reimposta la password.",
          "auth/network-request-failed": "Connessione assente.",
        }[err.code];
        $("#loginErr").textContent = (msg || "Accesso non riuscito.") + " (" + (err.code || err.message) + ")";
      }
    };
    $("#forgot").onclick = async () => {
      if (!f.email.value) return ($("#loginErr").textContent = "Scrivi prima la tua email.");
      try {
        await GB.db.resetPassword(f.email.value.trim());
        GB.toast("Ti ho inviato un'email per reimpostare la password");
      } catch (e) {
        $("#loginErr").textContent = "Impossibile inviare l'email.";
      }
    };
  };

  /* ---------- Dashboard progetti ---------- */
  A.dashboard = async () => {
    const [projects, clients] = await Promise.all([GB.db.listProjects(), GB.db.listClients()]);
    const responses = await Promise.all(projects.map((p) => GB.db.getResponse(p.id).catch(() => null)));
    projects.forEach((p, i) => {
      p._r = responses[i];
      p._st = GB.projectStatus(p, p._r);
    });
    const count = (st) => projects.filter((p) => p._st === st).length;
    const filter = sessionStorage.getItem("gb-filter") || "all";
    const tfilter = sessionStorage.getItem("gb-tfilter") || "";
    const themeNames = [...new Map(projects.filter((p) => p.themeId).map((p) => [p.themeId, p.themeName])).entries()];
    const groups = {
      all: () => true,
      active: (p) => ["draft", "open", "progress"].includes(p._st),
      submitted: (p) => p._st === "submitted",
      closed: (p) => p._st === "closed",
    };
    const hour = new Date().getHours();
    const greet = hour < 13 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";

    view().innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">${greet}, Giulia</p><h1>Progetti</h1></div>
        <button class="btn primary" id="newProject" data-tour="new-project">＋ Nuovo progetto</button>
      </div>
      <div class="tiles" data-tour="tiles">
        <div class="tile"><span class="num">${count("open") + count("progress") + count("draft")}</span><span>In corso</span></div>
        <div class="tile ${count("submitted") ? "hl" : ""}"><span class="num">${count("submitted")}</span><span>Scelte da vedere</span></div>
        <div class="tile"><span class="num">${clients.length}</span><span>Clienti</span></div>
      </div>
      ${
        projects.length
          ? `<div class="seg" id="filter">
          ${[
            ["all", "Tutti"],
            ["active", "In corso"],
            ["submitted", "Scelte ricevute"],
            ["closed", "Conclusi"],
          ]
            .map(([k, l]) => `<button data-f="${k}" class="${filter === k ? "on" : ""}">${l}</button>`)
            .join("")}
        </div>
        ${
          themeNames.length
            ? `<select id="tfilter" class="tfilter" aria-label="Filtra per tema"><option value="">Tutti i temi</option>${themeNames
                .map(([id, n]) => `<option value="${id}" ${id === tfilter ? "selected" : ""}>${esc(n)}</option>`)
                .join("")}</select>`
            : ""
        }
        <div class="grid cards" id="plist">${projects
          .filter(groups[filter] || groups.all)
          .filter((p) => !tfilter || p.themeId === tfilter)
          .map(
            (p) => `<a class="pcard" href="#/progetto/${p.id}${p._st === "submitted" ? "/scelte" : ""}">
            <div class="cover">${p.cover ? `<img src="${p.cover}" alt="">` : `<div class="ph">${ui.initials(p.clientName)}</div>`}</div>
            <div class="pbody">
              <div class="row tight">${ui.badge(p._st)}${ui.themeChip(p)}</div>
              <h3>${esc(p.title)}</h3>
              <p class="muted">${esc(p.clientName || "—")}</p>
              <p class="small muted">${p.imageCount || 0} foto${p._r && p._r.selected ? ` · ${p._r.selected.length} scelte` : ""} · ${GB.fmtDate(
              p.createdAt
            )}</p>
            </div></a>`
          )
          .join("") || `<p class="muted">Nessun progetto in questo filtro.</p>`}</div>`
          : `<div class="empty card">
          <h2>Nessun progetto ancora</h2>
          <p class="muted">Crea il primo progetto, oppure carica dei dati di esempio per provare l'app e seguire la guida.</p>
          <div class="row center"><button class="btn" id="seed">Crea dati di esempio</button><a class="btn ghost" href="#/guida">Apri la guida</a></div>
        </div>`
      }`;
    $("#newProject").onclick = () => A.newProject();
    const seed = $("#seed");
    if (seed) seed.onclick = () => GB.guide.seed(seed);
    const tf = $("#tfilter");
    if (tf)
      tf.onchange = () => {
        sessionStorage.setItem("gb-tfilter", tf.value);
        A.dashboard();
      };
    $$("#filter button").forEach(
      (b) =>
        (b.onclick = () => {
          sessionStorage.setItem("gb-filter", b.dataset.f);
          A.dashboard();
        })
    );
  };

  A.newProject = async (presetClientId) => {
    const [clients, themes] = await Promise.all([GB.db.listClients(), A.ensureThemes()]);
    const res = await GB.modal({
      title: "Nuovo progetto",
      body: `<form class="form" id="np">
        <label>Titolo del servizio<input name="title" placeholder="es. Shooting di coppia in spiaggia" required></label>
        <div class="theme-pick" data-tour="theme-pick">${ui.themePicker(themes, themes[0] && themes[0].id)}</div>
        <label>Cliente<select name="client">
          <option value="__new">＋ Nuovo cliente…</option>
          ${clients.map((c) => `<option value="${c.id}" ${c.id === presetClientId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
        </select></label>
        <div class="newc">
          <label>Nome del nuovo cliente<input name="cname" placeholder="es. Maria e Luis"></label>
          <label>Email<input name="cemail" type="email" placeholder="facoltativa"></label>
        </div>
        <div class="two">
          <label>Lingua della galleria<select name="lang">${Object.entries(GB.LANGS)
            .map(([k, v]) => `<option value="${k}" ${k === "es" ? "selected" : ""}>${v}</option>`)
            .join("")}</select></label>
          <label>Foto da scegliere (max)<input name="max" type="number" min="0" value="15"></label>
        </div>
        <p class="small muted">Metti 0 se il cliente può sceglierne quante vuole.</p>
      </form>`,
      onOpen: (w) => {
        const f = $("#np", w);
        const sync = () => {
          $(".newc", w).style.display = f.client.value === "__new" ? "" : "none";
          const c = clients.find((x) => x.id === f.client.value);
          if (c && c.lang) f.lang.value = c.lang;
        };
        f.client.onchange = sync;
        if (!clients.length || !presetClientId) f.client.value = presetClientId || "__new";
        sync();
        ui.bindThemePicker($(".theme-pick", w), themes);
      },
      actions: [
        { label: "Annulla", value: null },
        {
          label: "Crea progetto",
          primary: true,
          onClick: async (w) => {
            const f = $("#np", w);
            if (!f.title.value.trim()) return f.title.focus(), false;
            const theme = await ui.readThemePicker($(".theme-pick", w), themes);
            if (!theme) return false;
            let client;
            if (f.client.value === "__new") {
              if (!f.cname.value.trim()) return f.cname.focus(), false;
              client = await GB.db.saveClient({ name: f.cname.value.trim(), email: f.cemail.value.trim(), lang: f.lang.value, prefs: {} });
            } else client = clients.find((c) => c.id === f.client.value);
            const p = await GB.db.saveProject({
              title: f.title.value.trim(),
              clientId: client.id,
              clientName: client.name,
              themeId: theme.id,
              themeName: theme.name,
              themeDesc: theme.description || "",
              lang: f.lang.value,
              maxSelections: Math.max(0, +f.max.value || 0),
              message: "",
              status: "draft",
              questions: GB.defaultQuestions(f.lang.value),
              pairLabels: {},
              imageCount: 0,
            });
            return p;
          },
        },
      ],
    });
    if (res && res.id) location.hash = `#/progetto/${res.id}/foto`;
  };

  /* ---------- Editor del progetto ---------- */
  const TABS = [
    ["dettagli", "Dettagli"],
    ["foto", "Foto"],
    ["stile", "Stile"],
    ["domande", "Domande"],
    ["condividi", "Condividi"],
  ];

  A.editor = async (id, tab = "dettagli") => {
    // Le foto si scaricano solo nelle schede che le mostrano: le altre usano i contatori salvati nel progetto
    const needImgs = tab === "foto" || tab === "stile";
    const [p, imgs, r] = await Promise.all([GB.db.getProject(id), needImgs ? GB.db.listImages(id) : Promise.resolve(null), GB.db.getResponse(id)]);
    if (!p) return (view().innerHTML = `<div class="empty"><h2>Progetto non trovato</h2><a href="#/" class="btn">Torna ai progetti</a></div>`);
    const st = GB.projectStatus(p, r);
    const ctx = { p, imgs: imgs || [], r, st, save: null };
    let fixCounts = false;
    if (imgs) {
      const nGal = imgs.filter((i) => i.kind === "gallery").length,
        nPairs = A.pairCount(imgs);
      if (p.imageCount !== nGal || p.stylePairs !== nPairs) {
        p.imageCount = nGal;
        p.stylePairs = nPairs;
        fixCounts = true;
      }
    }
    let saveT;
    ctx.save = async (quiet) => {
      clearTimeout(saveT);
      const ind = $("#saveInd");
      if (ind) ind.textContent = "Salvataggio…";
      await GB.db.saveProject(p);
      if (ind) ind.textContent = "Salvato";
      if (!quiet) saveT = setTimeout(() => ind && (ind.textContent = ""), 1800);
    };
    ctx.saveSoon = GB.debounce(() => ctx.save(), 600);

    view().innerHTML = `
      <a href="#/" class="back">‹ Progetti</a>
      <div class="page-head">
        <div><p class="eyebrow">${esc(p.clientName || "")}</p><h1>${esc(p.title)}</h1><div class="row">${ui.badge(st)}${ui.themeChip(p)}<span class="small muted" id="saveInd"></span></div></div>
        <div class="row">
          <a class="btn ghost" href="#/g/${p.id}/preview" target="_blank" data-tour="preview">Anteprima cliente ↗</a>
          ${r ? `<a class="btn ${st === "submitted" ? "primary" : ""}" href="#/progetto/${p.id}/scelte" data-tour="see-results">Vedi scelte</a>` : ""}
        </div>
      </div>
      <div class="seg tabs" data-tour="editor-tabs">${TABS.map(
        ([k, l]) => `<a href="#/progetto/${p.id}/${k}" class="${k === tab ? "on" : ""}">${l}${
          k === "foto" ? ` <span class="cnt" id="cntFoto">${p.imageCount || 0}</span>` : ""
        }${k === "stile" ? ` <span class="cnt" id="cntStile">${p.stylePairs == null ? "–" : p.stylePairs}/4</span>` : ""}</a>`
      ).join("")}</div>
      <section id="tab"></section>`;
    if (fixCounts) ctx.save(true);
    if (imgs) A.bgOptimize(id, imgs);
    const fn = { dettagli: tabDetails, foto: tabPhotos, stile: tabStyle, domande: tabQuestions, condividi: tabShare }[tab] || tabDetails;
    await fn(ctx);
  };
  // Converte in sottofondo le foto caricate con la versione precedente (senza miniatura separata)
  const optimizing = new Set();
  A.bgOptimize = (pid, imgs) => {
    const old = imgs.some(
      (i) => (i.kind === "gallery" && (GB.db.mode === "firebase" ? i.data : !i.thumb)) || (i.kind === "style" && i.data && !i.thumb)
    );
    if (!old || optimizing.has(pid) || !GB.db.optimize) return;
    optimizing.add(pid);
    GB.db
      .optimize(pid)
      .then((n) => n && GB.toast(`${n} foto ottimizzate: d'ora in poi si caricano più in fretta`))
      .catch((e) => console.warn("Ottimizzazione foto non riuscita", e))
      .finally(() => optimizing.delete(pid));
  };
  A.pairCount = (imgs) =>
    GB.AXES.filter((ax) => ["a", "b"].every((sd) => imgs.some((i) => i.kind === "style" && i.axis === ax.key && i.side === sd))).length;

  async function tabDetails(ctx) {
    const { p } = ctx;
    const [clients, themes] = await Promise.all([GB.db.listClients(), A.ensureThemes()]);
    $("#tab").innerHTML = `<form class="card form" id="det" onsubmit="return false">
      <label>Titolo<input name="title" value="${esc(p.title)}"></label>
      <div class="theme-pick">${ui.themePicker(themes, p.themeId)}</div>
      <div class="two">
        <label>Cliente<select name="clientId">${clients
          .map((c) => `<option value="${c.id}" ${c.id === p.clientId ? "selected" : ""}>${esc(c.name)}</option>`)
          .join("")}</select></label>
        <label>Data dello shooting<input type="date" name="shootDate" value="${esc(p.shootDate || "")}"></label>
      </div>
      <div class="two">
        <label>Lingua della galleria<select name="lang">${Object.entries(GB.LANGS)
          .map(([k, v]) => `<option value="${k}" ${k === p.lang ? "selected" : ""}>${v}</option>`)
          .join("")}</select></label>
        <label>Foto da scegliere (max, 0 = libere)<input type="number" min="0" name="maxSelections" value="${p.maxSelections || 0}"></label>
      </div>
      <label>Messaggio di benvenuto per il cliente<textarea name="message" rows="4" placeholder="Lascia vuoto per usare il testo standard nella lingua scelta">${esc(
        p.message || ""
      )}</textarea></label>
      <div class="hint" id="clientHint"></div>
    </form>
    <div class="card danger-zone">
      <div><h4>Elimina progetto</h4><p class="small muted">Cancella foto, coppie di stile e scelte del cliente. Non si può annullare.</p></div>
      <button class="btn danger" id="delP">Elimina</button>
    </div>`;
    const f = $("#det");
    const showHint = () => {
      const c = clients.find((x) => x.id === f.clientId.value);
      $("#clientHint").innerHTML = c
        ? `<span class="small muted">Preferenze note di ${esc(c.name)}:</span> ${ui.prefChips(c.prefs)} <a class="small" href="#/cliente/${c.id}">Apri profilo ›</a>`
        : "";
    };
    showHint();
    f.addEventListener("input", (e) => {
      const n = e.target.name;
      if (!n || n === "themeId" || n === "tname" || n === "tdesc") return;
      if (n === "maxSelections") p[n] = Math.max(0, +e.target.value || 0);
      else if (n === "clientId") {
        const c = clients.find((x) => x.id === e.target.value);
        p.clientId = c.id;
        p.clientName = c.name;
        showHint();
      } else p[n] = e.target.value;
      ctx.saveSoon();
    });
    // Tema: scelto da elenco oppure creato al volo
    const tp = $(".theme-pick", f);
    if (p.themeId && !themes.some((t) => t.id === p.themeId) && p.themeName) {
      // tema eliminato: resta il nome salvato nel progetto
      $("select[name=themeId]", tp).insertAdjacentHTML("afterbegin", `<option value="${p.themeId}" selected>${esc(p.themeName)} (eliminato)</option>`);
    }
    if (!p.themeId) $("select[name=themeId]", tp).insertAdjacentHTML("afterbegin", `<option value="" selected disabled>Scegli un tema…</option>`);
    const useTheme = (t) => {
      if (!t) return;
      p.themeId = t.id;
      p.themeName = t.name;
      p.themeDesc = t.description || "";
      ctx.save();
      const chip = $(".page-head .chip.theme");
      if (chip) chip.outerHTML = ui.themeChip(p);
      else $(".page-head .badge").insertAdjacentHTML("afterend", ui.themeChip(p));
    };
    ui.bindThemePicker(tp, themes, useTheme);
    $(".newtheme", tp).insertAdjacentHTML("beforeend", `<button type="button" class="btn small" id="mkTheme">Crea e usa questo tema</button>`);
    $("#mkTheme").onclick = async () => {
      const t = await ui.readThemePicker(tp, themes);
      if (!t) return;
      useTheme(t);
      GB.toast("Tema creato");
      A.editor(p.id, "dettagli");
    };
    f.lang.addEventListener("change", async () => {
      if (await GB.confirm("Cambiare anche le domande?", "Vuoi sostituire le domande con quelle predefinite nella nuova lingua? Le domande che hai scritto andranno perse.", "Sostituisci")) {
        p.questions = GB.defaultQuestions(p.lang);
        ctx.save();
      }
    });
    $("#delP").onclick = async () => {
      if (!(await GB.confirm("Eliminare il progetto?", `“${esc(p.title)}” e tutte le sue foto verranno cancellati definitivamente.`, "Elimina", true))) return;
      await GB.db.deleteProject(p.id);
      GB.toast("Progetto eliminato");
      location.hash = "#/";
    };
  }

  async function updateCover(ctx) {
    const gal = ctx.imgs.filter((i) => i.kind === "gallery");
    ctx.p.imageCount = gal.length;
    const c = $("#cntFoto");
    if (c) c.textContent = gal.length;
    ctx.p.cover = gal[0] ? (await GB.resizeImage(GB.src(gal[0]), 420, 0.7)).data : "";
    await ctx.save(true);
  }

  async function tabPhotos(ctx) {
    const { p } = ctx;
    const render = () => {
      const gal = ctx.imgs.filter((i) => i.kind === "gallery");
      const n = gal.length;
      $("#tab").innerHTML = `
        <label class="drop" id="drop" data-tour="upload">
          <input type="file" accept="image/*" multiple hidden id="fileIn">
          <div class="drop-icon">↑</div>
          <strong>Trascina qui le foto o clicca per sceglierle</strong>
          <span class="small muted">Consigliate 20–30 foto. Vengono ridotte in automatico a bassa risoluzione (lato lungo 1280 px).</span>
          <div class="progress" id="prog" hidden><div></div></div>
        </label>
        <div class="row between">
          <p class="small muted">${n} foto ${n && (n < 20 || n > 30) ? `· <span class="warn">consigliate 20–30</span>` : ""} · trascina le miniature per riordinarle, la prima è la copertina.</p>
        </div>
        <div class="thumbs" id="thumbs">${gal
          .map(
            (i, k) => `<figure draggable="true" data-id="${i.id}">
            <img src="${GB.src(i)}" alt="" loading="lazy" decoding="async">
            <figcaption>${k === 0 ? "★ " : ""}${esc(i.name || "")}</figcaption>
            <button class="x" title="Elimina" data-del="${i.id}">×</button></figure>`
          )
          .join("")}</div>`;
      const inp = $("#fileIn"),
        drop = $("#drop");
      inp.onchange = () => upload(inp.files);
      drop.addEventListener("dragover", (e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          drop.classList.add("over");
        }
      });
      drop.addEventListener("dragleave", () => drop.classList.remove("over"));
      drop.addEventListener("drop", (e) => {
        e.preventDefault();
        drop.classList.remove("over");
        upload(e.dataTransfer.files);
      });
      $$("[data-del]").forEach(
        (b) =>
          (b.onclick = async (e) => {
            e.stopPropagation();
            await GB.db.deleteImage(p.id, b.dataset.del);
            ctx.imgs = ctx.imgs.filter((i) => i.id !== b.dataset.del);
            await updateCover(ctx);
            render();
          })
      );
      // Riordino con drag & drop
      let dragId = null;
      $$("#thumbs figure").forEach((fig) => {
        fig.addEventListener("dragstart", (e) => {
          dragId = fig.dataset.id;
          fig.classList.add("dragging");
          e.dataTransfer.effectAllowed = "move";
        });
        fig.addEventListener("dragend", () => fig.classList.remove("dragging"));
        fig.addEventListener("dragover", (e) => {
          if (dragId) e.preventDefault();
        });
        fig.addEventListener("drop", async (e) => {
          e.preventDefault();
          if (!dragId || dragId === fig.dataset.id) return;
          const g = ctx.imgs.filter((i) => i.kind === "gallery");
          const from = g.findIndex((i) => i.id === dragId),
            to = g.findIndex((i) => i.id === fig.dataset.id);
          const [m] = g.splice(from, 1);
          g.splice(to, 0, m);
          dragId = null;
          const changed = [];
          g.forEach((i, k) => {
            if (i.order !== k) {
              i.order = k;
              changed.push(i);
            }
          });
          ctx.imgs = [...g, ...ctx.imgs.filter((i) => i.kind !== "gallery")];
          render();
          await Promise.all(changed.map((i) => GB.db.updateImage(p.id, i.id, { order: i.order })));
          await updateCover(ctx);
        });
      });
    };
    const upload = async (files) => {
      files = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      const prog = $("#prog");
      prog.hidden = false;
      const start = ctx.imgs.filter((i) => i.kind === "gallery").length;
      let next = 0,
        done = 0,
        ok = 0;
      // 3 caricamenti in parallelo: molto più veloce che uno alla volta, senza intasare la rete
      const worker = async () => {
        while (next < files.length) {
          const k = next++;
          try {
            const { data, w, h } = await GB.resizeImage(files[k]);
            const img = { kind: "gallery", name: files[k].name, data, w, h, order: start + k };
            img.id = await GB.db.addImage(p.id, img);
            ctx.imgs.push(img);
            ok++;
          } catch (e) {
            console.error(e);
            GB.toast("Non riesco a caricare " + files[k].name, "err");
          }
          prog.firstElementChild.style.width = (++done / files.length) * 100 + "%";
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      ctx.imgs.sort((a, b) => (a.order || 0) - (b.order || 0));
      await updateCover(ctx);
      GB.toast(ok + " foto caricate");
      A.editor(p.id, "foto");
    };
    render();
  }

  async function tabStyle(ctx) {
    const { p } = ctx;
    const lang = p.lang || "it";
    p.pairLabels = p.pairLabels || {};
    const get = (axis, side) => ctx.imgs.find((i) => i.id === `style_${axis}_${side}` || (i.kind === "style" && i.axis === axis && i.side === side));
    const setImg = async (axis, side, data) => {
      const id = `style_${axis}_${side}`;
      const thumb = (await GB.resizeImage(data, 480, 0.72)).data;
      const img = { id, kind: "style", axis, side, data, thumb, order: 1000 };
      await GB.db.addImage(p.id, img);
      ctx.imgs = ctx.imgs.filter((i) => i.id !== id).concat(img);
      p.stylePairs = A.pairCount(ctx.imgs);
      const c = $("#cntStile");
      if (c) c.textContent = p.stylePairs + "/4";
      ctx.saveSoon();
    };
    const genPair = async (axis, src) => {
      const base = (await GB.resizeImage(src, 1000, 0.85)).data;
      await setImg(axis, "a", await GB.styleVariant(base, axis, "a"));
      await setImg(axis, "b", await GB.styleVariant(base, axis, "b"));
    };
    const pickGallery = async (title) => {
      const gal = ctx.imgs.filter((i) => i.kind === "gallery");
      if (!gal.length) {
        GB.toast("Carica prima qualche foto nella scheda Foto");
        return null;
      }
      return GB.modal({
        title,
        wide: true,
        body: `<div class="pick">${gal.map((i) => `<img src="${GB.src(i)}" data-id="${i.id}" loading="lazy" decoding="async">`).join("")}</div>`,
        onOpen: (w) =>
          $$(".pick img", w).forEach(
            (im) =>
              (im.onclick = () => {
                w.dataset.choice = im.dataset.id;
                $(".modal-actions .btn.primary", w).click();
              })
          ),
        actions: [
          { label: "Annulla", value: null },
          {
            label: "Usa questa",
            primary: true,
            onClick: async (w) => (w.dataset.choice ? await GB.db.getFull(p.id, gal.find((g) => g.id === w.dataset.choice)) : false),
          },
        ],
      });
    };
    const fileOnce = () =>
      new Promise((res) => {
        const i = document.createElement("input");
        i.type = "file";
        i.accept = "image/*";
        i.onchange = () => res(i.files[0] || null);
        i.click();
      });

    const render = () => {
      const done = GB.AXES.filter((ax) => get(ax.key, "a") && get(ax.key, "b")).length;
      $("#tab").innerHTML = `
        <div class="card intro">
          <p>Il cliente vedrà ${GB.AXES.length} coppie di immagini e indicherà quale versione preferisce. Puoi caricare due foto già ritoccate per ogni coppia, oppure lasciar generare all'app le due versioni partendo da una sola foto.</p>
          <div class="row">
            <button class="btn" id="autoAll" data-tour="style-auto">✦ Genera tutte da una foto della galleria</button>
            <button class="btn ghost" id="copyFrom">Copia da un altro progetto</button>
            <span class="small muted">${done}/4 coppie pronte</span>
          </div>
        </div>
        <div class="pairs" data-tour="pairs">${GB.AXES.map((ax) => {
          const a = get(ax.key, "a"),
            b = get(ax.key, "b");
          const slot = (side, im) => `<div class="slot">
              ${im ? `<img src="${GB.src(im)}" alt="" decoding="async">` : `<div class="ph">${side.toUpperCase()}</div>`}
              <input class="lbl" data-axis="${ax.key}" data-side="${side}" value="${esc(GB.axisLabel(ax.key, side, lang, p))}">
              <button class="btn small ghost" data-up="${ax.key}" data-side="${side}">Carica ${side.toUpperCase()}</button>
            </div>`;
          return `<div class="card pair">
            <div class="row between"><h3>${ax.title.it}</h3><span class="badge ${a && b ? "green" : "gray"}">${a && b ? "Pronta" : "Da completare"}</span></div>
            <div class="slots">${slot("a", a)}${slot("b", b)}</div>
            <div class="row">
              <button class="btn small" data-gen="${ax.key}">Genera da una foto della galleria</button>
              <button class="btn small ghost" data-genfile="${ax.key}">Genera da un file</button>
            </div>
          </div>`;
        }).join("")}</div>`;

      $$(".lbl").forEach((inp) =>
        inp.addEventListener("input", () => {
          p.pairLabels[inp.dataset.axis] = p.pairLabels[inp.dataset.axis] || {};
          p.pairLabels[inp.dataset.axis][inp.dataset.side] = inp.value;
          ctx.saveSoon();
        })
      );
      $$("[data-up]").forEach(
        (b) =>
          (b.onclick = async () => {
            const f = await fileOnce();
            if (!f) return;
            const { data } = await GB.resizeImage(f, 1000, 0.8);
            await setImg(b.dataset.up, b.dataset.side, data);
            render();
          })
      );
      $$("[data-gen]").forEach(
        (b) =>
          (b.onclick = async () => {
            const src = await pickGallery("Scegli la foto di partenza");
            if (!src) return;
            b.textContent = "Genero…";
            await genPair(b.dataset.gen, src);
            render();
          })
      );
      $$("[data-genfile]").forEach(
        (b) =>
          (b.onclick = async () => {
            const f = await fileOnce();
            if (!f) return;
            b.textContent = "Genero…";
            await genPair(b.dataset.genfile, f);
            render();
          })
      );
      $("#autoAll").onclick = async () => {
        const src = await pickGallery("Scegli una foto: creerò le 4 coppie da questa");
        if (!src) return;
        $("#autoAll").textContent = "Genero le coppie…";
        for (const ax of GB.AXES) await genPair(ax.key, src);
        GB.toast("4 coppie generate");
        A.editor(p.id, "stile");
      };
      $("#copyFrom").onclick = async () => {
        const others = (await GB.db.listProjects()).filter((x) => x.id !== p.id);
        if (!others.length) return GB.toast("Non ci sono altri progetti");
        const pid = await GB.modal({
          title: "Copia le coppie di stile da…",
          body: `<select id="srcP" class="full">${others.map((o) => `<option value="${o.id}">${esc(o.title)} — ${esc(o.clientName || "")}</option>`).join("")}</select>`,
          actions: [
            { label: "Annulla", value: null },
            { label: "Copia", primary: true, onClick: (w) => $("#srcP", w).value },
          ],
        });
        if (!pid) return;
        const src = (await GB.db.listImages(pid)).filter((i) => i.kind === "style");
        if (!src.length) return GB.toast("Quel progetto non ha coppie di stile");
        for (const i of src) await setImg(i.axis, i.side, i.data);
        const srcP = others.find((o) => o.id === pid);
        if (srcP.pairLabels) p.pairLabels = JSON.parse(JSON.stringify(srcP.pairLabels));
        await ctx.save();
        GB.toast("Coppie copiate");
        A.editor(p.id, "stile");
      };
    };
    render();
  }

  async function tabQuestions(ctx) {
    const { p } = ctx;
    p.questions = p.questions || [];
    const TYPES = { text: "Testo libero", choice: "Scelta singola", multi: "Scelta multipla" };
    const render = () => {
      $("#tab").innerHTML = `
        <div class="card intro"><p>Domande che aiutano a capire i gusti del cliente. Le risposte finiscono nella pagina delle scelte e possono essere salvate nel suo profilo.</p></div>
        <div id="qlist" data-tour="questions">${p.questions
          .map(
            (q, k) => `<div class="card q" data-k="${k}">
            <div class="row between">
              <span class="qn">${k + 1}</span>
              <select data-f="type">${Object.entries(TYPES)
                .map(([t, l]) => `<option value="${t}" ${q.type === t ? "selected" : ""}>${l}</option>`)
                .join("")}</select>
              <div class="row tight">
                <button class="icon" data-mv="-1" title="Su" ${k === 0 ? "disabled" : ""}>↑</button>
                <button class="icon" data-mv="1" title="Giù" ${k === p.questions.length - 1 ? "disabled" : ""}>↓</button>
                <button class="icon danger" data-rm title="Elimina">×</button>
              </div>
            </div>
            <input data-f="text" value="${esc(q.text)}" placeholder="Scrivi la domanda">
            ${
              q.type !== "text"
                ? `<textarea data-f="options" rows="3" placeholder="Un'opzione per riga">${esc((q.options || []).join("\n"))}</textarea>`
                : ""
            }
          </div>`
          )
          .join("")}</div>
        <div class="row">
          <button class="btn" id="addQ">＋ Aggiungi domanda</button>
          <button class="btn ghost" id="resetQ">Ripristina domande predefinite</button>
        </div>`;
      $$(".q").forEach((card) => {
        const q = p.questions[+card.dataset.k];
        card.addEventListener("input", (e) => {
          const f = e.target.dataset.f;
          if (f === "text") q.text = e.target.value;
          if (f === "options") q.options = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
          ctx.saveSoon();
        });
        $("[data-f=type]", card).onchange = (e) => {
          q.type = e.target.value;
          if (q.type !== "text" && !(q.options || []).length) q.options = ["Opzione 1", "Opzione 2"];
          ctx.save();
          render();
        };
        $$("[data-mv]", card).forEach(
          (b) =>
            (b.onclick = () => {
              const k = +card.dataset.k,
                j = k + +b.dataset.mv;
              [p.questions[k], p.questions[j]] = [p.questions[j], p.questions[k]];
              ctx.save();
              render();
            })
        );
        $("[data-rm]", card).onclick = () => {
          p.questions.splice(+card.dataset.k, 1);
          ctx.save();
          render();
        };
      });
      $("#addQ").onclick = () => {
        p.questions.push({ id: GB.uid(8), type: "text", text: "", options: [] });
        ctx.save();
        render();
        const last = $$(".q input[data-f=text]").pop();
        if (last) last.focus();
      };
      $("#resetQ").onclick = async () => {
        if (!(await GB.confirm("Ripristinare le domande?", "Le domande attuali verranno sostituite da quelle predefinite in " + GB.LANGS[p.lang || "it"] + ".", "Ripristina")))
          return;
        p.questions = GB.defaultQuestions(p.lang);
        ctx.save();
        render();
      };
    };
    render();
  }

  async function tabShare(ctx) {
    const { p, r } = ctx;
    const client = p.clientId ? await GB.db.getClient(p.clientId) : null;
    const link = GB.galleryLink(p.id);
    let gal = p.imageCount || 0,
      pairs = p.stylePairs;
    if (pairs == null) {
      const imgs = await GB.db.listImages(p.id);
      gal = imgs.filter((i) => i.kind === "gallery").length;
      pairs = A.pairCount(imgs);
    }
    const first = (p.clientName || "").split(/\s/)[0];
    const msgs = {
      it: `Ciao ${first}! Le foto del tuo servizio sono pronte per la scelta 📸\nApri questo link, scegli le tue preferite e dimmi che stile ti piace:\n${link}\n\nGiulia`,
      es: `¡Hola ${first}! Las fotos de tu sesión están listas para elegir 📸\nAbre este enlace, elige tus favoritas y dime qué estilo te gusta:\n${link}\n\nGiulia`,
      en: `Hi ${first}! The photos from your session are ready for you to choose 📸\nOpen this link, pick your favourites and tell me which style you like:\n${link}\n\nGiulia`,
    };
    const msg = msgs[p.lang] || msgs.it;
    const check = (ok, txt) => `<li class="${ok ? "ok" : "no"}">${ok ? "✓" : "!"} ${txt}</li>`;
    $("#tab").innerHTML = `
      <div class="card">
        <h3>Prima di inviare</h3>
        <ul class="checklist">
          ${check(gal > 0, `${gal} foto caricate${gal && (gal < 20 || gal > 30) ? " (consigliate 20–30)" : ""}`)}
          ${check(pairs === 4, `${pairs}/4 coppie di stile`)}
          ${check((p.questions || []).length > 0, `${(p.questions || []).length} domande`)}
          ${check(true, `Galleria in ${GB.LANGS[p.lang || "it"]}${p.maxSelections ? `, massimo ${p.maxSelections} foto` : ", scelta libera"}`)}
        </ul>
      </div>
      <div class="card share" data-tour="share">
        <div class="row between">
          <h3>Stato della galleria</h3>
          <div class="seg small" id="stSeg">
            ${[
              ["draft", "Bozza"],
              ["open", "Aperta"],
              ["closed", "Chiusa"],
            ]
              .map(([k, l]) => `<button data-s="${k}" class="${p.status === k ? "on" : ""}">${l}</button>`)
              .join("")}
          </div>
        </div>
        <p class="small muted">${
          p.status === "draft"
            ? "In bozza il cliente vede “galleria non ancora pronta”. Aprila quando hai finito di prepararla."
            : p.status === "open"
            ? "Il cliente può scegliere. Le scelte si salvano da sole finché non preme “Invia”."
            : "Galleria chiusa: il cliente non può più modificare nulla."
        }</p>
        <label>Link per il cliente
          <div class="copyrow"><input readonly value="${esc(link)}" id="lnk"><button class="btn" id="cpy">Copia</button></div>
        </label>
        <label>Messaggio pronto
          <textarea rows="5" id="msg">${esc(msg)}</textarea>
        </label>
        <div class="row">
          <a class="btn wa" target="_blank" id="wa" href="#">WhatsApp</a>
          <a class="btn ghost" id="mail" href="#">Email${client && client.email ? "" : " (manca indirizzo)"}</a>
          <button class="btn ghost" id="cpyMsg">Copia messaggio</button>
          <a class="btn ghost" href="#/g/${p.id}/preview" target="_blank">Anteprima ↗</a>
        </div>
        ${p.status === "draft" ? `<p class="small warn">La galleria è ancora in bozza: aprila prima di mandare il link.</p>` : ""}
        ${GB.db.mode === "local" ? `<p class="small muted">In modalità demo il link funziona solo su questo computer.</p>` : ""}
      </div>`;
    const upd = () => {
      const m = $("#msg").value;
      const phone = (client && client.phone ? client.phone : "").replace(/\D/g, "");
      $("#wa").href = `https://wa.me/${phone}?text=${encodeURIComponent(m)}`;
      $("#mail").href = `mailto:${client && client.email ? client.email : ""}?subject=${encodeURIComponent(p.title)}&body=${encodeURIComponent(m)}`;
    };
    upd();
    $("#msg").oninput = upd;
    $("#cpy").onclick = () => GB.copy(link, "Link copiato");
    $("#cpyMsg").onclick = () => GB.copy($("#msg").value, "Messaggio copiato");
    $$("#stSeg button").forEach(
      (b) =>
        (b.onclick = async () => {
          p.status = b.dataset.s;
          await ctx.save();
          GB.toast(p.status === "open" ? "Galleria aperta al cliente" : p.status === "closed" ? "Galleria chiusa" : "Galleria in bozza");
          A.editor(p.id, "condividi");
        })
    );
  }

  /* ---------- Scelte del cliente ---------- */
  A.styleBars = (style, project, lang = "it") =>
    `<div class="bars">${GB.AXES.map((ax) => {
      const v = style ? style[ax.key] : null;
      const pos = v == null ? null : ((v + 2) / 4) * 100;
      return `<div class="bar-row">
        <div class="bar-title">${ax.title.it}<span class="muted small">${esc(GB.styleWord(ax.key, v, lang, project))}</span></div>
        <div class="bar"><span class="end">${esc(GB.axisLabel(ax.key, "a", lang, project))}</span>
          <div class="track">${pos == null ? "" : `<i style="left:${pos}%"></i>`}</div>
          <span class="end">${esc(GB.axisLabel(ax.key, "b", lang, project))}</span></div>
      </div>`;
    }).join("")}</div>`;

  A.results = async (id) => {
    const [p, imgs, r] = await Promise.all([GB.db.getProject(id), GB.db.listImages(id), GB.db.getResponse(id)]);
    if (!p) return (view().innerHTML = `<div class="empty"><h2>Progetto non trovato</h2></div>`);
    const client = p.clientId ? await GB.db.getClient(p.clientId) : null;
    const st = GB.projectStatus(p, r);
    const gal = imgs.filter((i) => i.kind === "gallery");
    A.bgOptimize(id, imgs);
    if (r && r.status === "submitted") A.notif.readProject(id);
    const sel = new Set((r && r.selected) || []);
    const chosen = gal.filter((i) => sel.has(i.id));
    const comments = (r && r.comments) || {};
    const showAll = sessionStorage.getItem("gb-showall") === "1";
    const baseName = (n) => (n || "").replace(/\.[^.]+$/, "");
    const lrText = chosen.map((i) => baseName(i.name)).join(" ");
    const csvText = chosen.map((i) => i.name).join(", ");
    const style = (r && r.style) || {};
    const styleImg = (axis, v) => {
      if (v == null || v === 0) return "";
      const im = imgs.find((i) => i.kind === "style" && i.axis === axis && i.side === (v < 0 ? "a" : "b"));
      return im ? `<img src="${GB.src(im)}" alt="" decoding="async">` : "";
    };

    view().innerHTML = `
      <a href="#/progetto/${p.id}" class="back">‹ ${esc(p.title)}</a>
      <div class="page-head">
        <div><p class="eyebrow">Scelte di ${esc(p.clientName || "")}</p><h1>${esc(p.title)}</h1><div class="row">${ui.badge(st)}${ui.themeChip(p)}${
      r && r.submittedAt ? `<span class="small muted">Inviate ${GB.fmtDateTime(r.submittedAt)}</span>` : r ? `<span class="small muted">Ultima modifica ${GB.fmtDateTime(r.updatedAt)}</span>` : ""
    }</div></div>
        <div class="row">
          ${r && r.status === "submitted" && p.status !== "closed" ? `<button class="btn ghost" id="reopen">Riapri al cliente</button>` : ""}
          ${p.status !== "closed" ? `<button class="btn ghost" id="close">Segna come concluso</button>` : `<button class="btn ghost" id="reactivate">Riattiva</button>`}
        </div>
      </div>
      ${
        !r
          ? `<div class="empty card"><h2>Ancora nessuna scelta</h2><p class="muted">Quando ${esc(
              p.clientName || "il cliente"
            )} inizierà a scegliere, le foto e le preferenze compariranno qui.</p><a class="btn" href="#/progetto/${p.id}/condividi">Condividi la galleria</a></div>`
          : `
      ${r.status !== "submitted" ? `<div class="notice">Il cliente non ha ancora premuto “Invia”: queste scelte potrebbero cambiare.</div>` : ""}
      <div class="tiles">
        <div class="tile"><span class="num">${chosen.length}${p.maxSelections ? `<small>/${p.maxSelections}</small>` : ""}</span><span>Foto scelte</span></div>
        <div class="tile"><span class="num">${Object.values(comments).filter(Boolean).length}</span><span>Note sulle foto</span></div>
        <div class="tile"><span class="num">${GB.AXES.filter((a) => style[a.key] != null).length}<small>/4</small></span><span>Preferenze di stile</span></div>
      </div>

      <div class="card" data-tour="filenames">
        <div class="row between"><h3>Nomi dei file scelti</h3>
          <div class="row tight"><button class="btn small" id="cpLr">Copia per Lightroom</button><button class="btn small ghost" id="cpCsv">Copia con virgole</button></div></div>
        <p class="small muted">“Copia per Lightroom”: nomi senza estensione separati da spazio, da incollare nel filtro Testo › Nome file › Contiene.</p>
        <textarea readonly rows="3" class="mono">${esc(csvText || "—")}</textarea>
      </div>

      <div class="section-head"><h2>Foto</h2>
        <div class="seg small" id="showSeg"><button data-v="0" class="${showAll ? "" : "on"}">Scelte (${chosen.length})</button><button data-v="1" class="${
              showAll ? "on" : ""
            }">Tutte (${gal.length})</button></div></div>
      <div class="rgrid">${(showAll ? gal : chosen)
        .map(
          (i) => `<figure class="${sel.has(i.id) ? "sel" : "unsel"}">
          <img src="${GB.src(i)}" alt="" loading="lazy" decoding="async">
          <figcaption><span class="fname">${sel.has(i.id) ? "♥ " : ""}${esc(i.name || "")}</span>${comments[i.id] ? `<span class="cmt">“${esc(comments[i.id])}”</span>` : ""}</figcaption>
        </figure>`
        )
        .join("") || `<p class="muted">Nessuna foto selezionata.</p>`}</div>

      <div class="two-col">
        <div class="card" data-tour="style-result">
          <h3>Stile preferito</h3>
          ${A.styleBars(style, p, "it")}
          <div class="style-thumbs">${GB.AXES.map((ax) => styleImg(ax.key, style[ax.key])).join("")}</div>
        </div>
        <div class="card">
          <h3>Risposte</h3>
          <dl class="answers">${(p.questions || [])
            .map((q) => {
              let a = (r.answers || {})[q.id];
              if (Array.isArray(a)) a = a.join(", ");
              return `<dt>${esc(q.text)}</dt><dd>${a ? esc(a) : `<span class="muted">—</span>`}</dd>`;
            })
            .join("")}</dl>
        </div>
      </div>
      ${
        client
          ? `<div class="card cta" data-tour="save-profile">
        <div><h3>Profilo di ${esc(client.name)}</h3><p class="small muted">Salva stile e risposte di questo progetto nel profilo del cliente${p.themeName ? `, anche come preferenze per il tema <b>${esc(p.themeName)}</b>` : ""}, così le ritrovi la prossima volta.</p></div>
        <div class="row"><a class="btn ghost" href="#/cliente/${client.id}">Apri profilo</a><button class="btn primary" id="toProfile">Salva nel profilo</button></div>
      </div>`
          : ""
      }`
      }`;

    const on = (sel, fn) => {
      const el = $(sel);
      if (el) el.onclick = fn;
    };
    on("#cpLr", () => GB.copy(lrText, "Nomi copiati per Lightroom"));
    on("#cpCsv", () => GB.copy(csvText, "Nomi copiati"));
    $$("#showSeg button").forEach(
      (b) =>
        (b.onclick = () => {
          sessionStorage.setItem("gb-showall", b.dataset.v);
          A.results(id);
        })
    );
    on("#reopen", async () => {
      if (!(await GB.confirm("Riaprire la galleria?", "Il cliente potrà di nuovo modificare le scelte e dovrà premere “Invia” un'altra volta.", "Riapri"))) return;
      r.status = "draft";
      delete r.submittedAt;
      await GB.db.saveResponse(id, r);
      if (p.status !== "open") {
        p.status = "open";
        await GB.db.saveProject(p);
      }
      GB.toast("Galleria riaperta");
      A.results(id);
    });
    on("#close", async () => {
      p.status = "closed";
      await GB.db.saveProject(p);
      GB.toast("Progetto concluso");
      A.results(id);
    });
    on("#reactivate", async () => {
      p.status = "open";
      await GB.db.saveProject(p);
      A.results(id);
    });
    on("#toProfile", async () => {
      client.prefs = { ...(client.prefs || {}) };
      GB.AXES.forEach((ax) => {
        if (style[ax.key] != null) client.prefs[ax.key] = style[ax.key];
      });
      client.history = (client.history || []).filter((h) => h.projectId !== p.id);
      // preferenze per tema: lo stile scelto vale per questo tipo di servizio
      if (p.themeId) {
        client.prefsByTheme = { ...(client.prefsByTheme || {}) };
        client.prefsByTheme[p.themeId] = { name: p.themeName || "", style: { ...style }, projectId: p.id, date: r.submittedAt || r.updatedAt || Date.now() };
      }
      client.history.unshift({
        projectId: p.id,
        title: p.title,
        themeId: p.themeId || "",
        themeName: p.themeName || "",
        date: r.submittedAt || r.updatedAt || Date.now(),
        style,
        answers: (p.questions || []).map((q) => ({ q: q.text, a: Array.isArray((r.answers || {})[q.id]) ? r.answers[q.id].join(", ") : (r.answers || {})[q.id] || "" })),
        selected: chosen.length,
      });
      await GB.db.saveClient(client);
      GB.toast("Profilo di " + client.name + " aggiornato");
    });
  };

  /* ---------- Clienti ---------- */
  A.clientForm = async (c = {}) =>
    GB.modal({
      title: c.id ? "Modifica cliente" : "Nuovo cliente",
      body: `<form class="form" id="cf">
        <label>Nome<input name="name" value="${esc(c.name || "")}" placeholder="es. Maria e Luis Pérez" required></label>
        <div class="two"><label>Email<input name="email" type="email" value="${esc(c.email || "")}"></label>
        <label>Telefono / WhatsApp<input name="phone" value="${esc(c.phone || "")}" placeholder="+1 809…"></label></div>
        <label>Lingua<select name="lang">${Object.entries(GB.LANGS)
          .map(([k, v]) => `<option value="${k}" ${k === (c.lang || "es") ? "selected" : ""}>${v}</option>`)
          .join("")}</select></label>
      </form>`,
      actions: [
        { label: "Annulla", value: null },
        {
          label: "Salva",
          primary: true,
          onClick: async (w) => {
            const f = $("#cf", w);
            if (!f.name.value.trim()) return f.name.focus(), false;
            Object.assign(c, { name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), lang: f.lang.value });
            c.prefs = c.prefs || {};
            return GB.db.saveClient(c);
          },
        },
      ],
    });

  A.clients = async () => {
    const [clients, projects] = await Promise.all([GB.db.listClients(), GB.db.listProjects()]);
    const q = sessionStorage.getItem("gb-cq") || "";
    view().innerHTML = `
      <div class="page-head"><div><p class="eyebrow">${clients.length} clienti</p><h1>Clienti</h1></div>
        <button class="btn primary" id="newC" data-tour="new-client">＋ Nuovo cliente</button></div>
      <input type="search" class="search" id="cq" placeholder="Cerca per nome, email o telefono" value="${esc(q)}">
      <div class="clist" id="clist"></div>`;
    const draw = () => {
      const s = $("#cq").value.toLowerCase();
      sessionStorage.setItem("gb-cq", $("#cq").value);
      const list = clients.filter((c) => [c.name, c.email, c.phone].join(" ").toLowerCase().includes(s));
      $("#clist").innerHTML =
        list
          .map((c) => {
            const n = projects.filter((p) => p.clientId === c.id).length;
            return `<a class="crow" href="#/cliente/${c.id}">
            <span class="avatar">${ui.initials(c.name)}</span>
            <span class="cmain"><strong>${esc(c.name)}</strong><span class="small muted">${esc([c.email, c.phone].filter(Boolean).join(" · ") || "—")}</span></span>
            <span class="chips">${ui.prefChips(c.prefs)}</span>
            <span class="small muted nowrap">${n} progett${n === 1 ? "o" : "i"} ›</span></a>`;
          })
          .join("") || `<div class="empty"><p class="muted">${clients.length ? "Nessun risultato." : "Nessun cliente. Creane uno, o crea un progetto: il cliente si aggiunge da lì."}</p></div>`;
    };
    $("#cq").oninput = draw;
    draw();
    $("#newC").onclick = async () => {
      const c = await A.clientForm();
      if (c) location.hash = "#/cliente/" + c.id;
    };
  };

  A.clientProfile = async (id) => {
    const [c, projects] = await Promise.all([GB.db.getClient(id), GB.db.listProjects()]);
    if (!c) return (view().innerHTML = `<div class="empty"><h2>Cliente non trovato</h2><a class="btn" href="#/clienti">Torna ai clienti</a></div>`);
    c.prefs = c.prefs || {};
    const mine = projects.filter((p) => p.clientId === id);
    const resp = await Promise.all(mine.map((p) => GB.db.getResponse(p.id).catch(() => null)));
    const save = GB.debounce(async () => {
      await GB.db.saveClient(c);
      const ind = $("#cSave");
      if (ind) {
        ind.textContent = "Salvato";
        setTimeout(() => (ind.textContent = ""), 1500);
      }
    }, 500);

    view().innerHTML = `
      <a href="#/clienti" class="back">‹ Clienti</a>
      <div class="page-head profile-head">
        <div class="row"><span class="avatar big">${ui.initials(c.name)}</span>
          <div><h1>${esc(c.name)}</h1><p class="muted">${esc([c.email, c.phone].filter(Boolean).join(" · ") || "Nessun contatto")} · ${GB.LANGS[c.lang || "es"]}</p></div></div>
        <div class="row"><span class="small muted" id="cSave"></span><button class="btn ghost" id="editC">Modifica dati</button><button class="btn" id="newPC">＋ Progetto</button></div>
      </div>
      <div class="two-col">
        <div class="card" data-tour="profile-prefs">
          <h3>Preferenze di stile</h3>
          <p class="small muted">Si aggiornano dalle scelte con “Salva nel profilo”. Puoi correggerle tu toccando i punti.</p>
          <div class="scales">${GB.AXES.map(
            (ax) => `<div class="scale-row"><div class="bar-title">${ax.title.it}<span class="muted small" data-w="${ax.key}">${esc(
              GB.styleWord(ax.key, c.prefs[ax.key])
            )}</span></div>${ui.scale(ax.key, c.prefs[ax.key])}</div>`
          ).join("")}</div>
          <button class="link small" id="clearPrefs">Azzera preferenze</button>
        </div>
        <div class="card">
          <h3>Note su gusti e richieste</h3>
          <textarea id="notes" rows="9" placeholder="es. Ama le tonalità calde e i colori della sera, non vuole foto di profilo, preferisce poco ritocco sulla pelle…">${esc(
            c.notes || ""
          )}</textarea>
        </div>
      </div>
      ${
        Object.keys(c.prefsByTheme || {}).length
          ? `<div class="section-head"><h2>Preferenze per tema</h2><span class="small muted">Lo stile scelto per ogni tipo di servizio</span></div>
        <div class="grid theme-cards" data-tour="profile-themes">${Object.entries(c.prefsByTheme)
          .sort((a, b) => (b[1].date || 0) - (a[1].date || 0))
          .map(
            ([tid, t]) => `<div class="card tcard">
            <div class="row between"><h3>${esc(t.name || "Tema")}</h3><button class="icon danger" data-deltheme="${tid}" title="Rimuovi">×</button></div>
            <p class="small muted">Aggiornate il ${GB.fmtDate(t.date)}</p>
            ${A.styleBars(t.style)}
          </div>`
          )
          .join("")}</div>`
          : ""
      }
      <div class="section-head"><h2>Progetti</h2></div>
      <div class="clist">${
        mine
          .map((p, k) => {
            const st = GB.projectStatus(p, resp[k]);
            return `<a class="crow" href="#/progetto/${p.id}${st === "submitted" ? "/scelte" : ""}">
            <span class="thumb">${p.cover ? `<img src="${p.cover}" alt="">` : ""}</span>
            <span class="cmain"><strong>${esc(p.title)}</strong><span class="small muted">${GB.fmtDate(p.createdAt)} · ${p.imageCount || 0} foto${
              resp[k] && resp[k].selected ? ` · ${resp[k].selected.length} scelte` : ""
            }</span></span>${ui.themeChip(p)}${ui.badge(st)}</a>`;
          })
          .join("") || `<p class="muted">Nessun progetto per questo cliente.</p>`
      }</div>
      ${
        (c.history || []).length
          ? `<div class="section-head"><h2>Storico delle risposte</h2></div>
        ${c.history
          .map(
            (h) => `<details class="card hist"><summary><strong>${esc(h.title)}</strong> ${h.themeName ? `<span class="chip theme">${esc(h.themeName)}</span>` : ""} <span class="small muted">${GB.fmtDate(h.date)} · ${
              h.selected || 0
            } foto scelte</span></summary>
            <div class="two-col"><div>${A.styleBars(h.style)}</div><dl class="answers">${(h.answers || [])
              .map((a) => `<dt>${esc(a.q)}</dt><dd>${a.a ? esc(a.a) : '<span class="muted">—</span>'}</dd>`)
              .join("")}</dl></div></details>`
          )
          .join("")}`
          : ""
      }
      <div class="card danger-zone"><div><h4>Elimina cliente</h4><p class="small muted">I progetti restano, ma senza profilo collegato.</p></div><button class="btn danger" id="delC">Elimina</button></div>`;

    $$("[data-deltheme]").forEach(
      (b) =>
        (b.onclick = async () => {
          delete c.prefsByTheme[b.dataset.deltheme];
          await GB.db.saveClient(c);
          A.clientProfile(id);
        })
    );
    ui.bindScales(view(), (axis, v) => {
      c.prefs[axis] = v;
      $(`[data-w=${axis}]`).textContent = GB.styleWord(axis, v);
      save();
    });
    $("#notes").oninput = (e) => {
      c.notes = e.target.value;
      save();
    };
    $("#clearPrefs").onclick = async () => {
      c.prefs = {};
      await GB.db.saveClient(c);
      A.clientProfile(id);
    };
    $("#editC").onclick = async () => {
      if (await A.clientForm(c)) {
        // aggiorna il nome nei progetti collegati
        for (const p of mine)
          if (p.clientName !== c.name) {
            p.clientName = c.name;
            await GB.db.saveProject(p);
          }
        A.clientProfile(id);
      }
    };
    $("#newPC").onclick = () => A.newProject(id);
    $("#delC").onclick = async () => {
      if (!(await GB.confirm("Eliminare il cliente?", `Il profilo di ${esc(c.name)} verrà cancellato definitivamente.`, "Elimina", true))) return;
      await GB.db.deleteClient(id);
      location.hash = "#/clienti";
    };
  };

  /* =================================================================
   * NOTIFICHE: avviso quando un cliente invia le scelte
   * ================================================================= */
  const N = (A.notif = { list: [], seen: new Set(), stop: null, first: true });
  const ago = (ts) => {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return "adesso";
    if (s < 3600) return Math.round(s / 60) + " min fa";
    if (s < 86400) return Math.round(s / 3600) + " h fa";
    return GB.fmtDate(ts);
  };
  N.start = () => {
    if (N.stop) N.stop();
    N.first = true;
    N.stop = GB.db.watchNotifications((list) => {
      if (!list) {
        // regole non aggiornate: la campanella lo spiega invece di restare muta
        N.blocked = true;
        N.list = [];
        N.paint();
        return;
      }
      N.blocked = false;
      const fresh = list.filter((n) => !N.seen.has(n.id));
      list.forEach((n) => N.seen.add(n.id));
      N.list = list;
      N.paint();
      // all'apertura le notifiche già presenti non fanno rumore: avvisa solo quelle che arrivano dopo
      if (!N.first && fresh.length) {
        fresh.forEach((n) => N.alert(n));
        const h = location.hash.replace(/^#\/?/, "");
        if (h === "" || h === "progetti") GB.route();
      }
      N.first = false;
    });
    const bell = $("#bell");
    if (bell)
      bell.onclick = (e) => {
        e.stopPropagation();
        const p = $("#notifPanel");
        p.hidden = !p.hidden;
        if (!p.hidden) N.paint();
      };
    document.addEventListener("click", (e) => {
      const p = $("#notifPanel");
      if (p && !p.hidden && !e.target.closest(".bell-wrap")) p.hidden = true;
    });
  };
  N.text = (n) => `${n.clientName || "Un cliente"} ha inviato le scelte${n.count ? ` (${n.count} foto)` : ""}`;
  N.alert = (n) => {
    GB.toast("🔔 " + N.text(n));
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        const sys = new Notification("Scelte ricevute", { body: `${N.text(n)} · ${n.projectTitle || ""}`, icon: "img/icons/icon-192.png", tag: n.id });
        sys.onclick = () => {
          window.focus();
          location.hash = `#/progetto/${n.projectId}/scelte`;
        };
      }
    } catch (e) {}
  };
  N.paint = () => {
    const n = N.list.length;
    const badge = $("#bellN");
    if (badge) {
      badge.hidden = !n;
      badge.textContent = n > 9 ? "9+" : n;
    }
    document.title = (n ? `(${n}) ` : "") + "Giulia Barani · Studio";
    try {
      if (navigator.setAppBadge) n ? navigator.setAppBadge(n) : navigator.clearAppBadge();
    } catch (e) {}
    const p = $("#notifPanel");
    if (!p || p.hidden) return;
    const canAsk = "Notification" in window && Notification.permission === "default";
    const denied = "Notification" in window && Notification.permission === "denied";
    p.innerHTML = `
      <div class="np-head"><strong>Notifiche</strong>${n ? `<button class="link small" id="npAll">Segna tutte come lette</button>` : ""}</div>
      ${
        n
          ? N.list
              .map(
                (x) => `<a class="np-item" href="#/progetto/${x.projectId}/scelte" data-id="${x.id}">
            <span class="np-dot"></span>
            <span><b>${esc(x.clientName || "Un cliente")}</b> ha inviato le scelte${x.count ? ` · ${x.count} foto` : ""}<br>
            <span class="small muted">${esc(x.projectTitle || "")} · ${ago(x.at)}</span></span></a>`
              )
              .join("")
          : N.blocked
          ? `<p class="small muted np-empty">Le notifiche non sono ancora attive: aggiorna le regole di Firestore con il file <b>firestore.rules</b> (Firebase › Firestore › Regole › Pubblica).</p>`
          : `<p class="small muted np-empty">Nessuna novità. Quando un cliente invia le scelte la vedi qui.</p>`
      }
      ${
        canAsk
          ? `<button class="btn small wide" id="npAsk">Avvisami anche con le notifiche del dispositivo</button>`
          : denied
          ? `<p class="small muted np-empty">Le notifiche del dispositivo sono bloccate nelle impostazioni del browser.</p>`
          : ""
      }`;
    $$(".np-item", p).forEach(
      (a) =>
        (a.onclick = () => {
          p.hidden = true;
          GB.db.markNotificationsRead([a.dataset.id]);
        })
    );
    const all = $("#npAll", p);
    if (all) all.onclick = () => GB.db.markNotificationsRead(N.list.map((x) => x.id));
    const ask = $("#npAsk", p);
    if (ask)
      ask.onclick = async () => {
        const r = await Notification.requestPermission();
        GB.toast(r === "granted" ? "Notifiche del dispositivo attivate" : "Notifiche del dispositivo non attivate");
        N.paint();
      };
  };
  // Aprendo le scelte di un progetto, le sue notifiche diventano lette
  N.readProject = (pid) => {
    const ids = N.list.filter((x) => x.projectId === pid).map((x) => x.id);
    if (ids.length) GB.db.markNotificationsRead(ids);
  };

  /* =================================================================
   * TEMI PROGETTO
   * ================================================================= */
  // Al primo uso crea i temi predefiniti, così la scelta è subito pronta
  A.ensureThemes = async () => {
    try {
      let themes = await GB.db.listThemes();
      if (!themes.length) {
        for (const [k, t] of GB.DEFAULT_THEMES.entries()) await GB.db.saveTheme({ ...t, order: k });
        themes = await GB.db.listThemes();
      }
      A.themesBlocked = false;
      return themes;
    } catch (e) {
      // Regole Firestore non ancora aggiornate: si lavora con i temi predefiniti (salvati solo nel progetto)
      if (e.code !== "permission-denied") throw e;
      A.themesBlocked = true;
      return GB.DEFAULT_THEMES.map((t, k) => ({ ...t, id: "default-" + k }));
    }
  };
  ui.themeChip = (p) => (p && p.themeName ? `<span class="chip theme" title="${esc(p.themeDesc || "")}">${esc(p.themeName)}</span>` : "");

  // Selettore del tema con descrizione e creazione al volo
  ui.themePicker = (themes, current) => `
    <label>Tema del progetto<select name="themeId" required>
      ${themes.map((t) => `<option value="${t.id}" ${t.id === current ? "selected" : ""}>${esc(t.name)}</option>`).join("")}
      <option value="__new">＋ Nuovo tema…</option>
    </select></label>
    <p class="small muted theme-desc" data-desc></p>
    <div class="newtheme" hidden>
      <label>Nome del nuovo tema<input name="tname" placeholder="es. Battesimo"></label>
      <label>Breve descrizione<textarea name="tdesc" rows="2" placeholder="es. Cerimonia in chiesa e festa con la famiglia"></textarea></label>
    </div>`;
  ui.bindThemePicker = (root, themes, onChange) => {
    const sel = $("select[name=themeId]", root);
    const sync = () => {
      const t = themes.find((x) => x.id === sel.value);
      $("[data-desc]", root).textContent = t ? t.description || "" : "";
      $(".newtheme", root).hidden = sel.value !== "__new";
      if (onChange && sel.value !== "__new") onChange(t);
    };
    sel.addEventListener("change", sync);
    $("[data-desc]", root).textContent = (themes.find((x) => x.id === sel.value) || {}).description || "";
    $(".newtheme", root).hidden = sel.value !== "__new";
  };
  // Restituisce il tema scelto (creandolo se è nuovo) oppure null se manca il nome
  ui.readThemePicker = async (root, themes) => {
    const sel = $("select[name=themeId]", root);
    if (sel.value !== "__new") return themes.find((t) => t.id === sel.value) || null;
    const name = $("[name=tname]", root).value.trim();
    if (!name) {
      $("[name=tname]", root).focus();
      return null;
    }
    const t = { name, description: $("[name=tdesc]", root).value.trim(), order: themes.length };
    try {
      return await GB.db.saveTheme(t);
    } catch (e) {
      if (e.code !== "permission-denied") throw e;
      return { ...t, id: "custom-" + GB.uid(8) }; // resta salvato nel progetto
    }
  };

  A.themeForm = (t = {}) =>
    GB.modal({
      title: t.id ? "Modifica tema" : "Nuovo tema",
      body: `<form class="form" id="tf" onsubmit="return false">
        <label>Nome<input name="name" value="${esc(t.name || "")}" placeholder="es. Matrimonio" required></label>
        <label>Breve descrizione<textarea name="description" rows="3" placeholder="Cosa comprende questo tipo di servizio">${esc(t.description || "")}</textarea></label>
      </form>`,
      actions: [
        { label: "Annulla", value: null },
        {
          label: "Salva",
          primary: true,
          onClick: async (w) => {
            const f = $("#tf", w);
            if (!f.name.value.trim()) return f.name.focus(), false;
            return GB.db.saveTheme({ ...t, name: f.name.value.trim(), description: f.description.value.trim() });
          },
        },
      ],
    });

  // Pagina Temi: elenco, progetti per tema e stile medio scelto dai clienti di quel tema
  A.themes = async () => {
    const [themes, projects] = await Promise.all([A.ensureThemes(), GB.db.listProjects()]);
    const resp = await Promise.all(projects.map((p) => GB.db.getResponse(p.id).catch(() => null)));
    const stats = {};
    projects.forEach((p, k) => {
      const s = (stats[p.themeId] = stats[p.themeId] || { n: 0, sent: 0, sum: {}, cnt: {} });
      s.n++;
      const r = resp[k];
      if (r && r.status === "submitted") {
        s.sent++;
        GB.AXES.forEach((ax) => {
          const v = (r.style || {})[ax.key];
          if (v != null) {
            s.sum[ax.key] = (s.sum[ax.key] || 0) + v;
            s.cnt[ax.key] = (s.cnt[ax.key] || 0) + 1;
          }
        });
      }
    });
    const avg = (s) => {
      if (!s || !s.sent) return null;
      const o = {};
      GB.AXES.forEach((ax) => (o[ax.key] = s.cnt[ax.key] ? Math.round((s.sum[ax.key] / s.cnt[ax.key]) * 2) / 2 : null));
      return o;
    };
    view().innerHTML = `
      <div class="page-head"><div><p class="eyebrow">${themes.length} temi</p><h1>Temi dei progetti</h1>
        <p class="muted small">Ogni progetto ha un tema. Qui vedi quanti progetti ci sono per tema e lo stile che i clienti hanno scelto più spesso.</p></div>
        <button class="btn primary" id="newT" data-tour="new-theme" ${A.themesBlocked ? "disabled" : ""}>＋ Nuovo tema</button></div>
      ${
        A.themesBlocked
          ? `<div class="notice">Per creare e modificare i temi aggiorna le regole di Firestore con il file <b>firestore.rules</b> (Firebase › Firestore › Regole › Pubblica). Intanto puoi già usare i temi predefiniti nei progetti.</div>`
          : ""
      }
      <div class="grid theme-cards">${themes
        .map((t) => {
          const s = stats[t.id];
          const a = avg(s);
          return `<div class="card tcard">
            <div class="row between"><h3>${esc(t.name)}</h3>
              <div class="row tight">${A.themesBlocked ? "" : `<button class="icon" data-edit="${t.id}" title="Modifica">✎</button><button class="icon danger" data-del="${t.id}" title="Elimina">×</button>`}</div></div>
            <p class="muted">${esc(t.description || "Nessuna descrizione")}</p>
            <p class="small muted">${s ? `${s.n} progett${s.n === 1 ? "o" : "i"} · ${s.sent} con scelte inviate` : "Nessun progetto"}</p>
            ${a ? `<p class="small"><b>Stile medio scelto dai clienti</b></p>${A.styleBars(a)}` : ""}
          </div>`;
        })
        .join("")}</div>`;
    $("#newT").onclick = async () => {
      if (await A.themeForm()) A.themes();
    };
    $$("[data-edit]").forEach(
      (b) =>
        (b.onclick = async () => {
          const t = themes.find((x) => x.id === b.dataset.edit);
          const saved = await A.themeForm({ ...t });
          if (!saved) return;
          // aggiorna nome e descrizione anche nei progetti di quel tema
          for (const p of projects.filter((p) => p.themeId === t.id)) {
            p.themeName = saved.name;
            p.themeDesc = saved.description;
            delete p._r;
            await GB.db.saveProject(p);
          }
          A.themes();
        })
    );
    $$("[data-del]").forEach(
      (b) =>
        (b.onclick = async () => {
          const t = themes.find((x) => x.id === b.dataset.del);
          const n = (stats[t.id] || {}).n || 0;
          if (!(await GB.confirm("Eliminare il tema?", n ? `“${esc(t.name)}” è usato da ${n} progetti: i progetti restano, con il nome del tema salvato.` : `“${esc(t.name)}” verrà eliminato.`, "Elimina", true)))
            return;
          await GB.db.deleteTheme(t.id);
          A.themes();
        })
    );
  };
})();
