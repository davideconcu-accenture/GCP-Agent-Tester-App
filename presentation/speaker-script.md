# VEA · Verifica ETL Agentica — Speaker Script

> **Tempo target**: ~10 minuti totali · ~2-3 minuti per slide · velocità ~150 parole/min.
>
> **Convenzioni**:
> - **▶** = vai avanti / cambia slide
> - **👉** = indica con il puntatore o la mano sul diagramma
> - **⏸** = pausa breve, lascia respirare
> - *In corsivo* = parole da enfatizzare
> - In **grassetto** = punti chiave da non saltare

---

## SLIDE 1 · INTRO ~2 min

### Cosa hai sulla slide
Logo "VEA" in grande, payoff "Verifica ETL Agentica" sotto, lede descrittiva. Quattro card numerate (01-04) in griglia 2x2: Use case, Idea, Implementazione, Limitazione dei dati.

### Discorso

Buongiorno a tutti. Sono **[Davide]** del Team 14, oggi vi presento **VEA — Verifica ETL Agentica**.

Vi racconto il progetto in **quattro punti**.

👉 *Indica card 01 — Use case*

**Primo, lo use case.** Avevamo un caso d'uso preciso: costruire un agente AI capace di **creare casi di test per le pipeline ETL su BigQuery**. È una fase oggi ancora prevalentemente manuale, ripetitiva e a forte rischio di errore.

👉 *Indica card 02 — Idea*

**Secondo, l'idea.** L'approccio scelto è stato dare all'agente **massima autonomia**: non un copilot che assiste lo sviluppatore, ma un sistema che gestisce in autonomia l'intero ciclo — dalla pianificazione dei test all'esecuzione su BigQuery, dall'individuazione dei bug alla proposta della fix come Pull Request. Un solo input dell'utente, workflow end-to-end.

👉 *Indica card 03 — Implementazione*

**Terzo, l'implementazione.** In due parole: una **app agentica**. Concretamente è un'applicazione basata su un Large Language Model — Gemini di Google su Vertex AI — costruita con il framework Google Agent Development Kit, con un parco di tool Python che le permettono di agire su BigQuery e GitHub.

👉 *Indica card 04 — Limitazione dei dati*

**Quarto, la limitazione dei dati.** Non avendo clienti reali a disposizione, abbiamo costruito un **ambiente mock**: dataset BigQuery con dati fittizi, una serie di ETL di esempio, repository GitHub dedicato. È il perimetro di demo del progetto — il sistema è progettato per scalare a casi reali con un cambio di configurazione, non di architettura.

⏸

Nei prossimi minuti vediamo l'**architettura del sistema**, il **flusso operativo dell'agente**, e infine il **dettaglio di come è fatto** internamente.

▶ *passa a slide 2*

---

## SLIDE 2 · INFRASTRUTTURA ~2 min

### Cosa hai sulla slide
Titolo "L'infrastruttura in tre blocchi" + lede, e un grosso diagramma SVG con tre blocchi affiancati: BigQuery a sinistra (blu), Cloud Run al centro (verde), GitHub a destra (arancione). Frecce etichettate che li collegano. Sotto il diagramma, **4 tile numerate (01-04)** in stile slide 1 che descrivono i componenti: BigQuery (data layer), Cloud Run (app agentica), GitHub (codice ETL), Bus eventi (tracciabilità in tempo reale).

### Discorso

Partiamo dall'**architettura**. Il sistema ha un design volutamente semplice: **tre componenti, tre responsabilità ben separate**.

👉 *Indica il blocco a sinistra (BigQuery, blu)*

A sinistra c'è **BigQuery**, il data warehouse dove vivono i dati: tabelle sorgente, di staging e finali, organizzate in dataset, uno per ogni ETL. Il punto importante è che l'agente accede a BigQuery **in sola lettura**, attraverso un service account dedicato con permessi minimi. **Non può cancellare, non può modificare, non può scrivere** — può solo eseguire query SELECT. È il primo guardrail di sicurezza del sistema, definito a livello di IAM e non come convenzione di codice.

👉 *Indica il blocco centrale (Cloud Run, verde)*

Al centro c'è il cuore del sistema, **Cloud Run**, dove gira l'applicazione. Cloud Run è il servizio serverless di Google per i container Docker: noi facciamo il deploy di **frontend e backend**, e Google si occupa del resto — scaling automatico in base al carico, terminazione HTTPS, autenticazione del service account. Da qui partono le chiamate al modello AI, che vive su **Vertex AI** — la piattaforma di Google per l'intelligenza artificiale generativa, dove sono ospitati i modelli Gemini. Tutti gli eventi del run — ogni ragionamento, ogni tool invocato, ogni risultato — vengono persistiti su **Firestore**, così l'utente vede l'esecuzione in diretta e ritrova lo storico in qualunque momento.

👉 *Indica il blocco a destra (GitHub, arancione)*

A destra c'è **GitHub**, dove vive il codice SQL degli ETL — una cartella per ogni pipeline. L'agente lo usa in due modi distinti: **lo legge** quando deve capire come è strutturata una trasformazione, e ci **scrive sopra una Pull Request** quando propone una correzione. L'autenticazione passa per un token salvato su **Secret Manager**, mai presente nel codice o nei log. E come dicevo prima, **il merge della PR è sempre umano**: l'agente apre il branch, scrive il commit, prepara la PR — ma non tocca mai il branch principale.

⏸

👉 *Indica le frecce tra i blocchi*

Le frecce mostrano le interazioni: l'app interroga BigQuery in lettura, legge il SQL da GitHub, propone Pull Request a GitHub. Tre componenti, tre responsabilità, una **separation of concerns netta** che rende il sistema facile da capire, da auditare e da estendere.

⏸

👉 *Scorri verso le 4 tile sotto il diagramma — puoi puntarle solo se hai tempo, altrimenti cita oralmente i 4 takeaway*

I quattro takeaway architetturali, riassunti: **sola lettura su BigQuery**, **cloud-native gestito** senza infrastruttura custom, **tracciabilità end-to-end** degli eventi via Firestore e SSE, e **merge sempre umano** — l'agente apre la PR, ma non tocca il branch principale.

▶ *passa a slide 3*

---

## SLIDE 3 · FUNZIONAMENTO ~2 min

### Cosa hai sulla slide
Diagramma di flusso con 7 step numerati: utente → recupera SQL → check tabelle → piano test → esecuzione → bivio decisionale → report (verde) o investiga + fix + PR (rosso/arancione). In ogni blocco è visibile in monospace il **tool dell'agente** invocato in quella fase (es. `read_sql_code`, `execute_bigquery_query`).

### Discorso

Adesso vediamo **come si comporta l'agente quando riceve una richiesta**. Sul diagramma seguiamo il flusso, che è **lineare con un'unica biforcazione finale**.

👉 *Indica step 1 in alto a sinistra*

**Step 1 — l'utente apre il frontend** e scrive una richiesta in linguaggio naturale, qualcosa come *"verifica l'ETL saldi correnti, i totali non quadrano"*. La richiesta entra nel sistema.

👉 *Indica step 2*

**Step 2 — recupero del codice**: l'agente va su GitHub e legge **tutto il SQL** dell'ETL. Gli serve per capire la struttura della trasformazione: quali tabelle sorgente usa, che join applica, quali aggregazioni produce, quali sono le tabelle target.

👉 *Indica step 3*

**Step 3 — pre-check ambiente**: prima di toccare i dati, l'agente verifica via INFORMATION_SCHEMA che **tutte le tabelle referenziate dal SQL esistano** su BigQuery. Se manca qualcosa, **si ferma subito** e segnala il problema con un report dedicato. Niente test su un ambiente incompleto: sarebbe rumore inutile.

👉 *Indica step 4*

**Step 4 — piano di test**: l'agente stila una lista di test specifici. Non sono test generici predefiniti, sono **calibrati** sulla richiesta e sulla struttura dell'ETL. Le categorie tipiche sono integrità referenziale, presenza di duplicati, conteggi attesi, range di valori, riconciliazione tra staging e finale, regole di business.

👉 *Indica step 5*

**Step 5 — esecuzione**: l'agente esegue i test **uno per uno** su BigQuery. Ogni test è una query di verifica, sempre in sola lettura. L'agente raccoglie tutti gli esiti.

👉 *Indica il rombo decisionale*

**Bivio decisionale — tutti i test sono passati?**

👉 *Segui la freccia "SÌ" verso il box verde*

**Se tutti passano**, l'agente chiude il run con un **report finale** che certifica l'assenza di anomalie. È il caso più semplice e anche il più frequente.

👉 *Segui la freccia "NO" verso il box rosso e poi il box arancione*

**Se almeno un test fallisce**, l'agente entra in fase di investigazione: analizza l'esito anomalo, lancia eventuali query aggiuntive di approfondimento, identifica la riga del SQL che produce il bug, **formula la correzione** e — punto importante — la **valida sui dati reali** prima di proporla, eseguendo una query diagnostica che simula il comportamento post-fix. Solo a quel punto la correzione diventa un commit su un nuovo branch e l'agente apre la **Pull Request**.

⏸

Da quel momento la palla passa allo sviluppatore: review della PR, eventuali aggiustamenti, merge.

Tutto il flusso è **tracciato in tempo reale** sul frontend, e ogni fix viene **validata sui dati reali** prima ancora di arrivare in revisione umana.

▶ *passa a slide 4*

---

## SLIDE 4 · DETTAGLIO ~2.5 - 3 min

### Cosa hai sulla slide
La slide è strutturata in 4 parti chiare:
- **Parte 1** · I tre ingredienti dell'agente (3 card: Cervello / Manuale / Mani)
- **Parte 2** · Il loop ReAct (diagramma + esempio passo-passo)
- **Parte 3** · Architettura completa (diagramma generale del sistema)
- **Parte 4** · Scelte chiave (4 bullet)
- In fondo: tile di approfondimento per Q&A.

### Discorso

Arriviamo alla parte tecnica. La spiego con parole semplici: l'obiettivo non è entrare nel codice, ma darvi gli **strumenti per ragionare sul sistema** e per fare domande puntuali se vi interessa approfondire.

#### Parte 1 — Cos'è l'agente

👉 *Scorri verso le 3 card*

Quando si parla di "agente AI" il termine resta vago. Concretamente, il nostro agente è la combinazione di **tre componenti distinti**, ciascuno sostituibile in modo indipendente.

👉 *Indica la prima card*

**Primo: il cervello.** È un **modello Gemini** ospitato su Vertex AI — un Large Language Model di Google. È la parte che ragiona: legge la richiesta, decide cosa fare, formula la risposta finale. Noi usiamo Gemini 2.5 Pro come default, perché è il modello più accurato sul ragionamento SQL; in alternativa Gemini 2.5 Flash, più rapido e meno costoso, scelto dall'utente al momento della richiesta in funzione della complessità del task.

👉 *Indica la seconda card*

**Secondo: il manuale.** È il **system prompt**, scritto in italiano. Sono le istruzioni operative che diamo al modello — pensatelo come una procedura aziendale scritta nero su bianco. Definisce le **6 fasi del workflow** — quelle che vi ho appena descritto — e **7 regole critiche** di sicurezza. Per esempio: niente DDL su BigQuery, sempre validazione su dati reali prima di proporre una fix, mai cambiare il dataset di una tabella nel SQL.

👉 *Indica la terza card*

**Terzo: le mani.** Sono **otto funzioni Python** che il modello può invocare per agire sul mondo. Senza queste funzioni il modello soltanto produce testo; con queste può fare cose: leggere SQL da GitHub, eseguire query su BigQuery, emettere il piano di test, registrare i risultati, formulare la fix proposta, aprire la Pull Request, salvare il report finale, elencare gli ETL disponibili.

⏸

#### Parte 2 — Come ragiona

👉 *Scorri verso il diagramma del loop ReAct (4 box: PENSA → AGISCE → OSSERVA → FINE)*

Il modo in cui l'agente lavora si chiama **loop ReAct** — Reasoning + Acting, ragionare e agire. È il pattern standard del settore per gli agenti basati su LLM, e nasce da un paper accademico del 2022 di Princeton e Google Brain.

L'idea di fondo è semplice: **l'agente non risponde in un colpo solo, ma a piccoli passi**. A ogni iterazione fa tre cose, sempre nello stesso ordine.

👉 *Indica box 1 "PENSA"*

**Pensa**: ragiona a voce alta su cosa fare adesso. Una o due frasi di ragionamento esplicito.

👉 *Indica box 2 "AGISCE"*

**Agisce**: chiama uno dei suoi otto strumenti, con i parametri che ritiene corretti.

👉 *Indica box 3 "OSSERVA"*

**Osserva**: legge il valore di ritorno del tool e lo integra nel proprio contesto.

👉 *Indica la freccia di ricircolo "se non ha finito, riparte"*

Poi **ripete** il ciclo. Ogni nuovo "pensa" tiene conto di tutto quello che è accaduto prima. Continua finché non ha tutte le informazioni necessarie per chiudere il workflow con il report finale o con la Pull Request.

👉 *Scorri verso l'esempio concreto sotto*

L'esempio in basso mostra come si comporta nella pratica su una richiesta tipica: legge il SQL, verifica le tabelle, pianifica i test, li esegue, e procede di conseguenza. È **lo stesso pattern di ragionamento di uno sviluppatore umano** che si trova davanti allo stesso problema.

Il vantaggio architetturale di questo schema è che **ogni passo è esplicito e tracciato**: vediamo cosa il modello sta pensando, cosa sta facendo, cosa ha ottenuto. Non c'è opacità, non c'è ambiguità, e il debug di eventuali comportamenti anomali è gestibile.

⏸

#### Parte 3 — Architettura completa

👉 *Scorri verso il diagramma grande*

A questo punto il quadro completo. L'agente è qui al centro, dentro Vertex AI, gestito dal runtime di Google ADK. Il backend FastAPI lo orchestra, espone le API verso il frontend e mantiene il bus eventi. Il frontend Next.js mostra in tempo reale ogni passo via Server-Sent Events. BigQuery è la sorgente dei dati; GitHub è il repository del codice. Sono le stesse interazioni della slide 2, viste dall'interno del container.

#### Parte 4 — Scelte chiave

👉 *Scorri verso i 4 bullet*

Concludo con quattro decisioni progettuali che voglio sottolineare.

**Singolo agente, non multi-agente**: un solo loop ReAct con accesso diretto a tutti gli otto tool. In un workflow lineare e ben definito come il nostro, un'architettura multi-agente avrebbe aggiunto complessità senza beneficio. Single-agent significa meno parti mobili, meno punti di fallimento, e una tracciabilità più semplice.

**Modello configurabile**: Pro per accuratezza, Flash per velocità. La scelta passa dall'utente al momento della richiesta. Non c'è dipendenza forte dal modello specifico.

**Limite di 40 iterazioni del loop ReAct**: è un safety net contro eventuali loop infiniti. Nei run reali il numero di iterazioni si attesta tra 15 e 25.

**Cancellazione cooperativa**: l'utente può interrompere il run in qualsiasi momento dal frontend. Il task asincrono riceve il segnale di cancellazione e termina pulitamente, salvando lo stato parziale.

⏸

Grazie. Sono a disposizione per le domande.

---

## DOMANDE PROBABILI · CHEAT SHEET

> Tienile a mente o stampatele a parte. Risposte in 1-2 frasi.

**"Quanto costa?"**
Il costo è dominato dalle chiamate a Gemini su Vertex AI. Cloud Run, Firestore e BigQuery sono trascurabili al volume attuale. Ordine di grandezza: pochi centesimi per run con Pro, frazione di centesimo con Flash.

**"E se l'agente sbaglia la fix?"**
Tre livelli di protezione. La fix viene validata sui dati prima ancora di essere proposta. La Pull Request è sempre revisionata da uno sviluppatore. Il merge è sempre umano. L'agente propone, non applica.

**"Perché non multi-agente?"**
Workflow lineare e ben definito. Un singolo loop ReAct con tutti i tool è più robusto e tracciabile di sub-agenti che si coordinano. Aggiungere agenti significa aggiungere punti di fallimento senza beneficio reale per il nostro caso d'uso.

**"È sicuro dare a un LLM accesso a BigQuery?"**
Service account dedicato con permessi di sola lettura, niente DDL, niente DML, query loggate. Il blast radius massimo di un comportamento anomalo è una query SELECT lenta.

**"Cos'è il loop ReAct?"**
ReAct = Reasoning + Acting. Pattern in cui l'agente alterna ragionamento e azioni: pensa cosa serve, chiama un tool, legge il risultato, ripete fino a chiudere il workflow. È lo standard per gli agenti AI moderni e nasce da un paper Princeton-Google del 2022.

**"Cos'è il system prompt? È hardcoded?"**
È un testo in italiano che definisce le 6 fasi del workflow e le 7 regole di sicurezza. Vive nel codice del backend, modificabile senza riaddestrare il modello — basta un nuovo deploy.

**"Funziona anche con altri modelli, non solo Gemini?"**
Sì. L'integrazione passa da Vertex AI con `LlmAgent` di Google ADK; il modello è una stringa di configurazione. Possiamo passare a Gemini Flash con uno switch dal frontend; con piccoli adattamenti possiamo integrare altri modelli supportati da Vertex AI.

**"Quanto ci mette in media a fare un'analisi?"**
Tipicamente 1-3 minuti con Gemini Pro. ETL complessi o batterie di test ampie possono arrivare a 5-7 minuti.

**"L'agente può inventarsi le risposte?"**
Le regole nel system prompt vietano esplicitamente di inferire dati: l'agente può valutare *solo* quello che torna dai tool. Se non ha evidenza, è obbligato a dirlo nel report.

**"Lo posso usare su qualunque ETL?"**
Sì, a condizione che il SQL sia versionato nel repository GitHub configurato e che le tabelle referenziate esistano su BigQuery. Non serve modificare l'ETL stesso.

**"Come distingue un bug del codice da un problema di ambiente?"**
È esattamente lo scopo del pre-check di Fase 2. Se le tabelle non esistono, l'agente segnala un problema di ambiente e si ferma — non propone fix. Se le tabelle ci sono ma un test fallisce, è un bug di logica e procede con la fase di investigazione.

---

## DELIVERY · CONSIGLI PRATICI

- **Pause naturali** dopo ogni "Primo / Secondo / Terzo / Quarto" e dopo ogni step numerato.
- **Indica il diagramma con la mano** (non solo con il cursore): aiuta l'audience a seguire e a te a non andare troppo veloce.
- **Se ti perdi**, torna alla frase di apertura della slide: ogni slide ha una frase-tesi all'inizio. Da lì puoi ripartire.
- **Sulla slide 4**, se l'audience è tecnica o ti chiedono dettagli, apri una sotto-pagina dalla griglia "approfondimenti" in fondo. Sono pensate per il Q&A.
- **Tono**: professionale e misurato. Le metafore "cervello / manuale / mani" e "ragiona come uno sviluppatore" funzionano bene con audience miste — usale ma senza farne uno slogan.
- **Velocità**: leggermente più lenta di una conversazione normale. Le pause valgono parole.
