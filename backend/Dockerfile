# Instructions explicites de construction - evite de laisser Railway deviner
# comment construire le projet (source des echecs "railpack" rencontres).
FROM python:3.12-slim

WORKDIR /app

# Installe d'abord les dependances (mise en cache Docker plus efficace)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie le reste du code backend
COPY . .

# Railway fournit la variable PORT automatiquement - le "sh -c" est necessaire
# pour que $PORT soit bien remplace par sa valeur reelle au demarrage.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
