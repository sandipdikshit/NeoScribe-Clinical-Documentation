from starlette.responses import JSONResponse
from starlette.exceptions import HTTPException
from fastapi.exceptions import RequestValidationError

def format_response(message: str, status_code: int, data: dict = None) -> JSONResponse:
    """
    Formats the response in the desired structure.

    Args:
        message (str): The message to include in the response.
        status_code (int): The HTTP status code.
        data (dict, optional): The data to include in the response. Defaults to None.

    Returns:
        JSONResponse: A Starlette JSONResponse object with the formatted structure.
    """
    formatted_body = {
        "message": message,
        "code": status_code,
        "data": data
    }
    return JSONResponse(content=formatted_body, status_code=status_code)

def global_exception_handler(request, exc):
    """
    Handles global exceptions and formats them in the desired structure.

    Args:
        request: The HTTP request object.
        exc: The exception instance.

    Returns:
        JSONResponse: A formatted JSON response for the exception.
    """
    if isinstance(exc, HTTPException):
        return format_response(exc.detail, exc.status_code, None)
    elif isinstance(exc, RequestValidationError):
        return format_response("Validation error", 422, exc.errors())
    else:
        return format_response("Internal server error", 500, None)
