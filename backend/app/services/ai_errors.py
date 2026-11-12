"""Mensajes seguros del proveedor: nunca incluyen URL, clave ni respuesta remota."""
import httpx


class AiProviderError(RuntimeError):
    pass


def provider_error_message(error: Exception) -> str:
    if isinstance(error, httpx.HTTPStatusError):
        code = error.response.status_code
        if code in (401, 403):
            return "No se pudo usar tu clave de IA. Revisa la clave y sus permisos en Ajustes."
        if code in (400, 404):
            return "Este modelo no está disponible con tu clave o no admite esta solicitud. Puedes volver al modelo por defecto."
        if code == 429:
            return "Has alcanzado el límite de uso de este modelo. Inténtalo más tarde o vuelve al modelo por defecto."
    if isinstance(error, httpx.RequestError):
        return "No se pudo conectar con la IA. Comprueba tu conexión e inténtalo de nuevo."
    return "La IA no pudo completar la solicitud. Inténtalo de nuevo o vuelve al modelo por defecto."
