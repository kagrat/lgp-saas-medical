"""
Tests d'authentification et d'isolation des roles.
A lancer avec: pytest tests/ -v (depuis backend/, apres pip install -r requirements.txt)
"""


def test_register_patient_success(client):
    response = client.post("/auth/register-patient", json={
        "email": "patient1@example.com",
        "password": "Passw0rd123",
        "full_name": "Jean Dupont",
        "phone": "+22900000000",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["role"] == "patient"
    assert "access_token" in data


def test_register_patient_weak_password_rejected(client):
    response = client.post("/auth/register-patient", json={
        "email": "patient2@example.com",
        "password": "weakpass",  # pas de majuscule ni de chiffre
        "full_name": "Jean Dupont",
    })
    assert response.status_code == 422


def test_login_wrong_password_returns_generic_error(client):
    client.post("/auth/register-patient", json={
        "email": "patient3@example.com",
        "password": "Passw0rd123",
        "full_name": "Marie Koffi",
    })
    response = client.post("/auth/login", json={
        "email": "patient3@example.com",
        "password": "WrongPassword1",
    })
    assert response.status_code == 401
    # Le message ne doit jamais reveler si c'est l'email ou le mdp qui est faux
    assert "incorrect" in response.json()["detail"].lower()


def test_patient_cannot_access_super_admin_routes(client):
    register = client.post("/auth/register-patient", json={
        "email": "patient4@example.com",
        "password": "Passw0rd123",
        "full_name": "Ali Toko",
    })
    token = register.json()["access_token"]

    response = client.get("/establishments", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


def test_unauthenticated_request_rejected(client):
    response = client.get("/dashboard/global")
    assert response.status_code == 401
