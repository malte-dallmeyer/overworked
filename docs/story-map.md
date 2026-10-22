# User Story Map

Feierabend-Wecker, keine Zeiterfassung. Backbone von links nach rechts entlang eines Arbeitstags,
Releases von oben (zuerst) nach unten.

| | **Arbeit beginnen** | **Arbeiten** | **Feierabend erreichen** | **Betreiben** |
|---|---|---|---|---|
| **Walking Skeleton** | Starten mit eingegebener Sollzeit | Endzeit und Restzeit anzeigen | Einmaliger ntfy-Push ans Handy bei Sollzeit | `docker compose up` lokal, `.env.example`, README-Skelett |
| **MVP (R1)** | Sollzeit mit zuletzt genutztem Wert vorbelegt; Startzeit zurückdatieren | Pausieren/Fortsetzen; Restzeit während der Arbeit anpassen; Live-Sync zwischen Geräten; als PWA installierbar | Alarm wiederholt sich bis zur Bestätigung; Bestätigen in der App und direkt aus der Benachrichtigung; einmal Snooze; Session endet automatisch 20 min nach Alarmbeginn ohne Bestätigung; Desktop: Web-Push + Ton im offenen Tab | Login per Passwort; HTTPS; Deployment; README für Selbst-Hoster |
| **R2** | | Vergessene Pause nachtragen | Vorwarnung (Standard 15 min vorher) | Abgeschlossene Sessions automatisch löschen |
| **Später** | Vorlagen/Profile, falls sich der Bedarf zeigt | | Gamification | Echte Nutzerkonten |

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
| Hosting | Google Cloud e2-micro (Always Free, US-Region), Docker Compose | Kostenlos; Ressourcen reichen für Single-User |
| Restzeit anpassen | Ändert die Sollzeit der laufenden Session (Restzeit = Sollzeit − bisher gearbeitet). Wird das Ende dadurch wieder in die Zukunft verschoben, kann der Alarm erneut kommen | Ein Wert genügt, Endzeit und Countdown leiten sich daraus ab |
| Restzeit nach dem Alarm verlängern | Erlaubt, aber nur nach einer deutlichen Warnung, die zum Feierabend auffordert und bestätigt werden muss | Das Werkzeug soll erinnern, nicht bevormunden; die Hürde macht das Weiterarbeiten zur bewussten Entscheidung |
