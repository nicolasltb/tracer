"""certifica minas foundation — properties, audits, certifications, documents, sales

Drops batches/batch_events/qr_tokens (banco em dev, sem dados a preservar) e
recria batches com FK obrigatória para properties.

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a7b8
Create Date: 2026-05-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ----- enums reaproveitados (já criados em migrations anteriores) -----
batch_status = ENUM(name="batch_status", create_type=False)
user_role = ENUM(name="user_role", create_type=False)
event_type = ENUM(name="event_type", create_type=False)

# ----- novos enums -----
document_type = ENUM(
    "PROPERTY_MAP",
    "WATER_SOURCE_PHOTO",
    "CIPA_TR",
    "INVOICE",
    "AUDIT_EVIDENCE",
    "OTHER",
    name="document_type",
)
property_area_type = ENUM(
    "COFFEE",
    "NATIVE_FOREST",
    "APP",
    "BUILDINGS",
    "WATER_BODIES",
    "OTHER",
    name="property_area_type",
)
water_source_type = ENUM(
    "NASCENTE",
    "CURSO_AGUA",
    "POCO",
    "OTHER",
    name="water_source_type",
)
audit_status = ENUM("DRAFT", "SUBMITTED", name="audit_status")
compliance_status = ENUM(
    "CONFORME", "NAO_CONFORME", "NAO_APLICAVEL", name="compliance_status"
)
requirement_code = ENUM(
    "REQ_4_1",
    "REQ_B_3",
    "REQ_C_3_1",
    "REQ_C_3_2",
    "REQ_C_3_6",
    "REQ_C_4_1",
    "REQ_C_5_1",
    "REQ_C_6_3",
    "REQ_D_1",
    "REQ_D_2",
    "REQ_D_3",
    "REQ_D_4",
    "REQ_D_5",
    "REQ_D_6",
    name="requirement_code",
)


def upgrade() -> None:
    bind = op.get_bind()

    # --- drop existing batch-related tables (banco em dev) ---
    op.drop_index(op.f("ix_qr_tokens_token"), table_name="qr_tokens")
    op.drop_index(op.f("ix_qr_tokens_batch_id"), table_name="qr_tokens")
    op.drop_table("qr_tokens")

    op.drop_index(op.f("ix_batch_events_batch_id"), table_name="batch_events")
    op.drop_table("batch_events")

    op.drop_index(op.f("ix_batches_code"), table_name="batches")
    op.drop_table("batches")

    # --- create new enum types ---
    document_type.create(bind)
    property_area_type.create(bind)
    water_source_type.create(bind)
    audit_status.create(bind)
    compliance_status.create(bind)
    requirement_code.create(bind)

    # --- documents ---
    op.create_table(
        "documents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("uploaded_by_id", sa.UUID(), nullable=False),
        sa.Column(
            "doc_type",
            ENUM(name="document_type", create_type=False),
            nullable=False,
        ),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=80), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("storage_path", sa.String(length=512), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_documents_sha256"), "documents", ["sha256"], unique=False)

    # --- properties ---
    op.create_table(
        "properties",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("municipality", sa.String(length=120), nullable=False),
        sa.Column("state", sa.String(length=2), nullable=False),
        sa.Column("total_area_ha", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("employees_count", sa.Integer(), nullable=False),
        sa.Column("map_doc_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["map_doc_id"], ["documents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_properties_owner_id"), "properties", ["owner_id"], unique=False)

    # --- property_areas ---
    op.create_table(
        "property_areas",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("property_id", sa.UUID(), nullable=False),
        sa.Column(
            "area_type",
            ENUM(name="property_area_type", create_type=False),
            nullable=False,
        ),
        sa.Column("area_ha", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_property_areas_property_id"), "property_areas", ["property_id"], unique=False
    )

    # --- water_sources ---
    op.create_table(
        "water_sources",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("property_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "source_type",
            ENUM(name="water_source_type", create_type=False),
            nullable=False,
        ),
        sa.Column("latitude", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("longitude", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_protected", sa.Boolean(), nullable=False),
        sa.Column("protection_notes", sa.Text(), nullable=True),
        sa.Column("photo_doc_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["photo_doc_id"], ["documents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_water_sources_property_id"), "water_sources", ["property_id"], unique=False
    )

    # --- batches (recriado com property_id) ---
    op.create_table(
        "batches",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("status", batch_status, nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("property_id", sa.UUID(), nullable=False),
        sa.Column("tx_hash", sa.String(length=66), nullable=True),
        sa.Column("token_id", sa.String(length=78), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_batches_code"), "batches", ["code"], unique=True)
    op.create_index(op.f("ix_batches_property_id"), "batches", ["property_id"], unique=False)

    # --- batch_events (recriado) ---
    op.create_table(
        "batch_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("batch_id", sa.UUID(), nullable=False),
        sa.Column("actor_id", sa.UUID(), nullable=False),
        sa.Column("event_type", event_type, nullable=False),
        sa.Column("tx_hash", sa.String(length=66), nullable=True),
        sa.Column("block_number", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"]),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tx_hash"),
    )
    op.create_index(op.f("ix_batch_events_batch_id"), "batch_events", ["batch_id"], unique=False)

    # --- qr_tokens (recriado) ---
    op.create_table(
        "qr_tokens",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("batch_id", sa.UUID(), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("next_status", batch_status, nullable=True),
        sa.Column("expected_role", user_role, nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_consumer", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_by_id", sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"]),
        sa.ForeignKeyConstraint(["used_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_qr_tokens_batch_id"), "qr_tokens", ["batch_id"], unique=False)
    op.create_index(op.f("ix_qr_tokens_token"), "qr_tokens", ["token"], unique=True)

    # --- sale_records ---
    op.create_table(
        "sale_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("property_id", sa.UUID(), nullable=False),
        sa.Column("batch_id", sa.UUID(), nullable=True),
        sa.Column("sale_date", sa.Date(), nullable=False),
        sa.Column("buyer_name", sa.String(length=255), nullable=False),
        sa.Column("buyer_document", sa.String(length=32), nullable=True),
        sa.Column("quantity_kg", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("total_value", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("invoice_doc_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"]),
        sa.ForeignKeyConstraint(["invoice_doc_id"], ["documents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_sale_records_property_id"), "sale_records", ["property_id"], unique=False
    )
    op.create_index(op.f("ix_sale_records_batch_id"), "sale_records", ["batch_id"], unique=False)

    # --- audits ---
    op.create_table(
        "audits",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("property_id", sa.UUID(), nullable=False),
        sa.Column("auditor_id", sa.UUID(), nullable=False),
        sa.Column("status", ENUM(name="audit_status", create_type=False), nullable=False),
        sa.Column("visit_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("latitude", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("longitude", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["auditor_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audits_property_id"), "audits", ["property_id"], unique=False)
    op.create_index(op.f("ix_audits_auditor_id"), "audits", ["auditor_id"], unique=False)

    # --- certifications ---
    op.create_table(
        "certifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("property_id", sa.UUID(), nullable=False),
        sa.Column("audit_id", sa.UUID(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("on_chain_hash", sa.String(length=64), nullable=False),
        sa.Column("tx_hash", sa.String(length=66), nullable=True),
        sa.Column("block_number", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["audit_id"], ["audits.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("audit_id"),
    )
    op.create_index(
        op.f("ix_certifications_property_id"),
        "certifications",
        ["property_id"],
        unique=False,
    )

    # --- compliance_checks ---
    op.create_table(
        "compliance_checks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("audit_id", sa.UUID(), nullable=False),
        sa.Column(
            "requirement_code",
            ENUM(name="requirement_code", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "status",
            ENUM(name="compliance_status", create_type=False),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["audit_id"], ["audits.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_compliance_checks_audit_id"),
        "compliance_checks",
        ["audit_id"],
        unique=False,
    )

    # --- compliance_check_evidence (M2M) ---
    op.create_table(
        "compliance_check_evidence",
        sa.Column("check_id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["check_id"], ["compliance_checks.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
        sa.PrimaryKeyConstraint("check_id", "document_id"),
    )


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_table("compliance_check_evidence")
    op.drop_index(op.f("ix_compliance_checks_audit_id"), table_name="compliance_checks")
    op.drop_table("compliance_checks")
    op.drop_index(op.f("ix_certifications_property_id"), table_name="certifications")
    op.drop_table("certifications")
    op.drop_index(op.f("ix_audits_auditor_id"), table_name="audits")
    op.drop_index(op.f("ix_audits_property_id"), table_name="audits")
    op.drop_table("audits")
    op.drop_index(op.f("ix_sale_records_batch_id"), table_name="sale_records")
    op.drop_index(op.f("ix_sale_records_property_id"), table_name="sale_records")
    op.drop_table("sale_records")

    op.drop_index(op.f("ix_qr_tokens_token"), table_name="qr_tokens")
    op.drop_index(op.f("ix_qr_tokens_batch_id"), table_name="qr_tokens")
    op.drop_table("qr_tokens")
    op.drop_index(op.f("ix_batch_events_batch_id"), table_name="batch_events")
    op.drop_table("batch_events")
    op.drop_index(op.f("ix_batches_property_id"), table_name="batches")
    op.drop_index(op.f("ix_batches_code"), table_name="batches")
    op.drop_table("batches")

    op.drop_index(op.f("ix_water_sources_property_id"), table_name="water_sources")
    op.drop_table("water_sources")
    op.drop_index(op.f("ix_property_areas_property_id"), table_name="property_areas")
    op.drop_table("property_areas")
    op.drop_index(op.f("ix_properties_owner_id"), table_name="properties")
    op.drop_table("properties")
    op.drop_index(op.f("ix_documents_sha256"), table_name="documents")
    op.drop_table("documents")

    requirement_code.drop(bind)
    compliance_status.drop(bind)
    audit_status.drop(bind)
    water_source_type.drop(bind)
    property_area_type.drop(bind)
    document_type.drop(bind)

    # Recria batches/batch_events/qr_tokens no estado anterior
    op.create_table(
        "batches",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("status", batch_status, nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("tx_hash", sa.String(length=66), nullable=True),
        sa.Column("token_id", sa.String(length=78), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_batches_code"), "batches", ["code"], unique=True)

    op.create_table(
        "batch_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("batch_id", sa.UUID(), nullable=False),
        sa.Column("actor_id", sa.UUID(), nullable=False),
        sa.Column("event_type", event_type, nullable=False),
        sa.Column("tx_hash", sa.String(length=66), nullable=True),
        sa.Column("block_number", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"]),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tx_hash"),
    )
    op.create_index(op.f("ix_batch_events_batch_id"), "batch_events", ["batch_id"], unique=False)

    op.create_table(
        "qr_tokens",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("batch_id", sa.UUID(), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("next_status", batch_status, nullable=True),
        sa.Column("expected_role", user_role, nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_consumer", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_by_id", sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"]),
        sa.ForeignKeyConstraint(["used_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_qr_tokens_batch_id"), "qr_tokens", ["batch_id"], unique=False)
    op.create_index(op.f("ix_qr_tokens_token"), "qr_tokens", ["token"], unique=True)
