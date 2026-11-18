/*
 * Configurazione dell'app.
 *
 * Finché i campi di "firebase" sono vuoti l'app funziona in MODALITÀ DEMO:
 * i dati restano solo in questo browser (IndexedDB) e non serve il login.
 *
 * Per andare online:
 * 1. crea un progetto gratuito su https://console.firebase.google.com
 * 2. aggiungi una "Web app" e incolla qui sotto i valori di firebaseConfig
 * 3. scrivi in adminEmail l'email con cui Giulia farà il login
 *    (la stessa va messa nel file firestore.rules)
 * Tutti i passaggi sono spiegati nel README.md
 */
window.GB_CONFIG = {
  firebase: {
    apiKey: "AIzaSyBHAbpVCMcbYth751d2UYg1N2S-fbKkuQ0",
    authDomain: "gestione-foto-clienti.firebaseapp.com",
    projectId: "gestione-foto-clienti",
    storageBucket: "gestione-foto-clienti.firebasestorage.app",
    messagingSenderId: "823228039928",
    appId: "1:823228039928:web:8ad008118dded53380710d"
  },
  adminEmail: "giuliabarani71@gmail.com",
  studioName: "Giulia Barani Photography",
  // Contatti mostrati ai clienti nella galleria (facoltativi)
  contact: {
    whatsapp: "",   // es. "18095551234" (solo numeri, con prefisso internazionale)
    email: "",
    instagram: ""   // es. "giuliabarani.photo"
  }
};
