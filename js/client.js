/* Galleria del cliente: scelta foto, preferenze di stile, domande, invio */
(function () {
  const GB = window.GB;
  const { $, $$, esc } = GB;
  const C = (GB.client = {});

  const screen = (t, title, text, extra = "") => {
    $("#app").innerHTML = `<div class="cl"><header class="cl-top"><img src="img/logo.png" class="logo" alt="Giulia Barani"></header>
      <div class="center-screen"><div class="card narrow center"><h2>${title}</h2><p class="muted">${text}</p>${extra}</div></div>${footer(t)}</div>`;
  };
  const footer = (t) => {
    const c = (window.GB_CONFIG || {}).contact || {};
    const links = [
      c.whatsapp && `<a href="https://wa.me/${esc(c.whatsapp)}" target="_blank">WhatsApp</a>`,
      c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`,
      c.instagram && `<a href="https://instagram.com/${esc(c.instagram)}" target="_blank">@${esc(c.instagram)}</a>`,
    ].filter(Boolean);
    return `<footer class="cl-foot">${links.length ? `<span>${t("contact")}:</span> ${links.join(" · ")}<br>` : ""}© ${new Date().getFullYear()} ${esc(
      (window.GB_CONFIG || {}).studioName || "Giulia Barani"
    )}</footer>`;
  };

  C.render = async (pid, mode) => {
    document.body.classList.add("client-mode");
    const preview = location.hash.endsWith("/preview");
    $("#app").innerHTML = `<div class="center-screen"><div class="spinner"></div></div>`;
    let p = null;
    try {
      p = pid ? await GB.db.getProject(pid) : null;
    } catch (e) {
      console.error(e);
    }
    const savedLang = (() => {
      try {
        return localStorage.getItem("gb-lang-" + pid);
      } catch (e) {
        return null;
      }
    })();
    let lang = savedLang || (p && p.lang) || (navigator.language || "it").slice(0, 2);
    if (!GB.I18N[lang]) lang = "it";
    let t = GB.T(lang);
    if (!p) return screen(t, t("notFound"), t("notFoundText"));
    if (p.status === "draft" && !preview) return screen(t, t("notReady"), t("notReadyText"));
    if (p.status === "closed" && !preview) return screen(t, t("closed"), t("closedText"));

    const [imgs, r0] = await Promise.all([GB.db.listImages(pid), GB.db.getResponse(pid)]);
    const gal = imgs.filter((i) => i.kind === "gallery");
    const pairs = GB.AXES.map((ax) => ({
      ax,
      a: imgs.find((i) => i.kind === "style" && i.axis === ax.key && i.side === "a"),
      b: imgs.find((i) => i.kind === "style" && i.axis === ax.key && i.side === "b"),
    })).filter((x) => x.a && x.b);
    const qs = (p.questions || []).filter((q) => q.text);
    const r = r0 || { status: "draft", selected: [], comments: {}, style: {}, answers: {} };
    r.selected = r.selected || [];
    r.comments = r.comments || {};
    r.style = r.style || {};
    r.answers = r.answers || {};
    const sel = new Set(r.selected);
    const max = p.maxSelections || 0;
    const first = (p.clientName || "").split(/\s+/)[0];

    if (r.status === "submitted" && !preview) return thanks();

    const steps = [["photos", "tabPhotos"]];
    if (pairs.length) steps.push(["style", "tabStyle"]);
    if (qs.length) steps.push(["questions", "tabQuestions"]);
    steps.push(["send", "tabSend"]);
    let step = "photos";
    let onlySel = false;

    function shell() {
      $("#app").innerHTML = `<div class="cl">
        ${preview ? `<div class="demo-bar">Anteprima di Giulia: qui le scelte non vengono salvate. ${p.status === "draft" ? "La galleria è ancora in bozza." : ""}</div>` : ""}
        <header class="cl-top">
          <img src="img/logo.png" class="logo" alt="Giulia Barani">
          <div class="langs">${Object.keys(GB.LANGS).map((k) => `<button data-l="${k}" class="${k === lang ? "on" : ""}">${k.toUpperCase()}</button>`).join("")}</div>
        </header>
        <section class="hero">
          <p class="eyebrow">${esc(p.title)}</p>
          <h1>${t("hello")}${first ? " " + esc(first) : ""}</h1>
          <p class="lead">${esc(p.message || t("intro")).replace(/\n/g, "<br>")}</p>
          <p class="small muted">${t("draftNote")}</p>
        </section>
        <nav class="seg steps" id="steps"></nav>
        <main id="cstep" class="cl-main"></main>
        ${footer(t)}
        <div class="fbar" id="fbar"></div>
      </div>`;
      $$(".langs button").forEach(
        (b) =>
          (b.onclick = () => {
            lang = b.dataset.l;
            t = GB.T(lang);
            try {
              localStorage.setItem("gb-lang-" + pid, lang);
            } catch (e) {}
            shell();
          })
      );
      drawSteps();
      drawStep();
    }

    const styleDone = () => pairs.filter((x) => r.style[x.ax.key] != null).length;
    const qDone = () => qs.filter((q) => (Array.isArray(r.answers[q.id]) ? r.answers[q.id].length : (r.answers[q.id] || "").trim())).length;

    function drawSteps() {
      const cnt = {
        photos: max ? `${sel.size}/${max}` : sel.size || "",
        style: `${styleDone()}/${pairs.length}`,
        questions: `${qDone()}/${qs.length}`,
        send: "",
      };
      $("#steps").innerHTML = steps
        .map(([k, l], i) => `<button data-s="${k}" class="${k === step ? "on" : ""}"><span class="sn">${i + 1}</span>${t(l)}${cnt[k] !== "" ? ` <span class="cnt">${cnt[k]}</span>` : ""}</button>`)
        .join("");
      $$("#steps button").forEach((b) => (b.onclick = () => go(b.dataset.s)));
    }
    function go(s) {
      step = s;
      drawSteps();
      drawStep();
      const st = $("#steps");
      if (st.getBoundingClientRect().top < 0) st.scrollIntoView({ behavior: "smooth" });
    }
    const idx = () => steps.findIndex((s) => s[0] === step);

    function fbar(left) {
      const i = idx();
      $("#fbar").innerHTML = `<div class="fbar-in">
        <div class="fl">${left}<span class="small muted" id="saveSt"></span></div>
        <div class="row tight">
          ${i > 0 ? `<button class="btn ghost" id="prevS">${t("back")}</button>` : ""}
          ${i < steps.length - 1 ? `<button class="btn primary" id="nextS">${t("next")}</button>` : ""}
        </div></div>`;
      const pv = $("#prevS"),
        nx = $("#nextS");
      if (pv) pv.onclick = () => go(steps[i - 1][0]);
      if (nx) nx.onclick = () => go(steps[i + 1][0]);
    }

    let saving;
    const persist = async () => {
      if (preview) return;
      const s = $("#saveSt");
      if (s) s.textContent = " · " + t("saving");
      r.selected = gal.filter((i) => sel.has(i.id)).map((i) => i.id);
      r.updatedAt = Date.now();
      try {
        await GB.db.saveResponse(pid, r);
        if ($("#saveSt")) $("#saveSt").textContent = " · " + t("saved");
      } catch (e) {
        console.error(e);
        GB.toast("⚠︎ " + (e.message || "Error"), "err");
      }
    };
    const save = GB.debounce(persist, 700);

    function counterText() {
      return max ? `<strong>${sel.size}</strong> ${t("of")} ${max} ${t("selected")}` : `<strong>${sel.size}</strong> ${t("selected")}`;
    }
    function toggle(id) {
      if (sel.has(id)) sel.delete(id);
      else {
        if (max && sel.size >= max) {
          GB.toast(t("maxReached") + ` (${max})`);
          return false;
        }
        sel.add(id);
      }
      save();
      drawSteps();
      const fl = $("#fbar .fl");
      if (fl && (step === "photos" || step === "send")) fl.innerHTML = counterText() + `<span class="small muted" id="saveSt"></span>`;
      return true;
    }

    /* ----- Step 1: foto ----- */
    function drawPhotos() {
      const list = onlySel ? gal.filter((i) => sel.has(i.id)) : gal;
      $("#cstep").innerHTML = `
        <div class="row between step-head">
          <div><h2>${max ? t("choose", { n: max }) : t("chooseFree")}</h2><p class="small muted">${t("tapHeart")}</p></div>
          <div class="seg small" id="onlySel"><button data-v="0" class="${onlySel ? "" : "on"}">${t("seeAll")} ${gal.length}</button><button data-v="1" class="${
        onlySel ? "on" : ""
      }">${t("seeSelected")}</button></div>
        </div>
        <div class="cgrid">${
          list
            .map(
              (i) => `<figure class="${sel.has(i.id) ? "sel" : ""}" data-id="${i.id}">
            <img src="${i.data}" alt="" loading="lazy">
            <button class="heart" aria-label="♥" data-h="${i.id}">${heart()}</button>
            ${r.comments[i.id] ? `<span class="note-dot" title="${esc(r.comments[i.id])}">✎</span>` : ""}
          </figure>`
            )
            .join("") || `<p class="muted">${t("zero")}</p>`
        }</div>`;
      $$("#onlySel button").forEach(
        (b) =>
          (b.onclick = () => {
            onlySel = b.dataset.v === "1";
            drawPhotos();
          })
      );
      $$(".cgrid figure").forEach((f) => {
        $("img", f).onclick = () => lightbox(f.dataset.id);
        $(".heart", f).onclick = (e) => {
          e.stopPropagation();
          if (toggle(f.dataset.id)) {
            f.classList.toggle("sel", sel.has(f.dataset.id));
            f.classList.add("pop");
            setTimeout(() => f.classList.remove("pop"), 300);
            if (onlySel && !sel.has(f.dataset.id)) f.remove();
          }
        };
      });
      fbar(counterText());
    }
    const heart = () =>
      `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.6 3 5 6.6 5c2.1 0 3.6 1.2 4.4 2.5h2C13.8 6.2 15.3 5 17.4 5 21 5 23.1 8.6 21.6 11.8 19.5 16.4 12 21 12 21z"/></svg>`;

    function lightbox(id) {
      const list = onlySel ? gal.filter((i) => sel.has(i.id)) : gal;
      let k = list.findIndex((i) => i.id === id);
      const lb = document.createElement("div");
      lb.className = "lightbox";
      document.body.appendChild(lb);
      document.body.style.overflow = "hidden";
      const draw = () => {
        const im = list[k];
        lb.innerHTML = `
          <button class="lb-close" aria-label="close">×</button>
          <div class="lb-count">${k + 1} / ${list.length}</div>
          <button class="lb-nav prev" ${k === 0 ? "disabled" : ""}>‹</button>
          <img src="${im.data}" alt="">
          <button class="lb-nav next" ${k === list.length - 1 ? "disabled" : ""}>›</button>
          <div class="lb-bar">
            <button class="heart big ${sel.has(im.id) ? "on" : ""}" id="lbH">${heart()}</button>
            <input id="lbC" placeholder="${t("comment")}" value="${esc(r.comments[im.id] || "")}" maxlength="300">
          </div>`;
        $(".lb-close", lb).onclick = close;
        $(".prev", lb).onclick = () => k > 0 && (k--, draw());
        $(".next", lb).onclick = () => k < list.length - 1 && (k++, draw());
        $("#lbH", lb).onclick = () => {
          if (toggle(im.id)) $("#lbH", lb).classList.toggle("on", sel.has(im.id));
        };
        $("#lbC", lb).oninput = (e) => {
          r.comments[im.id] = e.target.value;
          if (!e.target.value) delete r.comments[im.id];
          save();
        };
      };
      const onKey = (e) => {
        if (document.activeElement && document.activeElement.id === "lbC" && e.key !== "Escape") return;
        if (e.key === "Escape") close();
        if (e.key === "ArrowLeft" && k > 0) (k--, draw());
        if (e.key === "ArrowRight" && k < list.length - 1) (k++, draw());
        if (e.key === " ") {
          e.preventDefault();
          $("#lbH", lb).click();
        }
      };
      let x0 = null;
      lb.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
      lb.addEventListener("touchend", (e) => {
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (dx > 50 && k > 0) (k--, draw());
        if (dx < -50 && k < list.length - 1) (k++, draw());
        x0 = null;
      });
      function close() {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
        lb.remove();
        drawPhotos();
      }
      document.addEventListener("keydown", onKey);
      draw();
    }

    /* ----- Step 2: stile ----- */
    function drawStyle() {
      $("#cstep").innerHTML = `
        <div class="step-head"><h2>${t("tabStyle")}</h2><p class="small muted">${t("styleIntro")}</p></div>
        <div class="cpairs">${pairs
          .map(({ ax, a, b }) => {
            const v = r.style[ax.key];
            return `<div class="card cpair" data-axis="${ax.key}">
            <h3>${ax.title[lang] || ax.title.it}</h3>
            <div class="ab">
              <figure class="${v != null && v < 0 ? "chosen" : ""}" data-v="-2"><img src="${a.data}" alt=""><figcaption>${esc(GB.axisLabel(ax.key, "a", lang, p))}</figcaption></figure>
              <figure class="${v != null && v > 0 ? "chosen" : ""}" data-v="2"><img src="${b.data}" alt=""><figcaption>${esc(GB.axisLabel(ax.key, "b", lang, p))}</figcaption></figure>
            </div>
            ${GB.ui.scale(ax.key, v, lang, p)}
            <p class="small muted center sw">${v == null ? "&nbsp;" : esc(GB.styleWord(ax.key, v, lang, p))}</p>
          </div>`;
          })
          .join("")}</div>`;
      const set = (axis, v) => {
        r.style[axis] = v;
        const card = $(`.cpair[data-axis=${axis}]`);
        $$(".dot", card).forEach((d) => d.classList.toggle("on", +d.dataset.v === v));
        $$("figure", card).forEach((f) => f.classList.toggle("chosen", (v < 0 && +f.dataset.v < 0) || (v > 0 && +f.dataset.v > 0)));
        $(".sw", card).textContent = GB.styleWord(axis, v, lang, p);
        save();
        drawSteps();
        const fl = $("#fbar .fl");
        if (fl) fl.innerHTML = `${styleDone()}/${pairs.length}<span class="small muted" id="saveSt"></span>`;
      };
      GB.ui.bindScales($("#cstep"), set);
      $$(".cpair figure").forEach((f) => (f.onclick = () => set(f.closest(".cpair").dataset.axis, +f.dataset.v)));
      fbar(`${styleDone()}/${pairs.length}`);
    }

    /* ----- Step 3: domande ----- */
    function drawQuestions() {
      $("#cstep").innerHTML = `
        <div class="step-head"><h2>${t("tabQuestions")}</h2><p class="small muted">${t("qIntro")}</p></div>
        <div class="cqs">${qs
          .map((q, k) => {
            const a = r.answers[q.id];
            let input;
            if (q.type === "text") input = `<textarea rows="3" data-q="${q.id}" placeholder="${t("yourAnswer")}">${esc(a || "")}</textarea>`;
            else
              input = `<div class="opts" data-q="${q.id}" data-multi="${q.type === "multi" ? 1 : 0}">${(q.options || [])
                .map((o) => {
                  const on = q.type === "multi" ? (a || []).includes(o) : a === o;
                  return `<button type="button" class="opt ${on ? "on" : ""}" data-o="${esc(o)}">${esc(o)}</button>`;
                })
                .join("")}</div>`;
            return `<div class="card cq"><p class="qtext"><span class="qn">${k + 1}</span>${esc(q.text)}</p>${input}</div>`;
          })
          .join("")}</div>`;
      $$(".cq textarea").forEach(
        (ta) =>
          (ta.oninput = () => {
            r.answers[ta.dataset.q] = ta.value;
            save();
            drawSteps();
          })
      );
      $$(".opts").forEach((box) =>
        $$(".opt", box).forEach(
          (b) =>
            (b.onclick = () => {
              const id = box.dataset.q,
                o = b.dataset.o;
              if (box.dataset.multi === "1") {
                const arr = new Set(r.answers[id] || []);
                arr.has(o) ? arr.delete(o) : arr.add(o);
                r.answers[id] = [...arr];
                b.classList.toggle("on");
              } else {
                r.answers[id] = r.answers[id] === o ? "" : o;
                $$(".opt", box).forEach((x) => x.classList.toggle("on", x.dataset.o === r.answers[id]));
              }
              save();
              drawSteps();
              fbar(`${qDone()}/${qs.length}`);
            })
        )
      );
      fbar(`${qDone()}/${qs.length}`);
    }

    /* ----- Step 4: invio ----- */
    function drawSend() {
      const chosen = gal.filter((i) => sel.has(i.id));
      const row = (label, val, ok, s) =>
        `<li class="${ok ? "ok" : "no"}"><span>${label}</span><strong>${val}</strong>${s ? `<button class="link small" data-go="${s}">›</button>` : ""}</li>`;
      $("#cstep").innerHTML = `
        <div class="step-head"><h2>${t("summary")}</h2></div>
        <div class="card">
          <ul class="sumlist">
            ${row(t("photosChosen"), max ? `${sel.size} ${t("of")} ${max}` : sel.size, sel.size > 0, "photos")}
            ${pairs.length ? row(t("styleDone"), `${styleDone()}/${pairs.length}`, styleDone() === pairs.length, "style") : ""}
            ${qs.length ? row(t("answers"), `${qDone()}/${qs.length}`, qDone() === qs.length, "questions") : ""}
          </ul>
          <div class="mini">${chosen.map((i) => `<img src="${i.data}" alt="">`).join("")}</div>
          ${sel.size === 0 ? `<p class="warn small">${t("warnNone")}</p>` : ""}
          <button class="btn primary wide big" id="sendBtn" ${sel.size === 0 ? "disabled" : ""}>${t("send")}</button>
        </div>`;
      $$("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
      $("#sendBtn").onclick = async () => {
        const ok = await GB.modal({
          title: t("sendConfirmT"),
          body: `<p class="muted">${t("sendConfirm")}</p>`,
          actions: [
            { label: t("cancel"), value: false },
            { label: t("send"), value: true, primary: true },
          ],
        });
        if (!ok) return;
        if (preview) return GB.toast("Anteprima: invio simulato, nulla è stato salvato");
        r.status = "submitted";
        r.submittedAt = Date.now();
        await persist();
        thanks();
      };
      fbar(counterText());
    }

    function drawStep() {
      ({ photos: drawPhotos, style: drawStyle, questions: drawQuestions, send: drawSend })[step]();
    }

    function thanks() {
      const chosen = gal.filter((i) => sel.has(i.id));
      $("#app").innerHTML = `<div class="cl">
        <header class="cl-top"><img src="img/logo.png" class="logo" alt="Giulia Barani"></header>
        <section class="hero center"><div class="check">✓</div><h1>${t("sent")}</h1><p class="lead">${t("sentText")}</p>
        <p class="small muted">${t("sentOn")} ${GB.fmtDate(r.submittedAt, lang)} · ${chosen.length} ${t("selected")}</p></section>
        <div class="mini big">${chosen.map((i) => `<img src="${i.data}" alt="">`).join("")}</div>
        ${footer(t)}</div>`;
    }

    shell();
  };
})();
