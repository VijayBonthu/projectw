from fastapi import FastAPI, Request, Response, Depends, HTTPException, Header
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Optional, Callable
from starlette.datastructures import MutableHeaders
import secrets
from utils.logger import logger

class CSRFMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        csrf_token_cookie_name: str = "csrf_token",
        csrf_token_header_name: str = "X-CSRF-Token"
    ):
        super().__init__(app)
        self.csrf_token_cookie_name = csrf_token_cookie_name
        self.csrf_token_header_name = csrf_token_header_name
    
    async def dispatch(self, request: Request, call_next):
        # For GET requests and other "safe" methods, ensure a CSRF token exists
        if request.method.upper() in ["GET", "HEAD", "OPTIONS"]:
            response = await call_next(request)
            
            # Generate and set a CSRF token if not already present
            if self.csrf_token_cookie_name not in request.cookies:
                csrf_token = secrets.token_hex(32)
                response.set_cookie(
                    key=self.csrf_token_cookie_name,
                    value=csrf_token,
                    httponly=False,  # Must be accessible from JavaScript
                    samesite="lax",
                    path="/"
                )
                logger.info(f"New CSRF token generated for request to {request.url.path}")
            
            return response
        
        # For state-changing methods, validate CSRF token
        elif request.method.upper() in ["POST", "PUT", "DELETE", "PATCH"]:
            # Get CSRF token from cookie and header
            csrf_cookie = request.cookies.get(self.csrf_token_cookie_name)
            csrf_header = request.headers.get(self.csrf_token_header_name)
            
            # Skip validation for authentication endpoints (login, registration)
            if request.url.path in ["/api/v1/login", "/api/v1/registration", "/api/v1/auth/callback", "/api/v1/auth/jira/callback"]:
                return await call_next(request)
            
            # Validate CSRF token
            if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
                logger.warning(f"CSRF validation failed for {request.url.path} - Cookie: {csrf_cookie}, Header: {csrf_header}")
                raise HTTPException(
                    status_code=403, 
                    detail=f"CSRF token missing or invalid. Cookie: {csrf_cookie and 'present' or 'missing'}, Header: {csrf_header and 'present' or 'missing'}"
                )
            
            return await call_next(request)
        
        # For other methods, just pass through
        return await call_next(request)


# Helper function to get CSRF token from request (for use in dependencies if needed)
def get_csrf_token(
    csrf_token: Optional[str] = Header(None, alias="X-CSRF-Token")
) -> str:
    if not csrf_token:
        raise HTTPException(
            status_code=403,
            detail="CSRF token is missing"
        )
    return csrf_token

