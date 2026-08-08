FROM python:3.12-slim

WORKDIR /app

# Anny's own dependencies (trimesh, PIL-based segmentation lookups) need
# these system libraries present even though nothing here touches a display.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# Cloud Run injects PORT at runtime and expects the container to listen on
# it - not a fixed port, so this can't be hardcoded to e.g. 8000.
ENV PORT=8080
EXPOSE 8080

CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
