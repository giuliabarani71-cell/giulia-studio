/*
 * Livello dati. Due motori con la stessa interfaccia:
 *  - "local": IndexedDB nel browser (modalità demo, nessuna configurazione)
 *  - "firebase": Firestore + Firebase Auth (piano gratuito Spark)
 *
 * Struttura (Firestore):
 *  clients/{id}                          profilo cliente (solo amministratore)
 *  projects/{id}                         progetto (leggibile da chi ha il link)
 *  projects/{id}/images/{imageId}        foto: metadati + MINIATURA (~40 KB) — kind "gallery"
 *  projects/{id}/images/{imageId}_full   foto grande (~1280 px) — kind "full", scaricata solo quando serve
 *  projects/{id}/images/style_…          coppie di stile — kind "style"
 *  projects/{id}/response/main           scelte del cliente
 *
 * Perché è veloce:
 *  - le griglie usano solo le miniature; la foto grande arriva quando la si apre;
 *  - progetti, clienti e scelte restano in memoria per la sessione (con scadenza breve
 *    per le scelte), così passare da una sezione all'altra non rifà tutte le letture;
 *  - le foto caricate con la versione precedente (grande dentro la miniatura) vengono
 *    convertite in automatico la prima volta che Giulia apre il progetto.
 */
(function () {
  const GB = window.GB;
  const cfg = window.GB_CONFIG || {};
  const FB_VER = "10.12.2";
  const useFirebase = !!(cfg.firebase && cfg.firebase.apiKey && cfg.firebase.projectId);
  const clean = (o) => JSON.parse(JSON.stringify(o));
  const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
  const THUMB = 480;
  const makeThumb = async (data) => (await GB.resizeImage(data, THUMB, 0.7)).data;

  /* ================= LOCAL (IndexedDB) ================= */
  function Local() {
    let dbp;
    const open = () =>
      dbp ||
      (dbp = new Promise((res, rej) => {
        const r = indexedDB.open("gb-studio", 1);
        r.onupgradeneeded = () => {
          const d = r.result;
          d.createObjectStore("projects", { keyPath: "id" });
          d.createObjectStore("images", { keyPath: "id" }).createIndex("pid", "pid");
          d.createObjectStore("responses", { keyPath: "pid" });
          d.createObjectStore("clients", { keyPath: "id" });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      }));
    const tx = async (store, mode, fn) => {
      const d = await open();
      return new Promise((res, rej) => {
        const t = d.transaction(store, mode);
        let out;
        const req = fn(t.objectStore(store));
        if (req) req.onsuccess = () => (out = req.result);
        t.oncomplete = () => res(out);
        t.onerror = () => rej(t.error);
      });
    };
    const all = (s) => tx(s, "readonly", (st) => st.getAll());
    const get = (s, k) => tx(s, "readonly", (st) => st.get(k));
    const put = (s, v) => tx(s, "readwrite", (st) => st.put(clean(v)));
    const del = (s, k) => tx(s, "readwrite", (st) => st.delete(k));

    return {
      mode: "local",
      async init() {
        await open();
      },
      onAuth(cb) {
        cb({ email: "demo", demo: true });
      },
      async signIn() {},
      async signOut() {},
      async resetPassword() {},

      async listProjects() {
        return (await all("projects")).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      },
      getProject: (id) => get("projects", id),
      async saveProject(p) {
        p.id = p.id || GB.uid();
        p.createdAt = p.createdAt || Date.now();
        p.updatedAt = Date.now();
        await put("projects", p);
        return p;
      },
      async deleteProject(id) {
        const imgs = await this.listImages(id);
        for (const i of imgs) await del("images", id + "/" + i.id);
        await del("responses", id);
        await del("projects", id);
      },
      async listImages(pid) {
        return (await tx("images", "readonly", (st) => st.index("pid").getAll(pid))).map((i) => ({ ...i, id: i.iid })).sort(byOrder);
      },
      async addImage(pid, img) {
        const iid = img.id || GB.uid();
        if (img.kind === "gallery" && img.data && !img.thumb) img.thumb = await makeThumb(img.data);
        await put("images", { ...img, iid, id: pid + "/" + iid, pid });
        return iid;
      },
      async updateImage(pid, iid, patch) {
        const cur = await get("images", pid + "/" + iid);
        if (cur) await put("images", { ...cur, ...patch });
      },
      deleteImage: (pid, iid) => del("images", pid + "/" + iid),
      async getFull(pid, img) {
        return img.data || ((await get("images", pid + "/" + img.id)) || {}).data || img.thumb;
      },
      // aggiunge le miniature alle foto create prima di questa versione
      async optimize(pid) {
        let n = 0;
        for (const i of await this.listImages(pid))
          if (i.kind === "gallery" && i.data && !i.thumb) {
            await this.updateImage(pid, i.id, { thumb: await makeThumb(i.data) });
            n++;
          }
        return n;
      },
      async getResponse(pid) {
        const r = await get("responses", pid);
        if (r) delete r.pid;
        return r || null;
      },
      saveResponse: (pid, r) => put("responses", { ...r, pid }),

      async listClients() {
        return (await all("clients")).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      },
      getClient: (id) => get("clients", id),
      async saveClient(c) {
        c.id = c.id || GB.uid();
        c.createdAt = c.createdAt || Date.now();
        c.updatedAt = Date.now();
        await put("clients", c);
        return c;
      },
      deleteClient: (id) => del("clients", id),
    };
  }

  /* ================= FIREBASE (Firestore + Auth) ================= */
  function Firebase() {
    let fs, auth;
    const loadScript = (src) =>
      new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = res;
        s.onerror = () => rej(new Error("Impossibile caricare " + src));
        document.head.appendChild(s);
      });
    const P = (id) => fs.collection("projects").doc(id);
    const IMG = (pid) => P(pid).collection("images");
    const FULL = (iid) => iid + "_full";
    const snap = (d) => (d.exists ? { ...d.data(), id: d.id } : null);

    /* ---- memoria di sessione ---- */
    const memo = new Map(); // chiave → { t, pr }
    const cached = (key, ttl, fn) => {
      const m = memo.get(key);
      if (m && Date.now() - m.t < ttl) return m.pr;
      const pr = fn();
      memo.set(key, { t: Date.now(), pr });
      pr.catch(() => memo.delete(key));
      return pr;
    };
    const setMemo = (key, value) => memo.set(key, { t: Date.now(), pr: Promise.resolve(value) });
    const fresh = (key, ttl) => {
      const m = memo.get(key);
      return m && Date.now() - m.t < ttl ? m.pr : null;
    };
    // aggiorna un elenco in memoria senza rileggere da Firestore
    const patchList = async (key, item, remove) => {
      const m = memo.get(key);
      if (!m) return;
      let list = await m.pr.catch(() => null);
      if (!list) return;
      list = list.filter((x) => x.id !== item.id);
      if (!remove) list.unshift(item);
      memo.set(key, { t: m.t, pr: Promise.resolve(list) });
    };
    const TTL_LIST = 5 * 60e3; // progetti e clienti li modifica solo Giulia
    const TTL_RESP = 20e3; // le scelte le scrive il cliente: si rileggono spesso

    const imgCache = new Map(); // pid → Promise<lista immagini leggere>
    const fullCache = new Map(); // pid/iid → Promise<dataURL grande>
    const patchImgs = async (pid, fn) => {
      if (imgCache.has(pid)) imgCache.set(pid, Promise.resolve(fn(await imgCache.get(pid))));
    };

    return {
      mode: "firebase",
      async init() {
        const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
        await loadScript(base + "firebase-app-compat.js");
        await Promise.all([loadScript(base + "firebase-auth-compat.js"), loadScript(base + "firebase-firestore-compat.js")]);
        firebase.initializeApp(cfg.firebase);
        fs = firebase.firestore();
        // Alcune reti (proxy, antivirus, adblock) bloccano lo streaming di Firestore:
        // il rilevamento automatico passa al long-polling invece di restare appeso.
        fs.settings({ experimentalAutoDetectLongPolling: true, merge: true });
        auth = firebase.auth();
      },
      onAuth(cb) {
        auth.onAuthStateChanged((u) => {
          if (!u) memo.clear();
          cb(u ? { email: u.email, uid: u.uid } : null);
        });
      },
      signIn: (email, pw) => auth.signInWithEmailAndPassword(email, pw),
      signOut: () => auth.signOut(),
      resetPassword: (email) => auth.sendPasswordResetEmail(email),
      refresh() {
        memo.clear();
      },

      /* ---- progetti ---- */
      async listProjects() {
        const list = await cached("projects", TTL_LIST, async () => (await fs.collection("projects").orderBy("createdAt", "desc").get()).docs.map(snap));
        return list.map((p) => ({ ...p }));
      },
      async getProject(id) {
        const all = fresh("projects", TTL_LIST);
        if (all) {
          const p = (await all).find((x) => x.id === id);
          if (p) return clean(p);
        }
        const p = await cached("project:" + id, TTL_LIST, async () => snap(await P(id).get()));
        return p ? clean(p) : null;
      },
      async saveProject(p) {
        const ref = p.id ? P(p.id) : fs.collection("projects").doc();
        p.id = ref.id;
        p.createdAt = p.createdAt || Date.now();
        p.updatedAt = Date.now();
        const data = clean(p);
        delete data.id;
        delete data._r;
        delete data._st;
        await ref.set(data);
        const item = { ...data, id: ref.id };
        setMemo("project:" + ref.id, item);
        await patchList("projects", item);
        const m = memo.get("projects");
        if (m) memo.set("projects", { t: m.t, pr: m.pr.then((l) => l.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))) });
        return p;
      },
      async deleteProject(id) {
        const imgs = await IMG(id).get();
        let batch = fs.batch(),
          n = 0;
        for (const d of imgs.docs) {
          batch.delete(d.ref);
          if (++n % 400 === 0) {
            await batch.commit();
            batch = fs.batch();
          }
        }
        batch.delete(P(id).collection("response").doc("main"));
        batch.delete(P(id));
        await batch.commit();
        imgCache.delete(id);
        memo.delete("project:" + id);
        memo.delete("resp:" + id);
        await patchList("projects", { id }, true);
      },

      /* ---- immagini ---- */
      // Solo metadati, miniature e coppie di stile: le foto grandi ("full") non si scaricano qui.
      async listImages(pid) {
        if (!imgCache.has(pid)) {
          const pr = IMG(pid)
            .where("kind", "in", ["gallery", "style"])
            .get()
            .then((q) => q.docs.map(snap));
          imgCache.set(pid, pr);
          pr.catch(() => imgCache.delete(pid));
        }
        return (await imgCache.get(pid)).map((i) => ({ ...i })).sort(byOrder);
      },
      async addImage(pid, img) {
        const ref = img.id ? IMG(pid).doc(img.id) : IMG(pid).doc();
        const data = clean(img);
        delete data.id;
        if (data.kind === "gallery" && data.data) {
          const full = data.data;
          data.thumb = data.thumb || (await makeThumb(full));
          img.thumb = data.thumb;
          delete data.data;
          data.hasFull = true;
          await IMG(pid).doc(FULL(ref.id)).set({ kind: "full", of: ref.id, data: full });
          fullCache.set(pid + "/" + ref.id, Promise.resolve(full));
        }
        await ref.set(data);
        await patchImgs(pid, (l) => l.filter((i) => i.id !== ref.id).concat({ ...data, id: ref.id }));
        return ref.id;
      },
      async updateImage(pid, iid, patch) {
        await IMG(pid).doc(iid).update(clean(patch));
        await patchImgs(pid, (l) => l.map((i) => (i.id === iid ? { ...i, ...patch } : i)));
      },
      async deleteImage(pid, iid) {
        const b = fs.batch();
        b.delete(IMG(pid).doc(iid));
        b.delete(IMG(pid).doc(FULL(iid)));
        await b.commit();
        fullCache.delete(pid + "/" + iid);
        await patchImgs(pid, (l) => l.filter((i) => i.id !== iid));
      },
      // Foto grande: scaricata solo quando serve (lightbox, generazione coppie di stile)
      getFull(pid, img) {
        if (img.data) return Promise.resolve(img.data);
        const k = pid + "/" + img.id;
        if (!fullCache.has(k)) {
          const pr = IMG(pid)
            .doc(FULL(img.id))
            .get()
            .then((d) => (d.exists ? d.data().data : img.thumb));
          fullCache.set(k, pr);
          pr.catch(() => fullCache.delete(k));
        }
        return fullCache.get(k);
      },
      // Converte le foto salvate con la versione precedente (foto grande dentro il documento leggero)
      async optimize(pid) {
        const old = (await this.listImages(pid)).filter((i) => i.kind === "gallery" && i.data);
        for (const i of old) {
          const thumb = i.thumb || (await makeThumb(i.data));
          await IMG(pid).doc(FULL(i.id)).set({ kind: "full", of: i.id, data: i.data });
          await IMG(pid).doc(i.id).update({ thumb, hasFull: true, data: firebase.firestore.FieldValue.delete() });
          fullCache.set(pid + "/" + i.id, Promise.resolve(i.data));
          await patchImgs(pid, (l) =>
            l.map((x) => {
              if (x.id !== i.id) return x;
              const y = { ...x, thumb, hasFull: true };
              delete y.data;
              return y;
            })
          );
        }
        return old.length;
      },

      /* ---- scelte del cliente ---- */
      async getResponse(pid) {
        const r = await cached("resp:" + pid, TTL_RESP, async () => {
          const d = await P(pid).collection("response").doc("main").get();
          return d.exists ? d.data() : null;
        });
        return r ? clean(r) : null;
      },
      async saveResponse(pid, r) {
        const data = clean(r);
        await P(pid).collection("response").doc("main").set(data);
        setMemo("resp:" + pid, data);
      },

      /* ---- clienti ---- */
      async listClients() {
        const list = await cached("clients", TTL_LIST, async () =>
          (await fs.collection("clients").get()).docs.map(snap).sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        );
        return list.map((c) => clean(c));
      },
      async getClient(id) {
        const all = fresh("clients", TTL_LIST);
        if (all) {
          const c = (await all).find((x) => x.id === id);
          if (c) return clean(c);
        }
        const c = await cached("client:" + id, TTL_LIST, async () => snap(await fs.collection("clients").doc(id).get()));
        return c ? clean(c) : null;
      },
      async saveClient(c) {
        const ref = c.id ? fs.collection("clients").doc(c.id) : fs.collection("clients").doc();
        c.id = ref.id;
        c.createdAt = c.createdAt || Date.now();
        c.updatedAt = Date.now();
        const data = clean(c);
        delete data.id;
        await ref.set(data);
        const item = { ...data, id: ref.id };
        setMemo("client:" + ref.id, item);
        await patchList("clients", item);
        const m = memo.get("clients");
        if (m) memo.set("clients", { t: m.t, pr: m.pr.then((l) => l.sort((a, b) => (a.name || "").localeCompare(b.name || ""))) });
        return c;
      },
      async deleteClient(id) {
        await fs.collection("clients").doc(id).delete();
        memo.delete("client:" + id);
        await patchList("clients", { id }, true);
      },
    };
  }

  GB.db = useFirebase ? Firebase() : Local();
})();
