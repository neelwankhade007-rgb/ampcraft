FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TORCH_HOME=/app/.cache/torch

WORKDIR /app

# Core system dependencies for audio decoding, processing, and container healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications and install PyTorch CPU + requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Create runtime directories for uploads, stems, backings, temporary conversions, and PyTorch model cache
RUN mkdir -p uploads stems backings temp_conversions .cache/torch

# Copy backend application source code
COPY . .

EXPOSE 8000

# Health check to monitor backend readiness
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8000/docs || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
