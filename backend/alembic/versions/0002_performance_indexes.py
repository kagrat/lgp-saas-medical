"""index de performance

Idempotente: sur une base qui possede deja certains index, rien n'est recree.

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

# Copie FIGEE de app.indexes.HOT_INDEXES au moment de cette migration
# (une migration ne doit jamais changer apres coup).
INDEXES = (
    ("appointments", ("doctor_id", "scheduled_at")),
    ("appointments", ("patient_id",)),
    ("appointments", ("establishment_id", "scheduled_at")),
    ("messages", ("patient_id", "establishment_id")),
    ("messages", ("doctor_id",)),
    ("internal_messages", ("from_user_id",)),
    ("internal_messages", ("to_user_id",)),
    ("pharmacy_reservations", ("establishment_id", "status")),
    ("pharmacy_reservations", ("patient_id",)),
    ("lab_test_requests", ("establishment_id", "status")),
    ("lab_test_requests", ("patient_id",)),
    ("audit_logs", ("establishment_id", "created_at")),
    ("audit_logs", ("user_id",)),
    ("users", ("phone",)),
    ("users", ("establishment_id", "role")),
    ("doctors", ("establishment_id",)),
    ("doctors", ("user_id",)),
    ("shifts", ("user_id", "shift_date")),
    ("shifts", ("establishment_id", "shift_date")),
    ("notifications", ("user_id", "created_at")),
    ("doctor_reviews", ("doctor_id",)),
    ("doctor_reviews", ("patient_id",)),
    ("medical_documents", ("patient_id",)),
    ("medical_documents", ("appointment_id",)),
    ("invoices", ("establishment_id", "status")),
    ("invoices", ("patient_id",)),
    ("admissions", ("establishment_id", "status")),
    ("two_factor_codes", ("user_id",)),
    ("patient_record_shares", ("patient_id",)),
    ("dependents", ("patient_id",)),
    ("support_messages", ("user_id",)),
)


def _name(table, cols):
    return f"ix_{table}_{'_'.join(cols)}"[:63]


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing_tables = set(inspector.get_table_names())
    for table, cols in INDEXES:
        if table not in existing_tables:
            continue
        have = {c["name"] for c in inspector.get_columns(table)}
        if not set(cols) <= have:
            continue
        op.create_index(_name(table, cols), table, list(cols), if_not_exists=True)


def downgrade() -> None:
    for table, cols in INDEXES:
        op.drop_index(_name(table, cols), table_name=table, if_exists=True)
