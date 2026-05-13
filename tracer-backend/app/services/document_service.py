"""
Serviço de upload e leitura de documentos.

Valida MIME declarado, magic bytes, tamanho máximo, calcula SHA-256 e
persiste o arquivo no filesystem em STORAGE_ROOT, com layout estruturado
por contexto (propriedade / auditoria).
"""

import hashlib
import logging
import uuid as uuid_pkg
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.document import Document, DocumentType
from app.models.user import User

logger = logging.getLogger(__name__)

# Mapeamento MIME → (extensão, magic bytes esperados)
_MIME_RULES: dict[str, tuple[str, list[bytes]]] = {
    "image/jpeg": (".jpg", [b"\xff\xd8\xff"]),
    "image/png": (".png", [b"\x89PNG\r\n\x1a\n"]),
    "application/pdf": (".pdf", [b"%PDF-"]),
}


def _validate_mime(mime: str) -> tuple[str, list[bytes]]:
    if mime not in settings.ALLOWED_UPLOAD_MIME or mime not in _MIME_RULES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Tipo de arquivo não permitido: {mime}. Aceitos: JPG, PNG, PDF.",
        )
    return _MIME_RULES[mime]


def _check_magic_bytes(content: bytes, expected_prefixes: list[bytes]) -> None:
    if not any(content.startswith(p) for p in expected_prefixes):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conteúdo do arquivo não corresponde ao tipo declarado.",
        )


def _build_storage_path(
    doc_type: DocumentType,
    property_id: uuid_pkg.UUID | None,
    audit_id: uuid_pkg.UUID | None,
    file_uuid: uuid_pkg.UUID,
    extension: str,
) -> Path:
    """Define o subpath relativo ao STORAGE_ROOT conforme o contexto."""
    if audit_id is not None:
        rel = Path("audits") / str(audit_id) / f"{file_uuid}{extension}"
    elif property_id is not None:
        rel = Path("properties") / str(property_id) / doc_type.value / f"{file_uuid}{extension}"
    else:
        rel = Path("misc") / doc_type.value / f"{file_uuid}{extension}"
    return rel


async def upload_document(
    db: AsyncSession,
    *,
    uploader: User,
    upload: UploadFile,
    doc_type: DocumentType,
    property_id: uuid_pkg.UUID | None = None,
    audit_id: uuid_pkg.UUID | None = None,
) -> Document:
    """Lê o upload, valida, persiste em disco e cria o registro Document."""
    declared_mime = (upload.content_type or "").lower()
    extension, magic = _validate_mime(declared_mime)

    content = await upload.read()
    size = len(content)

    if size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo vazio.",
        )
    if size > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Arquivo excede o limite de {settings.MAX_UPLOAD_BYTES // (1024 * 1024)}MB.",
        )

    _check_magic_bytes(content, magic)

    sha256 = hashlib.sha256(content).hexdigest()
    file_uuid = uuid_pkg.uuid4()

    rel_path = _build_storage_path(doc_type, property_id, audit_id, file_uuid, extension)
    abs_path = Path(settings.STORAGE_ROOT) / rel_path

    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(content)

    document = Document(
        uploaded_by_id=uploader.id,
        doc_type=doc_type,
        filename=upload.filename or f"{file_uuid}{extension}",
        mime_type=declared_mime,
        size_bytes=size,
        sha256=sha256,
        storage_path=str(rel_path),
    )
    db.add(document)
    await db.flush()

    logger.info(
        "Documento %s armazenado em %s (sha256=%s, %dB)",
        document.id,
        rel_path,
        sha256[:12],
        size,
    )
    return document


def resolve_storage_path(document: Document) -> Path:
    """Retorna o path absoluto do arquivo associado a um Document."""
    return Path(settings.STORAGE_ROOT) / document.storage_path
