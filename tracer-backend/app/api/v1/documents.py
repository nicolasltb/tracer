import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.document import Document, DocumentType
from app.models.user import User
from app.schemas.document import DocumentPublic
from app.services.document_service import resolve_storage_path, upload_document

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["Documentos"])


@router.post("/upload", response_model=DocumentPublic, status_code=status.HTTP_201_CREATED)
async def upload(
    file: UploadFile = File(...),
    doc_type: DocumentType = Form(...),
    property_id: uuid.UUID | None = Form(default=None),
    audit_id: uuid.UUID | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Faz upload de um documento (JPG, PNG ou PDF; máximo 10MB).

    `property_id` e `audit_id` são opcionais e influenciam apenas o
    layout do arquivo no filesystem. A associação lógica (mapa da
    propriedade, evidência de check, etc.) deve ser feita em seguida
    referenciando o `id` retornado.
    """
    document = await upload_document(
        db=db,
        uploader=current_user,
        upload=file,
        doc_type=doc_type,
        property_id=property_id,
        audit_id=audit_id,
    )
    return document


@router.get("/{document_id}")
async def download(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),  # noqa: ARG001
    db: AsyncSession = Depends(get_db),
):
    """Streama o conteúdo do documento. Requer autenticação."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Documento não encontrado."
        )

    path = resolve_storage_path(document)
    if not path.exists():
        logger.error("Documento %s referenciado no DB mas ausente em %s", document.id, path)
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Arquivo não disponível no armazenamento.",
        )

    return FileResponse(
        path,
        media_type=document.mime_type,
        filename=document.filename,
    )


@router.get("/{document_id}/meta", response_model=DocumentPublic)
async def metadata(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),  # noqa: ARG001
    db: AsyncSession = Depends(get_db),
):
    """Retorna os metadados de um documento sem baixar o arquivo."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Documento não encontrado."
        )
    return document
