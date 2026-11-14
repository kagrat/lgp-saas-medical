# ============================================================================
# Image de production du backend SpeedSante+ (Railway)
# ============================================================================
# Durcissement:
#   - dependances installees depuis requirements.txt VERROUILLE, avec verification
#     des empreintes (--require-hashes): un paquet modifie ou une nouvelle version
#     imprevue est refuse, la construction echoue au lieu de casser en production;
#   - le serveur s'execute avec un utilisateur SANS privilege (pas root);
#   - aucun fichier de developpement dans l'image (voir .dockerignore);
#   - arret propre: "exec" fait recevoir le signal d'arret directement a uvicorn.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependances d'abord (meilleure mise en cache des couches Docker)
COPY requirements.txt .
RUN pip install --require-hashes -r requirements.txt

# Utilisateur sans privilege pour executer l'application
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin app

COPY --chown=app:app . .
USER app

# Railway fournit PORT. /health/live ne depend ni de la base ni du reseau:
# il repond tant que le processus fonctionne (utile pour les hebergeurs qui
# lisent le HEALTHCHECK Docker; Railway utilise son propre reglage de chemin).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD python -c "import os,sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:%s/health/live' % os.environ.get('PORT','8000'), timeout=4).status == 200 else 1)"

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --no-server-header"]
