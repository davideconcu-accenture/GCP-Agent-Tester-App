# ETL Agent Tester — Speaker Script

> Tempo target: ~10 minuti totali · ~2 minuti per slide · velocità di parlato ~150 parole/minuto.
> Frasi brevi, transizioni esplicite, terminologia precisa ma accessibile.

---

## SLIDE 1 · INTRO (~2 minuti)

Buongiorno a tutti. Sono **[Davide]** del Team 14 e oggi vi presento **ETL Agent Tester**, il progetto su cui abbiamo lavorato in questi mesi.

Parto da un problema che molti di voi conoscono. Le pipeline ETL su BigQuery sono il cuore della parte dati: caricano, trasformano, riconciliano milioni di record ogni giorno. Quando qualcosa non torna — un saldo che non quadra, un duplicato che compare, un valore nullo dove non dovrebbe esserci — qualcuno deve andare a leggere il codice SQL, capire dov'è l'errore, scrivere una correzione, testarla. È un lavoro **lungo, ripetitivo e ad alto rischio di errore**, perché spesso si interviene sotto pressione.

ETL Agent Tester nasce per coprire esattamente questa parte del ciclo. È un **agente autonomo** — vuol dire un'applicazione basata su un modello linguistico — che fa quattro cose in sequenza, da sola.

**Primo**: pianifica una batteria di test di qualità, calibrata sul tipo di anomalia segnalata.
**Secondo**: esegue i test direttamente su BigQuery, e legge i risultati.
**Terzo**: se un test fallisce, va a vedere il codice SQL, capisce qual è il bug e lo corregge.
**Quarto**: apre una Pull Request su GitHub con la fix proposta.

Ci tengo a sottolineare quattro caratteristiche che ne definiscono il perimetro.

L'**autonomia**: parte da un singolo input dell'utente — "controlla questo ETL" — e arriva fino al report o alla Pull Request senza altre interazioni.

La **tracciabilità**: ogni passo è loggato e visibile in tempo reale, niente scatola nera.

L'**integrazione cloud-native**: gira interamente su Google Cloud — Vertex AI, BigQuery, Cloud Run — più GitHub.

E soprattutto, è **human-in-the-loop**: la fix viene **proposta**, non applicata. Il merge è sempre umano. L'agente prepara il lavoro, la decisione finale resta a noi.

Nei prossimi minuti vi mostro l'**architettura**, poi il **flusso operativo**, e infine entriamo un po' più nel dettaglio dell'agente vero e proprio.

---

## SLIDE 2 · INFRASTRUTTURA (~2 minuti)

Passiamo all'**architettura**. Il sistema è volutamente semplice: **tre componenti, tre responsabilità** ben separate.

A sinistra abbiamo **BigQuery**, il data warehouse dove vivono tutti i dati: tabelle sorgente, di staging e finali, organizzate in dataset, uno per ogni ETL. Il punto importante è che l'agente accede a BigQuery **in sola lettura**, attraverso un service account dedicato, con permessi minimi. Questo significa che non può cancellare, non può modificare, non può scrivere — può solo eseguire query SELECT. È il primo guardrail di sicurezza.

Al centro c'è il cuore del sistema, **Cloud Run**, dove gira l'applicazione vera e propria. Cloud Run è il servizio serverless di Google per i container Docker: noi facciamo il deploy di due container — frontend e backend — e Google si occupa di tutto il resto: scaling automatico in base al carico, HTTPS gestito, autenticazione. Da qui partono le chiamate al modello linguistico ospitato su **Vertex AI** — è la piattaforma di Google per l'IA generativa, dove vivono i modelli Gemini. Gli eventi del run — ogni ragionamento dell'agente, ogni tool che invoca, ogni risultato che ottiene — vengono persistiti su **Firestore**, così l'utente può seguire l'esecuzione in diretta e ritrovare lo storico in qualunque momento.

A destra c'è **GitHub**, dove vive il codice SQL degli ETL. Una cartella per ogni pipeline. L'agente lo usa in due modi: lo **legge** quando deve capire come è fatta una trasformazione, e ci **scrive sopra una Pull Request** quando propone una correzione. L'autenticazione passa per un token salvato su **Secret Manager**, mai hardcoded da nessuna parte. E come dicevo prima, **il merge della PR è sempre umano**: l'agente non scrive mai direttamente sul branch principale.

Le frecce nel diagramma rappresentano queste interazioni. L'app legge da GitHub, interroga BigQuery, e crea PR. Tutto qui.

Tre componenti, tre responsabilità, e una **separation of concerns** netta che rende il sistema facile da capire, da auditare e da estendere.

---

## SLIDE 3 · FUNZIONAMENTO (~2 minuti)

Adesso vediamo **come si comporta l'agente quando riceve una richiesta**. Sul diagramma seguiamo il flusso, che è lineare con un'unica biforcazione finale.

**Punto di partenza**: l'utente apre il frontend e scrive una richiesta in linguaggio naturale, qualcosa tipo "verifica l'ETL saldi correnti, i totali non quadrano". Quella stringa entra nel sistema.

**Step 2**: l'agente va su GitHub e **recupera il codice SQL** dell'ETL indicato. Lo legge per capire come è strutturata la trasformazione: quali tabelle usa, che join fa, che aggregazioni applica.

**Step 3**: prima di toccare i dati, fa un **controllo di esistenza** su BigQuery. Verifica via INFORMATION_SCHEMA che tutte le tabelle che il SQL referenzia esistano davvero. Se manca qualcosa, si ferma subito e segnala il problema, senza far partire test inutili.

**Step 4**: a questo punto l'agente **stila un piano di test**. Non sono test generici, sono **calibrati** sulla richiesta dell'utente e sulla struttura dell'ETL. Per esempio: integrità referenziale, presenza di duplicati, conteggi attesi, range di valori, riconciliazione tra staging e finale.

**Step 5**: **esegue i test uno per uno** su BigQuery, sempre in lettura. Ogni test è una query SQL di verifica. L'agente raccoglie tutti gli esiti.

**Step 6**: bivio decisionale. **Se tutti i test passano**, l'agente chiude il run con un **report finale**: tutto a posto, nessuna anomalia. È il caso più semplice e anche quello più frequente.

**Se invece almeno un test fallisce**, scatta la fase di **investigazione**: l'agente analizza l'esito anomalo, può lanciare query aggiuntive di approfondimento per isolare la causa, e quando ha capito dov'è il bug nel SQL, **propone una correzione**.

**Step 7**: la correzione diventa un commit su un nuovo branch, e l'agente apre la **Pull Request** su GitHub. Da quel momento la palla passa allo sviluppatore: review, eventuali aggiustamenti, merge.

Tutto il flusso è **tracciato in tempo reale** sul frontend, e ogni fix viene **validata sui dati reali** prima ancora di arrivare a noi.

---

## SLIDE 4 · DETTAGLIO TECNICO — L'agente (~2 minuti e 30)

Arriviamo alla parte più tecnica. Questa pagina è un **diagramma cliccabile** che permette di esplorare ciascun componente; io vi racconto i due o tre concetti chiave per capire **cos'è davvero l'agente**, perché spesso "agente IA" è un termine vago.

Il nostro agente è un **singolo `LlmAgent`** costruito sull'**Agent Development Kit di Google**, l'ADK. È una libreria che Google ha rilasciato per costruire agenti basati su LLM, con un'integrazione nativa con Vertex AI. È il framework ufficiale, quindi siamo allineati allo standard del cloud provider.

**L'agente è composto da tre ingredienti**, e questa è la parte importante da tenere a mente.

**Primo ingrediente: il modello.** È il "cervello" che ragiona. Noi usiamo **Gemini 2.5 Pro** di default, perché è il più accurato sul SQL, e in alternativa Gemini 2.5 Flash, più veloce e meno costoso, scelto dall'utente al momento della richiesta. Gira su Vertex AI; il backend fa solo da orchestratore.

**Secondo ingrediente: il system prompt.** Sono le **istruzioni operative** che diamo al modello — pensatela come una procedura aziendale scritta nero su bianco. Il nostro prompt è strutturato in **sei fasi** — la sequenza che vi ho appena raccontato — e **sette regole critiche**, per esempio: niente DDL su BigQuery, sempre validazione su dati reali, mai aprire una PR senza aver prima verificato la correzione.

**Terzo ingrediente: i tool.** Sono **otto funzioni Python** registrate come `FunctionTool` nell'ADK. Sono le "mani" dell'agente — il modo in cui agisce sul mondo. Le elenco velocemente: leggere il SQL da GitHub, eseguire una query su BigQuery, emettere il piano di test, riportare i risultati, formulare la fix proposta, creare la Pull Request, salvare il report finale, ed elencare gli ETL disponibili.

Il funzionamento interno è il classico **loop ReAct**: il modello **pensa** quale tool serve, **agisce** chiamandolo, **osserva** il risultato, e ripete fino a quando il workflow è completo. Massimo quaranta iterazioni per evitare loop infiniti.

Una scelta architetturale che voglio sottolineare: abbiamo deliberatamente scelto **un singolo agente**, non un'architettura multi-agente. Il motivo è semplice: il workflow è **lineare e ben definito**, e un singolo loop ReAct con tutti gli otto tool a disposizione è più **robusto**, più **tracciabile** e più **facile da debuggare**. Aggiungere sub-agenti significa moltiplicare le parti mobili senza un beneficio reale.

In sintesi: un cervello — il modello Gemini —, un manuale — il system prompt —, e otto strumenti — i tool. Questo è l'agente.

Grazie. Sono a disposizione per le domande.

---

## NOTE DI DELIVERY

- **Pause naturali** dopo ogni "Primo / Secondo / Terzo" e dopo ogni step numerato del flusso.
- **Indicare con la mano** i tre blocchi del diagramma sulla slide 2 mentre li nomini (BigQuery → Cloud Run → GitHub).
- **Sulla slide 4**, se qualcuno ti chiede dettagli su un sotto-componente (frontend, backend, tool, prompt, GitHub), il diagramma è cliccabile: apri la sotto-pagina e usa quella come supporto.
- **Domande tipiche** che potrebbero arrivare:
  - *"Quanto costa?"* → costo dominato dalle chiamate a Gemini su Vertex AI; Cloud Run e Firestore sono trascurabili al volume attuale.
  - *"E se l'agente sbaglia la fix?"* → la PR è sempre revisionata da un umano prima del merge, ed è validata sui dati prima ancora di essere proposta.
  - *"Perché non multi-agente?"* → semplicità, robustezza, tracciabilità (vedi slide 4).
  - *"È sicuro dare a un LLM accesso a BigQuery?"* → service account read-only, niente DDL, niente DML, query loggate.
