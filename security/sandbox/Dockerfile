# slim to  minimize attack surface
FROM python:3.11-slim

#no rewrites binary and recompile on each run just a test and saftey measure
ENV PYTHONDONTWRITEBYTECODE=1






# log flushing
ENV PYTHONUNBUFFERED=1


WORKDIR /app


RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# isolated execution for runtime

RUN useradd -ms /bin/bash sandboxuser

# copy code to docker container
COPY . .

RUN pip install --no-cache-dir \
    pyyaml







RUN mkdir -p /app/logs \
    && mkdir -p /app/tmp








RUN chown -R sandboxuser:sandboxuser /app


USER sandboxuser






#safety measure to prevent running as root
CMD ["python", "runner.py"]