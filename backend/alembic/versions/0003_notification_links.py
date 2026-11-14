"""notifications: liens vers le patient et le rendez-vous

Idempotente: sur une base ou le fichier MIGRATION_NOTIFICATION_LIEN.sql a deja ete
execute a la main, rien n'est recree.

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing = {c["name"] for c in inspector.get_columns("notifications")}
    if "patient_id" not in existing:
        op.add_column("notifications", sa.Column("patient_id", sa.UUID(as_uuid=False), sa.ForeignKey("patients.id"), nullable=True))
    if "appointment_id" not in existing:
        op.add_column("notifications", sa.Column("appointment_id", sa.UUID(as_uuid=False), sa.ForeignKey("appointments.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("notifications", "appointment_id")
    op.drop_column("notifications", "patient_id")
