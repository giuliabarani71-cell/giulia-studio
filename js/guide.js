/* Guida interattiva: tour con evidenziazione, pagina guida, dati di esempio */
(function () {
  const GB = window.GB;
  const { $, $$, esc } = GB;

  /* ================= Motore del tour ================= */
  const tour = (GB.tour = { running: false, steps: [], i: 0 });
  let hole, pop;

  const waitFor = async (sel, ms = 5000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const el = $(sel);
      if (el && el.offsetParent !== null) return el;
      await GB.sleep(80);
    }
    return null;
  };

  tour.start = (steps) => {
    tour.end();
    tour.steps = steps;
    tour.i = 0;
    tour.running = true;
    hole = document.createElement("div");
    hole.className = "tour-hole";
    pop = document.createElement("div");
    pop.className = "tour-pop";
    document.body.append(hole, pop);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    document.addEventListener("keydown", onKey);
    show();
  };
  tour.end = () => {
    tour.running = false;
    if (hole) hole.remove();
    if (pop) pop.remove();
    hole = pop = null;
    window.removeEventListener("resize", place);
    window.removeEventListener("scroll", place);
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") tour.end();
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  };
  const next = () => (tour.i < tour.steps.length - 1 ? (tour.i++, show()) : tour.end());
  const prev = () => tour.i > 0 && (tour.i--, show());

  let target = null;
  async function show() {
    const s = tour.steps[tour.i];
    if (!pop) return;
    pop.classList.remove("in");
    if (s.route && location.hash !== s.route) location.hash = s.route;
    target = s.sel ? await waitFor(s.sel) : null;
    if (!tour.running) return;
    if (target) {
      target.scrollIntoView({ block: "center" });
      await GB.sleep(60);
    }
    const n = tour.steps.length;
    pop.innerHTML = `
      <button class="tp-x" aria-label="Chiudi">×</button>
      <p class="tp-step">${s.chapter ? esc(s.chapter) + " · " : ""}${tour.i + 1} di ${n}</p>
      <h4>${s.title}</h4>
      <p>${s.text}</p>
      <div class="tp-dots">${tour.steps.map((_, k) => `<i class="${k === tour.i ? "on" : ""}"></i>`).join("")}</div>
      <div class="row between">
        <button class="btn ghost small" id="tpPrev" ${tour.i === 0 ? "disabled" : ""}>Indietro</button>
        <button class="btn primary small" id="tpNext">${tour.i === n - 1 ? "Fine" : "Avanti"}</button>
      </div>`;
    $(".tp-x", pop).onclick = tour.end;
    $("#tpPrev", pop).onclick = prev;
    $("#tpNext", pop).onclick = next;
    place();
    requestAnimationFrame(() => pop && pop.classList.add("in"));
  }
  function place() {
    if (!pop) return;
    const pad = 8;
    const vw = window.innerWidth,
      vh = window.innerHeight;
    if (!target || !target.isConnected) {
      hole.style.cssText = `left:50%;top:50%;width:0;height:0`;
      pop.style.left = Math.max(12, (vw - pop.offsetWidth) / 2) + "px";
      pop.style.top = Math.max(12, (vh - pop.offsetHeight) / 2) + "px";
      return;
    }
    const r = target.getBoundingClientRect();
    hole.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
    const pw = pop.offsetWidth,
      ph = pop.offsetHeight;
    let top = r.bottom + 16;
    if (top + ph > vh - 12) top = r.top - ph - 16;
    if (top < 12) top = Math.min(vh - ph - 12, Math.max(12, r.top + 16));
    let left = r.left + r.width / 2 - pw / 2;
    left = Math.max(12, Math.min(vw - pw - 12, left));
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  /* ================= Contenuti della guida ================= */
  const G = (GB.guide = {});

  async function demoIds() {
    const ps = await GB.db.listProjects();
    let p = ps.find((x) => x.demo && x.status !== "draft") || ps.find((x) => x.demo) || ps[0];
    return p ? { pid: p.id, cid: p.clientId } : null;
  }

  const CHAPTERS = [
    {
      key: "overview",
      title: "Panoramica",
      icon: "◎",
      text: "Come è fatta l'app: progetti, clienti e guida.",
      bullets: ["La home mostra tutti i progetti con il loro stato", "I riquadri in alto dicono quante scelte sono arrivate", "Dalla barra in alto passi a Clienti e Guida"],
      needs: false,
      steps: () => [
        { route: "#/", sel: "[data-tour=nav-projects]", title: "Progetti", text: "Qui trovi tutti i servizi fotografici. Ogni progetto appartiene a un cliente e contiene le foto da far scegliere." },
        { route: "#/", sel: "[data-tour=tiles]", title: "Colpo d'occhio", text: "Quanti progetti sono in corso e quante <b>scelte sono arrivate</b> e aspettano che tu le guardi." },
        { route: "#/", sel: "[data-tour=new-project]", title: "Nuovo progetto", text: "Da qui parte tutto: dai un titolo, scegli o crea il cliente, la lingua della galleria e quante foto può scegliere." },
        { route: "#/", sel: "[data-tour=nav-clients]", title: "Clienti", text: "L'archivio dei clienti, con contatti, preferenze di stile e storico delle risposte." },
        { route: "#/", sel: "[data-tour=nav-guide]", title: "Guida", text: "Torna qui quando vuoi rivedere un passaggio." },
      ],
    },
    {
      key: "project",
      title: "Preparare un progetto",
      icon: "▣",
      text: "Foto, coppie di stile e domande, in cinque schede.",
      bullets: [
        "<b>Foto</b>: trascina 20–30 immagini, vengono ridotte da sole",
        "<b>Stile</b>: 4 coppie A/B (temperatura, saturazione, contrasto, high/low key)",
        "<b>Domande</b>: modifica, aggiungi o riordina le domande per il cliente",
      ],
      needs: true,
      steps: ({ pid }) => [
        { route: `#/progetto/${pid}/dettagli`, sel: "[data-tour=editor-tabs]", title: "Le schede del progetto", text: "Dettagli, Foto, Stile, Domande e Condividi: segui le schede da sinistra a destra. Tutto si salva da solo." },
        { route: `#/progetto/${pid}/foto`, sel: "[data-tour=upload]", title: "Carica le foto", text: "Trascina qui 20–30 foto (anche JPEG grandi): l'app le riduce a bassa risoluzione prima di salvarle. Trascina le miniature per cambiare l'ordine; la prima diventa la copertina." },
        { route: `#/progetto/${pid}/stile`, sel: "[data-tour=pairs]", title: "Le 4 coppie di stile", text: "Per ogni aspetto (temperatura, saturazione, contrasto, luce) il cliente vede una versione A e una B. Puoi caricare due tue foto ritoccate e rinominare le etichette." },
        { route: `#/progetto/${pid}/stile`, sel: "[data-tour=style-auto]", title: "Generazione automatica", text: "Non hai voglia di preparare 8 immagini? Scegli una foto della galleria e l'app crea da sola le versioni calda/fredda, vivace/tenue, contrastata/morbida, luminosa/scura." },
        { route: `#/progetto/${pid}/domande`, sel: "[data-tour=questions]", title: "Le domande", text: "Ci sono già 5 domande pronte nella lingua del cliente. Puoi scegliere tra risposta libera, scelta singola o multipla (un'opzione per riga)." },
      ],
    },
    {
      key: "share",
      title: "Mandare la galleria",
      icon: "↗",
      text: "Apri la galleria e invia il link via WhatsApp o email.",
      bullets: ["Porta lo stato da Bozza ad <b>Aperta</b>", "Copia il link o il messaggio già pronto nella lingua del cliente", "Con <b>Anteprima</b> vedi cosa vede il cliente, senza salvare nulla"],
      needs: true,
      steps: ({ pid }) => [
        { route: `#/progetto/${pid}/condividi`, sel: "[data-tour=share]", title: "Condividi", text: "Quando è tutto pronto metti la galleria su <b>Aperta</b>, poi manda il link: c'è un messaggio pronto da inviare con WhatsApp o email. Il cliente non deve registrarsi." },
        { route: `#/progetto/${pid}/condividi`, sel: "[data-tour=preview]", title: "Anteprima", text: "Apre la galleria come la vede il cliente: foto con il cuore, coppie di stile, domande e invio. In anteprima nulla viene salvato." },
      ],
    },
    {
      key: "client",
      title: "Cosa vede il cliente",
      icon: "♡",
      text: "Quattro passaggi semplici, dal telefono o dal computer.",
      bullets: ["Sceglie le foto con il cuore e può lasciare una nota", "Indica lo stile preferito su una scala da “molto A” a “molto B”", "Risponde alle domande e preme Invia; le scelte si salvano da sole anche prima"],
      needs: true,
      steps: ({ pid }) => [
        { route: `#/g/${pid}/preview`, sel: "#steps", title: "I quattro passaggi", text: "Foto, Stile, Domande e Invia. Il cliente può cambiare lingua in alto a destra (italiano, spagnolo, inglese)." },
        { route: `#/g/${pid}/preview`, sel: ".cgrid", title: "Scegliere le foto", text: "Tocca il cuore per selezionare, tocca la foto per vederla grande e lasciare una nota. Se superi il massimo di foto, l'app lo avvisa." },
        { route: `#/g/${pid}/preview`, sel: "#fbar", title: "Sempre in vista", text: "In basso il contatore delle foto scelte e il pulsante per andare avanti." },
      ],
    },
    {
      key: "results",
      title: "Leggere le scelte",
      icon: "✓",
      text: "Foto scelte, note, stile preferito e risposte in un'unica pagina.",
      bullets: ["Copia i nomi dei file da incollare nel filtro di Lightroom", "Vedi lo stile preferito su 4 barre", "Riapri la galleria se il cliente vuole cambiare qualcosa"],
      needs: true,
      steps: ({ pid }) => [
        { route: `#/progetto/${pid}/scelte`, sel: "[data-tour=filenames]", title: "Nomi dei file", text: "Un clic e hai i nomi delle foto scelte: in Lightroom vai su Filtro libreria › Testo › Nome file › Contiene e incolla." },
        { route: `#/progetto/${pid}/scelte`, sel: "[data-tour=style-result]", title: "Stile preferito", text: "Il pallino mostra dove si è posizionato il cliente tra A e B per ogni aspetto. Sotto, le versioni che ha scelto." },
        { route: `#/progetto/${pid}/scelte`, sel: "[data-tour=save-profile]", title: "Salva nel profilo", text: "Copia stile e risposte nel profilo del cliente: la prossima volta sai già cosa gli piace." },
      ],
    },
    {
      key: "profile",
      title: "Profilo del cliente",
      icon: "◐",
      text: "Preferenze sempre a portata di mano, modificabili.",
      bullets: ["Preferenze di stile modificabili con un tocco", "Note libere su gusti e richieste", "Storico di progetti e risposte"],
      needs: true,
      steps: ({ cid }) => [
        { route: `#/cliente/${cid}`, sel: "[data-tour=profile-prefs]", title: "Preferenze di stile", text: "Si riempiono da sole quando salvi le scelte di un progetto. Puoi correggerle tu: tocca un punto più vicino ad A o a B." },
        { route: "#/clienti", sel: "[data-tour=new-client]", title: "Nuovi clienti", text: "Puoi creare un cliente da qui o direttamente quando crei un nuovo progetto." },
      ],
    },
    {
      key: "themes",
      title: "Temi e notifiche",
      icon: "◇",
      text: "Ogni progetto ha un tema; quando un cliente invia, ti arriva un avviso.",
      bullets: [
        "Il <b>tema</b> (Matrimonio, Coppia, Famiglia…) si sceglie creando il progetto e ha una breve descrizione",
        "Le scelte del cliente si salvano nel profilo <b>per tema</b>",
        "La <b>campanella</b> segnala le scelte appena inviate, anche con le notifiche del dispositivo",
      ],
      needs: false,
      steps: () => [
        { route: "#/temi", sel: "[data-tour=nav-themes]", title: "Temi", text: "Qui trovi i temi dei progetti con la loro descrizione. Puoi modificarli, aggiungerne o eliminarli. Per ogni tema vedi quanti progetti ci sono e lo stile medio scelto dai clienti." },
        { route: "#/temi", sel: "[data-tour=new-theme]", title: "Nuovo tema", text: "Dai un nome e una breve descrizione. Puoi crearne uno anche al volo mentre crei un progetto, scegliendo “＋ Nuovo tema…”." },
        { route: "#/", sel: "[data-tour=bell]", title: "Notifiche", text: "Quando un cliente preme “Invia”, qui compare un numero e un avviso. Apri la campanella e premi “Avvisami anche con le notifiche del dispositivo” per riceverle anche quando l'app è in un'altra scheda." },
      ],
    },
  ];

  G.run = async (key) => {
    let ids = await demoIds();
    const chs = key === "all" ? CHAPTERS : CHAPTERS.filter((c) => c.key === key);
    if (chs.some((c) => c.needs) && !ids) {
      const ok = await GB.confirm("Servono dei dati di esempio", "Per mostrarti questa parte creo un cliente e un progetto di esempio con foto finte. Potrai eliminarli dalla guida quando vuoi.", "Crea e continua");
      if (!ok) return;
      await G.seed();
      ids = await demoIds();
    }
    const steps = [];
    chs.forEach((c) => (!c.needs || ids) && c.steps(ids || {}).forEach((s) => steps.push({ ...s, chapter: c.title })));
    tour.start(steps);
  };

  G.page = async () => {
    const hasDemo = (await GB.db.listProjects()).some((p) => p.demo) || (await GB.db.listClients()).some((c) => c.demo);
    $("#view").innerHTML = `
      <div class="guide-hero">
        <p class="eyebrow">Guida</p>
        <h1>Come funziona lo studio</h1>
        <p class="lead muted">Prepari una galleria, il cliente sceglie foto e stile dal telefono, tu ricevi tutto in una pagina e lo ritrovi nel suo profilo.</p>
        <button class="btn primary big" id="runAll">▶ Fai il tour completo</button>
      </div>
      <div class="flow">
        ${["Crea il progetto", "Carica foto e stile", "Manda il link", "Il cliente sceglie", "Leggi le scelte", "Aggiorna il profilo"]
          .map((s, i) => `<div class="flow-step"><span>${i + 1}</span>${s}</div>`)
          .join("")}
      </div>
      <div class="grid guide-cards">${CHAPTERS.map(
        (c) => `<div class="card gcard">
          <div class="gicon">${c.icon}</div>
          <h3>${c.title}</h3>
          <p class="muted">${c.text}</p>
          <ul>${c.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
          <button class="btn small" data-run="${c.key}">Mostrami ›</button>
        </div>`
      ).join("")}</div>

      <div class="section-head"><h2>Domande frequenti</h2></div>
      <div class="faq">
        ${[
          ["Il cliente deve registrarsi?", "No. Riceve un link personale e lo apre dal telefono o dal computer. Chi non ha il link non può vedere la galleria."],
          ["Le scelte si perdono se il cliente chiude la pagina?", "No: ogni cuore, nota e risposta si salva da sola. Quando torna sul link ritrova tutto, finché non preme “Invia”."],
          ["Il cliente ha inviato ma vuole cambiare qualcosa", "Apri la pagina delle scelte e premi “Riapri al cliente”: potrà modificare e inviare di nuovo."],
          ["Perché bassa risoluzione?", "Le foto servono solo per scegliere: l'app le riduce a 1280 px così si caricano in fretta, restano nel piano gratuito di Firebase e non regali i file in alta qualità."],
          ["Come trovo le foto scelte in Lightroom?", "Nella pagina delle scelte premi “Copia per Lightroom”, poi in Libreria apri il filtro Testo › Nome file › Contiene e incolla."],
          ["Posso riusare le stesse coppie di stile?", "Sì: nella scheda Stile usa “Copia da un altro progetto”."],
          ["A cosa serve il tema del progetto?", "Raggruppa i progetti per tipo di servizio. Quando salvi le scelte nel profilo del cliente, lo stile viene ricordato anche per quel tema: così sai cosa preferisce per un matrimonio e cosa per un ritratto."],
          ["Come so che un cliente ha scelto?", "La campanella in alto mostra il numero di scelte appena inviate e compare un avviso. Se attivi le notifiche del dispositivo, arrivano anche quando l'app è aperta in un'altra scheda. Ad app chiusa non arrivano: le vedi alla prossima apertura."],
          ["In che lingua vede la galleria il cliente?", "In quella scelta nel progetto (italiano, spagnolo o inglese), ma può cambiarla dai pulsanti in alto."],
        ]
          .map(([q, a]) => `<details class="card"><summary>${q}</summary><p class="muted">${a}</p></details>`)
          .join("")}
      </div>

      <div class="card cta">
        <div><h3>Dati di esempio</h3><p class="small muted">${
          hasDemo ? "Ci sono dati di esempio (María y Luis, Anna Rossi). Eliminali quando hai finito di provare." : "Crea un cliente e un progetto finti, con 24 foto e scelte già inviate, per provare ogni funzione."
        }</p></div>
        ${hasDemo ? `<button class="btn danger" id="unseed">Elimina dati di esempio</button>` : `<button class="btn" id="seedG">Crea dati di esempio</button>`}
      </div>`;
    $("#runAll").onclick = () => G.run("all");
    $$("[data-run]").forEach((b) => (b.onclick = () => G.run(b.dataset.run)));
    const s = $("#seedG");
    if (s)
      s.onclick = async () => {
        await G.seed(s);
        G.page();
      };
    const u = $("#unseed");
    if (u)
      u.onclick = async () => {
        if (!(await GB.confirm("Eliminare i dati di esempio?", "Cancello solo i clienti e i progetti di esempio. I tuoi dati restano.", "Elimina", true))) return;
        const demoP = (await GB.db.listProjects()).filter((p) => p.demo);
        for (const p of demoP) await GB.admin.deleteProjectFully(p);
        for (const c of (await GB.db.listClients()).filter((c) => c.demo)) await GB.db.deleteClient(c.id);
        GB.toast("Dati di esempio eliminati");
        G.page();
      };
  };

  /* ================= Dati di esempio ================= */
  G.seed = async (btn) => {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Creo i dati…";
    }
    const themes = await GB.admin.ensureThemes();
    const th = (n) => themes.find((t) => t.name === n) || themes[0];
    const tCoppia = th("Coppia"),
      tRitratto = th("Ritratto");
    const c1 = await GB.db.saveClient({
      name: "María y Luis Pérez",
      type: "privato",
      origin: "Madrid, Spagna",
      email: "maria.perez@example.com",
      phone: "+34 600 000 000",
      lang: "es",
      prefs: {},
      notes: "",
      demo: true,
    });
    const c2 = await GB.db.saveClient({
      name: "Anna Rossi",
      email: "anna.rossi@example.com",
      lang: "it",
      prefs: { temperature: -1, saturation: 1, contrast: 0, key: -2 },
      notes: "Ama la luce del mattino e i toni pastello. Preferisce poco ritocco sulla pelle.",
      demo: true,
    });
    const p = await GB.db.saveProject({
      title: "Sesión en la playa · Las Terrenas",
      clientId: c1.id,
      clientName: c1.name,
      themeId: tCoppia.id,
      themeName: tCoppia.name,
      themeDesc: tCoppia.description || "",
      lang: "es",
      maxSelections: 12,
      message: "",
      status: "open",
      createdAt: Date.now() - 7 * 864e5,
      openedAt: Date.now() - 2 * 864e5,
      shootDate: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10),
      questions: GB.defaultQuestions("es"),
      pairLabels: {},
      imageCount: 0,
      demo: true,
    });
    const ids = [];
    let first;
    for (let i = 0; i < 24; i++) {
      const data = GB.demoPhoto(i + 3, i % 5 === 2);
      if (i === 0) first = data;
      const img = { kind: "gallery", name: `GB_${2401 + i}.jpg`, data, order: i };
      ids.push(await GB.db.addImage(p.id, img));
      if (btn) btn.textContent = `Creo i dati… ${Math.round(((i + 1) / 28) * 100)}%`;
    }
    const base = (await GB.resizeImage(GB.demoPhoto(7), 1000, 0.85)).data;
    for (const ax of GB.AXES)
      for (const side of ["a", "b"])
        await GB.db.addImage(p.id, { id: `style_${ax.key}_${side}`, kind: "style", axis: ax.key, side, data: await GB.styleVariant(base, ax.key, side), order: 1000 });
    p.imageCount = 24;
    p.cover = (await GB.resizeImage(first, 420, 0.7)).data;
    await GB.db.saveProject(p);
    const q = p.questions;
    const selected = [0, 2, 3, 5, 8, 9, 11, 14, 17, 18, 21].map((k) => ids[k]);
    await GB.db.saveResponse(p.id, {
      status: "submitted",
      selected,
      comments: { [ids[3]]: "¡Nuestra favorita! ¿Se puede imprimir grande?", [ids[9]]: "Un poco más luminosa, por favor" },
      style: { temperature: -2, saturation: -1, contrast: 1, key: -1 },
      answers: { [q[0].id]: q[0].options[2], [q[1].id]: [q[1].options[0], q[1].options[1]], [q[2].id]: q[2].options[0], [q[3].id]: "Evitar las fotos donde Luis sale con los ojos cerrados 😅", [q[4].id]: "¡Gracias Giulia, fue un día precioso!" },
      updatedAt: Date.now() - 3600e3,
      submittedAt: Date.now() - 3600e3,
    });
    if (GB.db.notify) await GB.db.notify({ type: "submitted", projectId: p.id, projectTitle: p.title, clientName: c1.name, count: selected.length }).catch(() => {});
    const p2 = await GB.db.saveProject({
      title: "Ritratti al Cosón",
      clientId: c2.id,
      clientName: c2.name,
      themeId: tRitratto.id,
      themeName: tRitratto.name,
      themeDesc: tRitratto.description || "",
      lang: "it",
      maxSelections: 8,
      message: "",
      status: "draft",
      questions: GB.defaultQuestions("it"),
      pairLabels: {},
      imageCount: 0,
      demo: true,
    });
    let cov;
    for (let i = 0; i < 8; i++) {
      const data = GB.demoPhoto(i + 40, i % 2 === 0);
      if (!i) cov = data;
      await GB.db.addImage(p2.id, { kind: "gallery", name: `AR_${101 + i}.jpg`, data, order: i });
    }
    p2.imageCount = 8;
    p2.cover = (await GB.resizeImage(cov, 420, 0.7)).data;
    await GB.db.saveProject(p2);
    GB.toast("Dati di esempio creati");
    if (btn && location.hash.replace(/^#\/?/, "") === "") GB.admin.dashboard();
  };
})();
