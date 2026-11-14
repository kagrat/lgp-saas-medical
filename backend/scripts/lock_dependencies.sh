#!/bin/sh
# Regenere requirements.txt (production) et requirements-dev.txt a partir des
# fichiers .in, pour Python 3.12 (version du Dockerfile), avec empreintes.
# Prerequis: pip install uv     (a lancer depuis le dossier backend/)
# Par defaut, les versions DEJA verrouillees sont conservees (changement minimal).
# Pour tout mettre a jour vers les dernieres versions compatibles: UPGRADE=1 sh scripts/lock_dependencies.sh
set -eu
uv pip compile requirements.in --python-version 3.12 --universal --generate-hashes \
  --no-header -q ${UPGRADE:+--upgrade} -o requirements.txt
uv pip compile requirements-dev.in --python-version 3.12 --universal --generate-hashes \
  --no-header -q ${UPGRADE:+--upgrade} -o requirements-dev.txt
echo "Verrouillage regenere: requirements.txt et requirements-dev.txt"
