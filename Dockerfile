FROM python:3.12-slim AS backend

WORKDIR /app

# Dépendances système
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Installer les dépendances Python (cache layer)
COPY pyproject.toml ./
COPY src/ src/
COPY migrations/ migrations/

RUN pip install --no-cache-dir .

# Répertoire pour la base SQLite
RUN mkdir -p /data
ENV DB_PATH=/data/oria.db

EXPOSE 8000

CMD ["python", "-m", "oria", "web"]
