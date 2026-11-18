/*
 * Livello dati. Due motori con la stessa interfaccia:
 *  - "local": IndexedDB nel browser (modalità demo, nessuna configurazione)
 *  - "firebase": Firestore + Firebase Auth (piano gratuito Spark)
 *
 * Struttura (Firestore):
 *  clients/{id}                         profilo cliente (solo amministratore)
 *  projects/{id}                        progetto (leggibile da chi ha il link)
 *  projects/{id}/images/{imageId}       foto a bassa risoluzione (base64) + coppie di stile
 *  projects/{id}/response/main          scelte del cliente
 *
 * Le foto sono salvate in Firestore come JPEG base64 ridotti (max ~700 KB l'uno):
 * Firebase Storage sul piano gratuito non è più disponibile per i nuovi progetti.
 */
(function () {
  const GB = window.GB;
  const cfg = window.GB_CONFIG || {};
  const FB_VER = "10.12.2";
  const useFirebase = !!(cfg.firebase && cfg.firebase.apiKey && cfg.firebase.projectId);
  const clean = (o) => JSON.parse(JSON.stringify(o));
  const byOrder = (a, b) => (a.order || 0) - (b.order || 0);

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

    const authCbs = [];
    return {
      mode: "local",
      async init() {
        await open();
      },
      onAuth(cb) {
        authCbs.push(cb);
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
        for (const i of imgs) await del("images", i.id);
        await del("responses", id);
        await del("projects", id);
      },
      async listImages(pid) {
        return (await tx("images", "readonly", (st) => st.index("pid").getAll(pid))).map((i) => ({ ...i, id: i.iid })).sort(byOrder);
      },
      async addImage(pid, img) {
        const iid = img.id || GB.uid();
        await put("images", { ...img, iid, id: pid + "/" + iid, pid });
        return iid;
      },
      async updateImage(pid, iid, patch) {
        const cur = await get("images", pid + "/" + iid);
        if (cur) await put("images", { ...cur, ...patch });
      },
      deleteImage: (pid, iid) => del("images", pid + "/" + iid),
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
    const snap = (d) => (d.exists ? { ...d.data(), id: d.id } : null);

    return {
      mode: "firebase",
      async init() {
        const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
        await loadScript(base + "firebase-app-compat.js");
        await Promise.all([loadScript(base + "firebase-auth-compat.js"), loadScript(base + "firebase-firestore-compat.js")]);
        firebase.initializeApp(cfg.firebase);
        fs = firebase.firestore();
        auth = firebase.auth();
      },
      onAuth(cb) {
        auth.onAuthStateChanged((u) => cb(u ? { email: u.email, uid: u.uid } : null));
      },
      signIn: (email, pw) => auth.signInWithEmailAndPassword(email, pw),
      signOut: () => auth.signOut(),
      resetPassword: (email) => auth.sendPasswordResetEmail(email),

      async listProjects() {
        const q = await fs.collection("projects").orderBy("createdAt", "desc").get();
        return q.docs.map(snap);
      },
      async getProject(id) {
        return snap(await P(id).get());
      },
      async saveProject(p) {
        const ref = p.id ? P(p.id) : fs.collection("projects").doc();
        p.id = ref.id;
        p.createdAt = p.createdAt || Date.now();
        p.updatedAt = Date.now();
        const data = clean(p);
        delete data.id;
        await ref.set(data);
        return p;
      },
      async deleteProject(id) {
        const imgs = await P(id).collection("images").get();
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
      },
      async listImages(pid) {
        const q = await P(pid).collection("images").get();
        return q.docs.map(snap).sort(byOrder);
      },
      async addImage(pid, img) {
        const ref = img.id ? P(pid).collection("images").doc(img.id) : P(pid).collection("images").doc();
        const data = clean(img);
        delete data.id;
        await ref.set(data);
        return ref.id;
      },
      updateImage: (pid, iid, patch) => P(pid).collection("images").doc(iid).update(clean(patch)),
      deleteImage: (pid, iid) => P(pid).collection("images").doc(iid).delete(),
      async getResponse(pid) {
        const d = await P(pid).collection("response").doc("main").get();
        return d.exists ? d.data() : null;
      },
      saveResponse: (pid, r) => P(pid).collection("response").doc("main").set(clean(r)),

      async listClients() {
        const q = await fs.collection("clients").get();
        return q.docs.map(snap).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      },
      async getClient(id) {
        return snap(await fs.collection("clients").doc(id).get());
      },
      async saveClient(c) {
        const ref = c.id ? fs.collection("clients").doc(c.id) : fs.collection("clients").doc();
        c.id = ref.id;
        c.createdAt = c.createdAt || Date.now();
        c.updatedAt = Date.now();
        const data = clean(c);
        delete data.id;
        await ref.set(data);
        return c;
      },
      deleteClient: (id) => fs.collection("clients").doc(id).delete(),
    };
  }

  GB.db = useFirebase ? Firebase() : Local();
})();
