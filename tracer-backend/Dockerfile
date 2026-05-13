# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM python:3.13-slim AS deps

RUN pip install uv

WORKDIR /app

COPY pyproject.toml uv.lock ./

# Install only production deps into .venv, skip installing the project itself
# (source code is copied in the next stage)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# ── Stage 2: production runtime ───────────────────────────────────────────────
FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

# Least-privilege: run as non-root
RUN addgroup --system app && adduser --system --ingroup app app

WORKDIR /app

# Virtual env from builder (alembic and all deps already included via uv sync)
COPY --from=deps --chown=app:app /app/.venv .venv

# Application source
COPY --chown=app:app . .

# Diretório de uploads (Certifica Minas) — coincide com STORAGE_ROOT
RUN mkdir -p /app/uploads && chown app:app /app/uploads

RUN chmod +x entrypoint.sh

USER app

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
