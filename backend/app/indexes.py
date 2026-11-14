"""
Index de performance (colonnes filtrees a chaque requete des ecrans principaux).

Sans index, PostgreSQL relit la table ENTIERE a chaque filtre: invisible avec
quelques centaines de lignes, tres lent avec des dizaines de milliers de
rendez-vous / messages / journaux. Ces index sont declares sur les modeles ET
crees par la migration 0002 (copie figee de cette liste, verifiee par un test).
Format: (table, (colonnes...)).
"""
HOT_INDEXES: tuple[tuple[str, tuple[str, ...]], ...] = (
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


def index_name(table: str, columns: tuple[str, ...]) -> str:
    return f"ix_{table}_{'_'.join(columns)}"[:63]
