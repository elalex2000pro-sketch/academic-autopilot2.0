"""Configuracion del rate limiter (slowapi)."""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Limita por IP de origen. Se usa como dependencia/decorador en los endpoints.
limiter = Limiter(key_func=get_remote_address, default_limits=[])
