# Giulia Barani · Studio

Web app per gestire i clienti di Giulia Barani Photography e le loro scelte delle foto.

- **Giulia** crea un progetto per un cliente. Dentro carica 20–30 foto a bassa risoluzione, 4 coppie di immagini di stile e le domande.
- **Il cliente** apre un link personale, senza registrarsi. Sceglie le foto con il cuore e può lasciare una nota. Indica lo stile che preferisce (temperatura, saturazione, contrasto, high/low key), risponde alle domande e invia. La galleria è in italiano, spagnolo o inglese.
- **Giulia** vede le scelte in una pagina dedicata: foto scelte, nomi dei file da incollare in Lightroom, stile preferito e risposte. Con un clic salva tutto nel **profilo del cliente**, che resta consultabile e modificabile.
- Ogni progetto ha un **tema** (Matrimonio, Coppia, Famiglia…) con una breve descrizione, scelto alla creazione. Le scelte del cliente vengono salvate nel profilo anche **per tema**, e la pagina **Temi** mostra lo stile medio scelto dai clienti di ogni tema.
- Quando un cliente invia le scelte, Giulia riceve una **notifica**: numero sulla campanella, avviso nell'app e, se lo attiva, notifica del dispositivo. L'avviso arriva mentre l'app è aperta, anche in una scheda in secondo piano. Ad app chiusa le notifiche restano e si vedono alla riapertura.
- Il **profilo cliente** contiene tipo (Privato o Azienda, con il referente per le aziende), telefono/WhatsApp, email e provenienza. Telefono e WhatsApp sono cliccabili.
- Ogni progetto registra le **date** di creazione, apertura al cliente, invio delle scelte e chiusura, mostrate come una linea del tempo.
- Se la galleria è in spagnolo o inglese, nella pagina delle scelte il pulsante **🇮🇹 Traduci in italiano** traduce domande, risposte e note del cliente. Le domande predefinite vengono tradotte sempre. I testi liberi usano il traduttore integrato di Chrome, che lavora sul dispositivo e non invia nulla a terzi; dove non c'è, compare un link a Google Traduttore. La traduzione viene salvata nel progetto.
- Nella sezione **Guida** c'è un tour interattivo che spiega ogni funzione.

È fatta solo di HTML, CSS e JavaScript, senza installazioni né build: va bene per GitHub Pages.

---

## Provarla subito (modalità demo)

Finché `js/config.js` non contiene le chiavi di Firebase, l'app funziona in **modalità demo**:

- i dati restano solo nel browser che stai usando (IndexedDB);
- non serve il login.

Apri la pagina, vai su **Guida** e premi **Crea dati di esempio**. Poi fai il tour completo.

> I browser non caricano bene le pagine aperte con doppio clic da `file://`, quindi in locale usa un piccolo server, ad esempio:
> `ruby -run -e httpd . -p 8080` e poi apri http://localhost:8080

---

## Collegare Firebase (gratuito, piano Spark)

1. Vai su https://console.firebase.google.com, premi **Aggiungi progetto** e completa la procedura. Google Analytics non serve.
2. **Authentication** → *Inizia* → *Email/password* → **Attiva**.
   Poi apri la scheda *Utenti* → **Aggiungi utente** e crea l'account di Giulia (email e password).
3. **Firestore Database** → *Crea database* → modalità **produzione**, con una località vicina (ad esempio `us-east1` o `nam5`).
4. Apri **Regole** e incolla il contenuto di `firestore.rules`. Sostituisci `EMAIL_DI_GIULIA` con l'email dell'utente creato al punto 2, poi premi **Pubblica**.
5. Vai in ⚙️ **Impostazioni progetto** → *Le tue app* → icona **</>** (Web) e registra l'app senza Hosting. Copia i valori di `firebaseConfig` dentro `js/config.js`, poi compila `adminEmail` con la stessa email.
6. Quando l'app sarà online, aggiungi il dominio in **Authentication** → *Impostazioni* → **Domini autorizzati**, ad esempio `tuonome.github.io`.

Non serve **Storage**: le foto sono salvate in Firestore come JPEG ridotti (lato lungo 1280 px, circa 150–300 KB l'uno). Con il piano gratuito ci sono 1 GB di spazio e 50.000 letture al giorno, abbastanza per centinaia di gallerie. Quando un progetto è concluso puoi eliminarlo per liberare spazio.

> Le chiavi in `config.js` non sono segrete: con Firebase è normale che siano pubbliche. Quello che protegge i dati sono le **regole** del punto 4. Con quelle regole:
> - solo Giulia, dopo il login, vede i clienti e l'elenco dei progetti;
> - il cliente vede soltanto il progetto del suo link e può scrivere le sue scelte solo mentre la galleria è *Aperta* e non le ha ancora inviate.

---

## Pubblicare su GitHub Pages

1. Crea un repository, ad esempio `giulia-studio`, e carica tutti i file di questa cartella: `index.html`, `css/`, `js/`, `img/`, `firestore.rules`, `README.md`.
2. Vai in **Settings** → **Pages** → *Source: Deploy from a branch* → `main` / `root` → **Save**.
3. Dopo un minuto l'app è online su `https://<utente>.github.io/giulia-studio/`.
   I link per i clienti hanno la forma `https://<utente>.github.io/giulia-studio/#/g/<id-progetto>`.

---

## Struttura

```
index.html          pagina unica
css/style.css       stile (chiaro/scuro automatico)
js/config.js        chiavi Firebase, email di Giulia, contatti mostrati ai clienti
js/util.js          funzioni comuni, assi di stile, traduzioni IT/ES/EN, domande predefinite
js/db.js            dati: IndexedDB (demo) oppure Firestore
js/admin.js         area di Giulia: progetti, editor, scelte, clienti
js/client.js        galleria del cliente
js/guide.js         guida, tour interattivo e dati di esempio
js/main.js          avvio e navigazione
firestore.rules     regole di sicurezza da incollare in Firebase
img/logo.png        logo
```

### Dati in Firestore

| Percorso | Contenuto | Chi può accedere |
|---|---|---|
| `clients/{id}` | nome, contatti, lingua, preferenze di stile (generali e per tema), note, storico | solo Giulia |
| `themes/{id}` | nome e breve descrizione del tema | solo Giulia |
| `notifications/{id}` | avviso "il cliente ha inviato le scelte" | il cliente può solo crearla; la legge Giulia |
| `projects/{id}` | titolo, cliente, lingua, max foto, messaggio, domande, stato | Giulia; il cliente legge solo il suo |
| `projects/{id}/images/{id}` | foto e coppie di stile (base64) | Giulia; il cliente in sola lettura |
| `projects/{id}/response/main` | foto scelte, note, stile, risposte | Giulia; il cliente scrive finché la galleria è aperta |

Le preferenze di stile vanno da **-2** (molto A: calda / vivace / contrastata / luminosa) a **+2** (molto B: fredda / tenue / morbida / scura). Lo **0** significa indifferente.

> **Dopo ogni aggiornamento delle regole** (`firestore.rules`) ricordati di incollarle di nuovo in Firebase › Firestore › Regole e premere **Pubblica**: senza questo passaggio temi e notifiche non vengono salvati.
