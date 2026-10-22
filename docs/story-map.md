# User Story Map

Feierabend-Wecker, keine Zeiterfassung. Backbone von links nach rechts entlang eines Arbeitstags,
Releases von oben (zuerst) nach unten.

| | **Arbeit beginnen** | **Arbeiten** | **Feierabend erreichen** | **Betreiben** |
|---|---|---|---|---|
| **Walking Skeleton** | Starten mit eingegebener Sollzeit | Endzeit und Restzeit anzeigen | Einmaliger ntfy-Push ans Handy bei Sollzeit | `docker compose up` lokal, `.env.example`, README-Skelett |
| **MVP (R1)** | Sollzeit mit zuletzt genutztem Wert vorbelegt; Startzeit zurückdatieren („Wann hast du angefangen?“ oder „Jetzt“) | Pausieren/Fortsetzen; Pausen mit Start und Ende erfassen: vergessene nachtragen, im Voraus planen, korrigieren, löschen; Restzeit während der Arbeit anpassen; gesetzliche Pausen (ArbZG) in die Endzeit einrechnen; Hinweiszeile Richtung Feierabend („Feierabend in 12 min“); Live-Sync zwischen Geräten; als PWA installierbar | Alarm wiederholt sich bis zur Bestätigung; Bestätigen in der App und direkt aus der Benachrichtigung; einmal Snooze; Session endet automatisch 20 min nach Alarmbeginn ohne Bestätigung; harte Warnung vor der gesetzlichen 10-h-Grenze, auch nach Snooze oder Verlängern; Desktop: Web-Push (Benachrichtigungen per Glocke einschalten) + Ton im offenen Tab | Login per Passwort; HTTPS; Deployment; README für Selbst-Hoster |
| **R2** | | Fortschrittsring mit Markierungen für Feierabend und 10-h-Grenze | Vorwarnung (Standard 15 min vorher) | Abgeschlossene Sessions automatisch löschen |
| **Später** | Vorlagen/Profile, falls sich der Bedarf zeigt | Pausen direkt am Ring ziehen (zusätzlich zum Formular, barrierefrei als Slider) | Gamification | Echte Nutzerkonten |

## Entscheidungen

| Thema | Entscheidung | Begründung |
|---|---|---|
| Profile | Keine. Sollzeit wird beim Start eingegeben, vorbelegt mit dem zuletzt genutzten Wert | Bei zwei bis drei Sollzeiten bringt Profilverwaltung keinen Mehrwert |
| Sync | SSE für den Status, REST für Befehle | Selten Änderungen; der Countdown wird im Client berechnet |
| Alarm Handy | ntfy (Basis-URL konfigurierbar), Backend wiederholt den Alarm bis zur Bestätigung | PWA allein kann nicht penetrant klingeln |
| Alarm Desktop | Web-Push aus der PWA, solange der Browser-Prozess läuft; im offenen Tab zusätzlich ein Ton | Auf dem Arbeitsrechner kann nichts installiert werden |
| Snooze | Einmal pro Session | Mehr wäre eine Hintertür |
| Nicht bestätigt | Session endet automatisch 20 min nach Alarmbeginn | Kein Dauerklingeln bei vergessenem Handy |
| Auslieferung | Ein Container: FastAPI liefert den Frontend-Build aus | Eine Adresse, kein CORS |
| Datenbank | SQLite auf einem Volume | Single-User, einfach selbst zu hosten |
| Zeitpunkte | UTC, vom Server gesetzt | Mitternacht und Uhrabweichungen der Geräte spielen keine Rolle |
| Zugriffsschutz | Login in der App (Passwort aus Umgebungsvariable), Session-Cookie | Instanz ist öffentlich erreichbar; das ist auch der Weg zu Nutzerkonten |
| Hosting | Google Cloud e2-micro (Always Free, US-Region), Docker Compose mit Caddy (HTTPS), Infrastruktur per Terraform, DNS bei Cloudflare (ohne Proxy), Image aus GitHub Actions (GHCR) | Fast kostenlos (IPv4 vermutlich ~3,65 $/Monat); reproduzierbar und dokumentiert für Selbst-Hoster; Cloudflare-Proxy würde SSE puffern |
| Restzeit anpassen | Ändert die Sollzeit der laufenden Session (Restzeit = Sollzeit − bisher gearbeitet). Wird das Ende dadurch wieder in die Zukunft verschoben, kann der Alarm erneut kommen | Ein Wert genügt, Endzeit und Countdown leiten sich daraus ab |
| Restzeit nach dem Alarm verlängern | Erlaubt, aber nur nach einer deutlichen Warnung, die zum Feierabend auffordert und bestätigt werden muss | Das Werkzeug soll erinnern, nicht bevormunden; die Hürde macht das Weiterarbeiten zur bewussten Entscheidung |
| Gesetzliche Pausen | 30 min ab 6 h, 45 min ab 9 h Arbeit (ArbZG §4); eigene und geplante Pausen zählen mit. Immer in die Endzeit eingerechnet und kenntlich gemacht, z. B. „Feierabend um 17:30, inkl. 30 min Pflichtpause“ | Sonst kommt der Alarm, bevor die Pflichtpause gemacht ist; der Zusatz macht transparent, woher die Verschiebung kommt |
| 10-h-Grenze | Eigene Eskalation, unabhängig von Snooze und Verlängern | Gesetzliches Tagesmaximum (ArbZG §3) |
| Pausen erfassen | Eine Aktion für Vergangenheit und Zukunft: Pause mit Start/Ende; spontan weiter per „Pause“/„Weiter“ | Büro: Pause steht vorher fest. Homeoffice: spontan |
| Ton der App | Hinweise drängen Richtung Feierabend, Überstunden werden nicht gelobt | Feierabend-Wecker, keine Gleitzeit-App |
| Vorbild | [fi-go](https://github.com/MrGoro/fi-go) (MIT): Ideen übernommen (ArbZG-Pausen, 10-h-Grenze, Startbildschirm, Pausenliste, Ring), kein Code | Bewährte Lösungen, aber Firebase-gebunden und auf Gleitzeit-Saldo ausgerichtet |
