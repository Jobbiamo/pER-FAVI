# Agenda Sociale

Agenda personale per assistenti sociali: appuntamenti, scadenze, **UVM**, casi (solo iniziali/codici), rubrica della rete, chilometri e crediti formativi.

- 📱 Web app installabile su Android (e iPhone), funziona anche **senza internet**
- 🔒 Dati **cifrati (AES-256)** con PIN e salvati **solo sul telefono** — nessun server, nessun cloud
- 📅 Promemoria tramite Google Calendar (un tocco su "📅 Calendario")
- 💾 Backup cifrato da salvare dove vuoi

## Installazione su Android
1. Apri il link dell'app con **Chrome**.
2. Tocca **⋮** (in alto a destra) → **Installa app** (o "Aggiungi a schermata Home").
3. Compare l'icona **Agenda Sociale**: da lì si apre a schermo intero, come un'app normale.

## Aggiornamenti
Si aggiornano da soli: basta aprire l'app con internet attivo (i dati restano).

## Privacy
Usare solo iniziali o codici, mai nomi completi, diagnosi o indirizzi. La documentazione ufficiale resta nella cartella sociale del servizio.

## Struttura
Nessuna dipendenza, nessun build: HTML + CSS + JavaScript.
- `js/store.js` – archivio cifrato (IndexedDB + WebCrypto)
- `js/model.js` – liste, checklist, scadenze tipiche, dati di esempio
- `js/forms.js` – moduli di inserimento
- `js/views/*` – pagine (Oggi, Agenda, Casi, UVM, Altro)
- `sw.js` – funzionamento offline
