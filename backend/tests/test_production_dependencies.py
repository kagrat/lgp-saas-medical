"""
Toute bibliotheque importee par le code de l'application doit figurer dans requirements.txt
(les dependances de PRODUCTION). Aurait detecte l'oubli de httpx: present seulement dans les
dependances de test, il aurait empeche le serveur de demarrer dans l'image Docker.
"""
import ast
import pathlib
import re
import sys
from importlib.metadata import packages_distributions

ROOT = pathlib.Path(__file__).resolve().parent.parent


def _locked_packages() -> set[str]:
    text = (ROOT / "requirements.txt").read_text(encoding="utf-8")
    return {re.sub(r"[-_.]+", "-", m.group(1).lower()) for m in re.finditer(r"^([A-Za-z0-9][A-Za-z0-9._-]*)==", text, re.M)}


def _imported_top_level_modules() -> dict[str, str]:
    found = {}
    for path in (ROOT / "app").rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            names = [a.name for a in node.names] if isinstance(node, ast.Import) else (
                [node.module] if isinstance(node, ast.ImportFrom) and node.level == 0 and node.module else [])
            for name in names:
                found.setdefault(name.split(".")[0], str(path.relative_to(ROOT)))
    return found


def test_les_importations_de_l_application_sont_dans_les_dependances_de_production():
    locked = _locked_packages()
    dist_by_module = packages_distributions()
    missing = []
    for module, where in sorted(_imported_top_level_modules().items()):
        if module == "app" or module in sys.stdlib_module_names:
            continue
        dists = {re.sub(r"[-_.]+", "-", d.lower()) for d in dist_by_module.get(module, [])}
        if not dists & locked:
            missing.append(f"{module} (utilise dans {where})")
    assert not missing, "Absent de requirements.txt (production): " + ", ".join(missing)


def test_les_dependances_de_test_ne_sont_pas_dans_la_liste_de_production():
    locked = _locked_packages()
    assert not {"pytest", "pytest-cov", "pip-audit"} & locked
