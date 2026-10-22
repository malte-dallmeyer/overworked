# Shared helpers, sourced by the scripts in scripts/.
# No `set -u`: macOS ships bash 3.2, where expanding an empty array trips it.
set -eo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Prints the calling script's header comment (everything after the shebang up to
# the first blank line). That header is the script's documentation.
usage() {
  sed -n '2,/^$/{/^#/!d;s/^# \{0,1\}//;p}' "$0"
}

fail_usage() {
  echo "Fehler: $1" >&2
  echo >&2
  usage >&2
  exit 2
}
