FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir ".[postgres,llm]"
RUN useradd --create-home app && mkdir -p /app/data && chown app /app/data
USER app
EXPOSE 8000
HEALTHCHECK CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')"
CMD ["sh", "-c", "[ \"${MAHN_ERP:-demo}\" != demo ] || [ -f \"$MAHN_DEMO_ERP_FILE\" ] || mahn-agent seed; mahn-agent serve --host 0.0.0.0 --port 8000"]
