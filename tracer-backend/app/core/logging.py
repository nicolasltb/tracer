import logging
import sys

from app.config import settings


def setup_logging() -> None:
    """Configura o logger raiz da aplicação."""
    level = logging.DEBUG if settings.APP_ENV == "development" else logging.INFO

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    sa_logger = logging.getLogger("sqlalchemy.engine")
    sa_logger.setLevel(logging.WARNING)
    sa_logger.handlers.clear()
    sa_logger.propagate = True

    logging.getLogger("httpx").setLevel(logging.WARNING)
