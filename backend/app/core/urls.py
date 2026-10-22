"""Normalizacion de URLs externas.

Moodle se configura con la URL raiz del sitio. Los usuarios suelen pegar la URL
del navegador (``/login/index.php``, ``/my``) o el endpoint de Web Services, asi
que la limpiamos antes de guardarla y de construir ``server.php``.
"""
from __future__ import annotations

import re
from urllib.parse import urlsplit, urlunsplit

_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*://")

# Rutas que no forman parte de la raiz de Moodle.
_SUFFIXES = (
    "/webservice/rest/server.php",
    "/login/index.php",
    "/my/index.php",
    "/my",
    "/index.php",
)


def normalize_moodle_base_url(raw: str) -> str:
    """Devuelve la URL raiz de Moodle con esquema y sin rutas de navegacion.

    - Si no hay esquema, asume HTTPS.
    - Acepta Moodle instalado en un subdirectorio (``https://host/moodle``).
    - Quita ``/webservice/rest/server.php`` si el usuario pego el endpoint.
    - Descarta query string, fragmento y credenciales embebidas.

    Lanza ``ValueError`` con un mensaje apto para mostrar al usuario.
    """
    value = (raw or "").strip()
    if not value:
        raise ValueError("La URL de Moodle no puede estar vacia.")
    if any(char.isspace() for char in value):
        raise ValueError("La URL de Moodle no puede contener espacios.")

    if not _SCHEME_RE.match(value):
        value = f"https://{value}"

    parts = urlsplit(value)
    if parts.scheme.lower() not in {"http", "https"} or not parts.netloc:
        raise ValueError("La URL de Moodle debe empezar por http:// o https:// y tener un dominio.")
    if parts.username or parts.password:
        raise ValueError("La URL de Moodle no debe incluir usuario ni contrasena.")

    path = parts.path.rstrip("/")
    for suffix in _SUFFIXES:
        if path.endswith(suffix):
            path = path[: -len(suffix)]
            break

    return urlunsplit(
        (parts.scheme.lower(), parts.netloc.lower(), path.rstrip("/"), "", "")
    )
