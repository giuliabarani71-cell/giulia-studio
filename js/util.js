/* Utility condivise: DOM, modali, immagini, assi di stile, traduzioni */
(function () {
  const GB = (window.GB = window.GB || {});

  GB.$ = (s, r = document) => r.querySelector(s);
  GB.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  GB.esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  GB.uid = (n = 20) => {
    const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => a[x % a.length]).join("");
  };
  GB.debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };
  GB.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  GB.fmtDate = (ts, lang = "it") => {
    if (!ts) return "—";
    const loc = { it: "it-IT", es: "es-ES", en: "en-GB" }[lang] || "it-IT";
    return new Date(ts).toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" });
  };
  GB.fmtDateTime = (ts) =>
    ts ? new Date(ts).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  /* ---------- Toast ---------- */
  GB.toast = (msg, kind = "") => {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = "show " + kind;
    clearTimeout(GB._toastT);
    GB._toastT = setTimeout(() => (el.className = ""), 2600);
  };

  /* ---------- Modale ---------- */
  GB.modal = ({ title = "", body = "", actions = [], wide = false, onOpen }) =>
    new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "modal-wrap";
      wrap.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
        ${title ? `<h3>${title}</h3>` : ""}
        <div class="modal-body">${body}</div>
        <div class="modal-actions">${actions
          .map((a, i) => `<button class="btn ${a.primary ? "primary" : ""} ${a.danger ? "danger" : ""}" data-i="${i}">${a.label}</button>`)
          .join("")}</div></div>`;
      document.body.appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add("open"));
      const close = (v) => {
        wrap.classList.remove("open");
        setTimeout(() => wrap.remove(), 200);
        document.removeEventListener("keydown", onKey);
        resolve(v);
      };
      const onKey = (e) => {
        if (e.key === "Escape") close(null);
      };
      document.addEventListener("keydown", onKey);
      wrap.addEventListener("mousedown", (e) => {
        if (e.target === wrap) close(null);
      });
      GB.$$(".modal-actions .btn", wrap).forEach((b) =>
        b.addEventListener("click", async () => {
          const a = actions[+b.dataset.i];
          if (a.onClick) {
            const r = await a.onClick(wrap);
            if (r === false) return;
            close(r === undefined ? a.value : r);
          } else close(a.value);
        })
      );
      if (onOpen) onOpen(wrap);
      const first = GB.$("input,textarea,select", wrap);
      if (first) setTimeout(() => first.focus(), 60);
    });
  GB.confirm = (title, text, okLabel = "Conferma", danger = false) =>
    GB.modal({
      title,
      body: `<p class="muted">${text}</p>`,
      actions: [
        { label: "Annulla", value: false },
        { label: okLabel, value: true, primary: !danger, danger },
      ],
    });

  GB.copy = async (text, msg = "Copiato") => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const t = document.createElement("textarea");
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    GB.toast(msg);
  };

  /* ---------- Immagini ---------- */
  GB.loadImg = (src) =>
    new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });

  // Ridimensiona un File (o un'immagine) a bassa risoluzione e restituisce un dataURL JPEG.
  // Firestore accetta documenti fino a 1 MB: restiamo sotto i ~420 KB per caricare in fretta.
  GB.resizeImage = async (src, max = 1280, q = 0.72) => {
    let img;
    if (src instanceof Blob) {
      const url = URL.createObjectURL(src);
      try {
        img = await GB.loadImg(url);
      } finally {
        URL.revokeObjectURL(url);
      }
    } else if (typeof src === "string") img = await GB.loadImg(src);
    else img = src;
    const w0 = img.naturalWidth || img.width,
      h0 = img.naturalHeight || img.height;
    const s = Math.min(1, max / Math.max(w0, h0));
    const w = Math.round(w0 * s),
      h = Math.round(h0 * s);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    let data = c.toDataURL("image/jpeg", q);
    while (data.length > 420000 && q > 0.4) {
      q -= 0.1;
      data = c.toDataURL("image/jpeg", q);
    }
    return { data, w, h };
  };

  /* ---------- Assi di stile ---------- */
  // Valore da -2 (molto A) a +2 (molto B). 0 = indifferente.
  GB.AXES = [
    {
      key: "temperature",
      title: { it: "Temperatura", es: "Temperatura", en: "Temperature" },
      a: { it: "Calda", es: "Cálida", en: "Warm" },
      b: { it: "Fredda", es: "Fría", en: "Cool" },
    },
    {
      key: "saturation",
      title: { it: "Saturazione", es: "Saturación", en: "Saturation" },
      a: { it: "Vivace", es: "Viva", en: "Vibrant" },
      b: { it: "Tenue", es: "Suave", en: "Muted" },
    },
    {
      key: "contrast",
      title: { it: "Contrasto", es: "Contraste", en: "Contrast" },
      a: { it: "Contrastata", es: "Contrastada", en: "Punchy" },
      b: { it: "Morbida", es: "Delicada", en: "Soft" },
    },
    {
      key: "key",
      title: { it: "Luce", es: "Luz", en: "Light" },
      a: { it: "Luminosa (high key)", es: "Luminosa (high key)", en: "Bright (high key)" },
      b: { it: "Scura (low key)", es: "Oscura (low key)", en: "Moody (low key)" },
    },
  ];
  GB.axisLabel = (axis, side, lang = "it", project) => {
    const ax = GB.AXES.find((a) => a.key === axis);
    const custom = project && project.pairLabels && project.pairLabels[axis] && project.pairLabels[axis][side];
    return custom || ax[side][lang] || ax[side].it;
  };
  GB.styleWord = (axis, v, lang = "it", project) => {
    if (v == null) return lang === "en" ? "not answered" : lang === "es" ? "sin respuesta" : "non risposto";
    if (v === 0) return { it: "Indifferente", es: "Indiferente", en: "No preference" }[lang];
    const side = v < 0 ? "a" : "b";
    const strong = Math.abs(v) === 2;
    const lbl = GB.axisLabel(axis, side, lang, project);
    const pre = strong ? { it: "Molto ", es: "Muy ", en: "Very " }[lang] : { it: "Un po' ", es: "Algo ", en: "Slightly " }[lang];
    return pre + lbl.toLowerCase();
  };

  // Crea la variante A o B di una foto per un asse di stile (manipolazione pixel, funziona ovunque)
  GB.styleVariant = async (dataUrl, axis, side) => {
    const img = await GB.loadImg(dataUrl);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i],
        g = d[i + 1],
        b = d[i + 2];
      if (axis === "temperature") {
        if (side === "a") {
          r = r * 1.1 + 12;
          g = g * 1.02 + 4;
          b = b * 0.82;
        } else {
          r = r * 0.86;
          g = g * 0.98 + 2;
          b = b * 1.1 + 14;
        }
      } else if (axis === "saturation") {
        const s = side === "a" ? 1.65 : 0.4;
        const y = 0.299 * r + 0.587 * g + 0.114 * b;
        r = y + (r - y) * s;
        g = y + (g - y) * s;
        b = y + (b - y) * s;
      } else if (axis === "contrast") {
        const k = side === "a" ? 1.45 : 0.68;
        const off = side === "a" ? 0 : 10;
        r = (r - 128) * k + 128 + off;
        g = (g - 128) * k + 128 + off;
        b = (b - 128) * k + 128 + off;
      } else if (axis === "key") {
        if (side === "a") {
          r = r * 0.72 + 82;
          g = g * 0.72 + 82;
          b = b * 0.72 + 84;
        } else {
          r = Math.pow(r / 255, 1.7) * 235;
          g = Math.pow(g / 255, 1.7) * 235;
          b = Math.pow(b / 255, 1.7) * 240;
        }
      }
      d[i] = cl(r);
      d[i + 1] = cl(g);
      d[i + 2] = cl(b);
    }
    ctx.putImageData(id, 0, 0);
    return c.toDataURL("image/jpeg", 0.78);
  };

  // Foto sintetica per i dati di esempio (spiaggia al tramonto disegnata su canvas)
  GB.demoPhoto = (seed, portrait = false) => {
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const w = portrait ? 800 : 1200,
      h = portrait ? 1100 : 800;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    const hue = 10 + rnd() * 200;
    const horizon = h * (0.5 + rnd() * 0.15);
    let g = x.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, `hsl(${hue + 200},55%,${30 + rnd() * 25}%)`);
    g.addColorStop(1, `hsl(${hue},75%,${62 + rnd() * 15}%)`);
    x.fillStyle = g;
    x.fillRect(0, 0, w, horizon);
    const sx = w * (0.2 + rnd() * 0.6),
      sy = horizon - h * (0.05 + rnd() * 0.25);
    g = x.createRadialGradient(sx, sy, 0, sx, sy, w * 0.35);
    g.addColorStop(0, `hsla(${hue + 30},100%,92%,1)`);
    g.addColorStop(0.08, `hsla(${hue + 25},100%,80%,.95)`);
    g.addColorStop(1, `hsla(${hue},90%,60%,0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, w, horizon);
    g = x.createLinearGradient(0, horizon, 0, h * 0.82);
    g.addColorStop(0, `hsl(${hue + 170},45%,40%)`);
    g.addColorStop(1, `hsl(${hue + 185},55%,22%)`);
    x.fillStyle = g;
    x.fillRect(0, horizon, w, h);
    x.fillStyle = `hsla(${hue + 30},100%,85%,.35)`;
    for (let i = 0; i < 26; i++) x.fillRect(sx - 60 + rnd() * 120, horizon + 4 + i * 8, 20 + rnd() * 80, 2);
    g = x.createLinearGradient(0, h * 0.8, 0, h);
    g.addColorStop(0, `hsl(${hue + 20},35%,62%)`);
    g.addColorStop(1, `hsl(${hue + 15},30%,45%)`);
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, h * 0.84);
    x.quadraticCurveTo(w * 0.5, h * 0.78, w, h * 0.86);
    x.lineTo(w, h);
    x.lineTo(0, h);
    x.fill();
    // persone in silhouette
    x.fillStyle = "rgba(20,15,20,.88)";
    const n = 1 + Math.floor(rnd() * 3);
    const base = w * (0.25 + rnd() * 0.4);
    for (let i = 0; i < n; i++) {
      const px = base + i * w * 0.07,
        ph = h * (0.22 + rnd() * 0.06),
        py = h * 0.86;
      x.beginPath();
      x.arc(px, py - ph, ph * 0.09, 0, 7);
      x.fill();
      x.beginPath();
      x.ellipse(px, py - ph * 0.55, ph * 0.11, ph * 0.36, 0, 0, 7);
      x.fill();
    }
    // palma
    if (rnd() > 0.4) {
      const bx = rnd() > 0.5 ? w * 0.08 : w * 0.9;
      x.strokeStyle = "rgba(20,15,20,.9)";
      x.lineWidth = w * 0.012;
      x.beginPath();
      x.moveTo(bx, h);
      x.quadraticCurveTo(bx + w * 0.04, h * 0.6, bx + w * 0.02, h * 0.3);
      x.stroke();
      x.fillStyle = "rgba(20,15,20,.9)";
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        x.beginPath();
        x.ellipse(bx + w * 0.02 + Math.cos(a) * w * 0.06, h * 0.3 + Math.sin(a) * h * 0.03, w * 0.07, h * 0.012, a, 0, 7);
        x.fill();
      }
    }
    return c.toDataURL("image/jpeg", 0.8);
  };

  /* ---------- Domande predefinite ---------- */
  GB.defaultQuestions = (lang = "it") => {
    const Q = {
      it: [
        ["choice", "Per cosa userai principalmente queste foto?", ["Ricordo personale", "Social media", "Stampa e album", "Lavoro / brand"]],
        ["multi", "Quale atmosfera vuoi che trasmettano?", ["Romantica", "Naturale", "Elegante", "Allegra", "Drammatica", "Intima"]],
        ["choice", "Ti piacerebbe qualche foto in bianco e nero?", ["Sì, alcune", "Solo a colori", "Mi affido a te"]],
        ["text", "C'è qualcosa che vorresti evitare o migliorare (pose, dettagli, ritocco)?"],
        ["text", "Vuoi dirmi altro?"],
      ],
      es: [
        ["choice", "¿Para qué usarás principalmente estas fotos?", ["Recuerdo personal", "Redes sociales", "Impresión y álbum", "Trabajo / marca"]],
        ["multi", "¿Qué ambiente quieres que transmitan?", ["Romántico", "Natural", "Elegante", "Alegre", "Dramático", "Íntimo"]],
        ["choice", "¿Te gustarían algunas fotos en blanco y negro?", ["Sí, algunas", "Solo a color", "Confío en ti"]],
        ["text", "¿Hay algo que quieras evitar o mejorar (poses, detalles, retoque)?"],
        ["text", "¿Algo más que quieras decirme?"],
      ],
      en: [
        ["choice", "What will you mainly use these photos for?", ["Personal memories", "Social media", "Prints and album", "Work / brand"]],
        ["multi", "What mood should they convey?", ["Romantic", "Natural", "Elegant", "Joyful", "Dramatic", "Intimate"]],
        ["choice", "Would you like some photos in black and white?", ["Yes, a few", "Colour only", "I trust you"]],
        ["text", "Anything you'd like to avoid or improve (poses, details, retouching)?"],
        ["text", "Anything else you'd like to tell me?"],
      ],
    };
    return (Q[lang] || Q.it).map(([type, text, options]) => ({ id: GB.uid(8), type, text, options: options || [] }));
  };

  /* ---------- Testi della galleria cliente (IT / ES / EN) ---------- */
  GB.I18N = {
    it: {
      hello: "Ciao",
      intro: "Ecco le tue foto. Scegli le tue preferite, dimmi che stile ti piace e rispondi a qualche domanda: così le preparo proprio come le immagini.",
      tabPhotos: "Foto",
      tabStyle: "Stile",
      tabQuestions: "Domande",
      tabSend: "Invia",
      selected: "selezionate",
      of: "di",
      maxReached: "Hai raggiunto il numero massimo di foto",
      choose: "Scegli fino a {n} foto",
      chooseFree: "Scegli le foto che preferisci",
      tapHeart: "Tocca il cuore per selezionare, la foto per ingrandirla.",
      next: "Avanti",
      back: "Indietro",
      comment: "Una nota su questa foto (facoltativa)",
      styleIntro: "Per ogni coppia tocca la versione che ti piace di più. Puoi anche dire quanto ti piace.",
      much: "Molto",
      bit: "Un po'",
      same: "Indifferente",
      qIntro: "Qualche domanda per conoscere i tuoi gusti.",
      yourAnswer: "La tua risposta…",
      summary: "Riepilogo",
      photosChosen: "Foto scelte",
      styleDone: "Preferenze di stile",
      answers: "Risposte",
      send: "Invia le mie scelte",
      sendConfirmT: "Inviare le scelte?",
      sendConfirm: "Dopo l'invio non potrai più modificarle. Se cambi idea, scrivimi.",
      cancel: "Annulla",
      sent: "Grazie!",
      sentText: "Ho ricevuto le tue scelte. Ti scrivo appena le foto sono pronte.",
      sentOn: "Inviate il",
      notReady: "La galleria non è ancora pronta",
      notReadyText: "Riprova tra poco: ti avviserò quando sarà disponibile.",
      closed: "Progetto concluso",
      closedText: "Questa galleria è chiusa. Per qualsiasi cosa scrivimi pure.",
      notFound: "Galleria non trovata",
      notFoundText: "Controlla il link che hai ricevuto.",
      saved: "Salvato",
      saving: "Salvataggio…",
      warnNone: "Non hai ancora scelto nessuna foto.",
      missing: "mancanti",
      contact: "Contatti",
      zero: "Nessuna foto selezionata",
      seeSelected: "Solo selezionate",
      seeAll: "Tutte",
      draftNote: "Le scelte si salvano da sole: puoi chiudere e tornare quando vuoi.",
    },
    es: {
      hello: "Hola",
      intro: "Aquí están tus fotos. Elige tus favoritas, dime qué estilo te gusta y responde unas preguntas: así las preparo tal como las imaginas.",
      tabPhotos: "Fotos",
      tabStyle: "Estilo",
      tabQuestions: "Preguntas",
      tabSend: "Enviar",
      selected: "seleccionadas",
      of: "de",
      maxReached: "Has llegado al número máximo de fotos",
      choose: "Elige hasta {n} fotos",
      chooseFree: "Elige las fotos que prefieras",
      tapHeart: "Toca el corazón para seleccionar, la foto para ampliarla.",
      next: "Siguiente",
      back: "Atrás",
      comment: "Una nota sobre esta foto (opcional)",
      styleIntro: "En cada par toca la versión que más te guste. También puedes decir cuánto te gusta.",
      much: "Mucho",
      bit: "Algo",
      same: "Indiferente",
      qIntro: "Algunas preguntas para conocer tus gustos.",
      yourAnswer: "Tu respuesta…",
      summary: "Resumen",
      photosChosen: "Fotos elegidas",
      styleDone: "Preferencias de estilo",
      answers: "Respuestas",
      send: "Enviar mis elecciones",
      sendConfirmT: "¿Enviar tus elecciones?",
      sendConfirm: "Después del envío ya no podrás cambiarlas. Si cambias de idea, escríbeme.",
      cancel: "Cancelar",
      sent: "¡Gracias!",
      sentText: "He recibido tus elecciones. Te escribo en cuanto las fotos estén listas.",
      sentOn: "Enviadas el",
      notReady: "La galería aún no está lista",
      notReadyText: "Vuelve a intentarlo pronto: te avisaré cuando esté disponible.",
      closed: "Proyecto terminado",
      closedText: "Esta galería está cerrada. Para cualquier cosa escríbeme.",
      notFound: "Galería no encontrada",
      notFoundText: "Revisa el enlace que recibiste.",
      saved: "Guardado",
      saving: "Guardando…",
      warnNone: "Todavía no has elegido ninguna foto.",
      missing: "pendientes",
      contact: "Contacto",
      zero: "Ninguna foto seleccionada",
      seeSelected: "Solo seleccionadas",
      seeAll: "Todas",
      draftNote: "Tus elecciones se guardan solas: puedes cerrar y volver cuando quieras.",
    },
    en: {
      hello: "Hi",
      intro: "Here are your photos. Pick your favourites, tell me which style you like and answer a few questions, so I can edit them just the way you imagine.",
      tabPhotos: "Photos",
      tabStyle: "Style",
      tabQuestions: "Questions",
      tabSend: "Send",
      selected: "selected",
      of: "of",
      maxReached: "You've reached the maximum number of photos",
      choose: "Choose up to {n} photos",
      chooseFree: "Choose the photos you like",
      tapHeart: "Tap the heart to select, tap the photo to enlarge it.",
      next: "Next",
      back: "Back",
      comment: "A note about this photo (optional)",
      styleIntro: "For each pair tap the version you like best. You can also say how much.",
      much: "Very",
      bit: "Slightly",
      same: "No preference",
      qIntro: "A few questions to get to know your taste.",
      yourAnswer: "Your answer…",
      summary: "Summary",
      photosChosen: "Photos chosen",
      styleDone: "Style preferences",
      answers: "Answers",
      send: "Send my choices",
      sendConfirmT: "Send your choices?",
      sendConfirm: "Once sent you won't be able to change them. If you change your mind, just message me.",
      cancel: "Cancel",
      sent: "Thank you!",
      sentText: "I've received your choices. I'll get back to you as soon as the photos are ready.",
      sentOn: "Sent on",
      notReady: "The gallery isn't ready yet",
      notReadyText: "Please try again soon: I'll let you know when it's available.",
      closed: "Project completed",
      closedText: "This gallery is closed. Feel free to message me for anything.",
      notFound: "Gallery not found",
      notFoundText: "Please check the link you received.",
      saved: "Saved",
      saving: "Saving…",
      warnNone: "You haven't chosen any photos yet.",
      missing: "missing",
      contact: "Contact",
      zero: "No photos selected",
      seeSelected: "Selected only",
      seeAll: "All",
      draftNote: "Your choices are saved automatically: you can close and come back anytime.",
    },
  };
  GB.T = (lang) => (k, vars) => {
    let s = (GB.I18N[lang] || GB.I18N.it)[k] || GB.I18N.it[k] || k;
    if (vars) for (const v in vars) s = s.replace("{" + v + "}", vars[v]);
    return s;
  };

  /* ---------- Tema chiaro / scuro ---------- */
  // Senza scelta segue il sistema; il pulsante forza chiaro o scuro e lo ricorda in questo browser.
  GB.theme = {
    get() {
      try {
        return localStorage.getItem("gb-theme");
      } catch (e) {
        return null;
      }
    },
    isDark() {
      const t = GB.theme.get();
      return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    },
    icon: () => (GB.theme.isDark() ? "☀︎" : "☾"),
    toggle() {
      const next = GB.theme.isDark() ? "light" : "dark";
      try {
        localStorage.setItem("gb-theme", next);
      } catch (e) {}
      document.documentElement.dataset.theme = next;
      GB.$$(".theme-btn").forEach((b) => (b.textContent = GB.theme.icon()));
    },
    button: () =>
      `<button type="button" class="theme-btn" aria-label="Modalità chiara / scura" title="Modalità chiara / scura" onclick="GB.theme.toggle()">${GB.theme.icon()}</button>`,
  };
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () =>
    GB.$$(".theme-btn").forEach((b) => (b.textContent = GB.theme.icon()))
  );

  // Sorgente leggera per le griglie: la miniatura se c'è, altrimenti la foto
  GB.src = (i) => (i && (i.thumb || i.data)) || "";

  GB.LANGS = { it: "Italiano", es: "Español", en: "English" };
  GB.STATUS = {
    draft: { label: "Bozza", cls: "gray" },
    open: { label: "In attesa del cliente", cls: "blue" },
    progress: { label: "Il cliente sta scegliendo", cls: "orange" },
    submitted: { label: "Scelte ricevute", cls: "green" },
    closed: { label: "Concluso", cls: "gray" },
  };
  GB.projectStatus = (p, r) => {
    if (p.status === "closed") return "closed";
    if (p.status === "draft") return "draft";
    if (r && r.status === "submitted") return "submitted";
    if (r && (r.selected || []).length) return "progress";
    return "open";
  };
  GB.galleryLink = (pid) => location.href.split("#")[0] + "#/g/" + pid;
})();
