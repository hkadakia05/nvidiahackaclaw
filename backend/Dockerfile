FROM python:3.12-slim

# Keep Python from writing .pyc files and make logs show up immediately.
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# All commands below run inside /app in the container.
WORKDIR /app

# Install Python dependencies first so Docker can cache this layer.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the FastAPI application code into the image.
COPY app ./app

EXPOSE 8000

# Start the FastAPI app. The host 0.0.0.0 makes it reachable from outside
# the container through the port mapping in docker-compose.yml.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
