FROM python:3.12-slim

RUN pip install --no-cache-dir httpx==0.28.1

WORKDIR /app

# ai_engine 빌드 컨텍스트에서 DAST executor 코드만 복사
COPY agent/nodes/dast/ agent/nodes/dast/
COPY agent/__init__.py agent/__init__.py
COPY agent/nodes/__init__.py agent/nodes/__init__.py

RUN useradd -m -u 1001 runner
USER runner
