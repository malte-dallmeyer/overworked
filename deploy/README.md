# Deployment

Overworked läuft auf einer einzelnen VM: Caddy kümmert sich um HTTPS (Let's Encrypt) und leitet
an die App weiter, beides per Docker Compose. Die Vorlage hier nutzt eine **Google Cloud e2-micro**
(Free Tier) und **Cloudflare** für DNS. Jeder andere Server mit Docker und eine Domain tun es aber
genauso: Dann entfällt Schritt 2, und du legst den DNS-Eintrag von Hand an.

| Datei | Zweck |
|---|---|
| `terraform/` | VM, feste IP, Firewall (80/443), DNS-Eintrag |
| `compose.yml`, `Caddyfile` | Was auf dem Server läuft |
| `.env.example` | Vorlage für die Server-Konfiguration (`.env`, nicht im Repo) |
| `../scripts/deploy.mjs` | Kopiert die Dateien auf den Server und startet die neueste Version |
| `../.github/workflows/ci.yml` | Testet jeden Push; baut auf `main` das Image `ghcr.io/<user>/overworked` |

## Voraussetzungen

- Das Repo auf GitHub. Jeder Push auf `main` mit grünen Tests erzeugt ein neues Image.
- Ein Google-Cloud-Projekt mit aktivierter Abrechnung (auch für das Free Tier nötig).
- Lokal: [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.6 (oder OpenTofu),
  die [gcloud CLI](https://cloud.google.com/sdk/docs/install) (nur zum Anmelden) und ein
  SSH-Schlüssel (`ssh-keygen -t ed25519`).
- Eine Domain, deren DNS bei Cloudflare liegt.

**Kosten:** Die e2-micro (in `us-west1`, `us-central1` oder `us-east1`) und 30 GB Disk sind im
Free Tier. Die externe IPv4-Adresse kostet bei Google aber voraussichtlich extra, etwa 0,005 $
pro Stunde, also rund 3,65 $ im Monat. Lege in der Cloud Console unter *Abrechnung → Budgets*
einen Budget-Alarm an (z. B. 5 $).

## 1. Image veröffentlichen

Nach dem ersten Push auf `main` baut GitHub Actions das Image. Damit der Server es ohne
Anmeldung laden kann, stellst du das Paket auf öffentlich: GitHub → dein Profil → *Packages* →
`overworked` → *Package settings* → *Change visibility* → *Public*.

Soll das Paket privat bleiben, meldest du dich stattdessen einmalig auf dem Server an
(`docker login ghcr.io`, mit einem Token mit dem Recht `read:packages`).

## 2. Infrastruktur anlegen

Ein Cloudflare-API-Token anlegen: *My Profile → API Tokens → Create Token → Edit zone DNS*,
unter *Zonenressourcen* beschränkt auf deine Zone, mit Ablaufdatum (z. B. 90 Tage). Die
Zone-ID steht in Cloudflare auf der Übersichtsseite der Domain. Das Token gehört in
`terraform.tfvars` (bleibt lokal) und **nicht** in `deploy/.env`: Die landet auf dem Server, der
das Token nicht braucht.

Terraform speichert seinen State (welche Ressourcen es angelegt hat) in einem Bucket in deinem
Projekt. So sieht jeder deiner Rechner denselben Stand, und dank Versionierung lassen sich
ältere Stände wiederherstellen. Der Bucket wird einmalig vorab angelegt und ist im Free Tier:

```sh
gcloud auth login
gcloud auth application-default login
gcloud config set project <projekt-id>
gcloud services enable storage.googleapis.com
gcloud storage buckets create gs://<projekt-id>-tfstate --location=us-central1 --uniform-bucket-level-access
gcloud storage buckets update gs://<projekt-id>-tfstate --versioning
```

Dann die Infrastruktur:

```sh
cd deploy/terraform
cp backend.hcl.example backend.hcl             # Bucket-Namen eintragen
cp terraform.tfvars.example terraform.tfvars   # ausfüllen, inkl. Cloudflare-Token
terraform init -backend-config=backend.hcl
terraform apply
```

Auf einem weiteren Rechner genügen `backend.hcl`, `terraform.tfvars` und
`terraform init -backend-config=backend.hcl`.

Beim ersten Start installiert die VM Docker. Das dauert ein bis zwei Minuten.

## 3. Konfigurieren und starten

```sh
cp deploy/.env.example deploy/.env             # ausfüllen: Image, Domain, Passwort, Secret Key, ntfy-Topic
node scripts/deploy.mjs "$(terraform -chdir=deploy/terraform output -raw ssh)"
```

Caddy holt beim ersten Aufruf der Domain das Zertifikat. Danach läuft die App unter
`https://<deine Domain>`.

## 4. Geräte einrichten

- **Handy (Android):** Die [ntfy-App](https://ntfy.sh) installieren und das Topic aus
  `OVERWORKED_NTFY_TOPIC` abonnieren. Dann die Domain in Chrome öffnen, anmelden und über
  *Zum Startbildschirm hinzufügen* als App installieren.
- **Desktop:** Die Domain im Browser öffnen und anmelden. In Chrome oder Edge lässt sie sich
  über das Installieren-Symbol in der Adressleiste installieren, in Safari über *Zum Dock
  hinzufügen*.

## Updates

Push auf `main` und warten, bis die CI grün ist. Dann:

```sh
node scripts/deploy.mjs "$(terraform -chdir=deploy/terraform output -raw ssh)"
```

Das Skript kopiert auch geänderte Dateien wie `compose.yml`, `Caddyfile` und `.env` neu auf den
Server.

## Daten

Die SQLite-Datenbank liegt auf dem Server im Docker-Volume `overworked_data`. Sie enthält nur
die laufende Session, denn Overworked führt keine Historie. Ein Backup ist deshalb nicht nötig.
