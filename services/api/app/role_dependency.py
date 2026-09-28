from fastapi import Depends, HTTPException, status
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from functools import wraps
from app.v2.auth import get_current_provider

def check_permission(module: str, action: str):
    """
    Creates a dependency that checks if the current provider has permission
    to perform a specific action on a module.
    
    Args:
        module: The module name (e.g., "patient_management", "provider_management")
        action: The action to check (e.g., "create", "read", "update", "delete")
    
    Returns:
        A dependency function that returns the provider if authorized
    
    Raises:
        HTTPException: 403 if the provider doesn't have permission
    """
    async def permission_checker(
        current_provider = Depends(get_current_provider)
    ) -> Any:
        # Check if provider has a role assigned
        if not hasattr(current_provider, 'role') or current_provider.role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Provider has no role assigned"
            )
        
        # Get permissions from the role
        permissions = current_provider.role.permissions
        
        # Handle different permission storage formats
        if permissions is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Role has no permissions defined"
            )
        
        # If permissions is a string (JSON), parse it
        if isinstance(permissions, str):
            try:
                import json
                permissions = json.loads(permissions)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Invalid permissions format"
                )
        
        # Check if the module exists in permissions
        if module not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No permissions defined for module: {module}"
            )
        
        # Check if the specific action is allowed
        module_permissions = permissions[module]
        
        # Handle both dict format {"read": true} and list format ["read", "update"]
        if isinstance(module_permissions, dict):
            # Dictionary format: {"create": true, "read": true, ...}
            if not module_permissions.get(action, False):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: {action} on {module}"
                )
        elif isinstance(module_permissions, list):
            # List format: ["read", "update"]
            if action not in module_permissions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: {action} on {module}"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Invalid permission format for module"
            )
        
        # Permission granted, return the provider
        return current_provider
    
    return permission_checker


# Alternative: A simpler version if you want to check multiple permissions
def require_any_permission(*permissions: tuple[str, str]):
    """
    Checks if the provider has ANY of the specified permissions.
    
    Args:
        permissions: Tuples of (module, action) to check
        
    Example:
        require_any_permission(
            ("patient_management", "read"),
            ("patient_management", "update")
        )
    """
    async def permission_checker(
        current_provider = Depends(get_current_provider)
    ) -> Any:
        if not hasattr(current_provider, 'role') or current_provider.role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Provider has no role assigned"
            )
        
        role_permissions = current_provider.role.permissions
        
        if isinstance(role_permissions, str):
            try:
                import json
                role_permissions = json.loads(role_permissions)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Invalid permissions format"
                )
        
        # Check each required permission
        for module, action in permissions:
            if module in role_permissions:
                module_perms = role_permissions[module]
                
                if isinstance(module_perms, dict) and module_perms.get(action, False):
                    return current_provider
                elif isinstance(module_perms, list) and action in module_perms:
                    return current_provider
        
        # No matching permission found
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Insufficient privileges"
        )
    
    return permission_checker


# Utility function to check permissions without raising exception
async def has_permission(
    provider: Any,
    module: str,
    action: str
) -> bool:
    """
    Utility function to check if a provider has a specific permission.
    Returns True/False instead of raising an exception.
    
    Useful for conditional UI rendering or business logic.
    """
    if not hasattr(provider, 'role') or provider.role is None:
        return False
    
    permissions = provider.role.permissions
    
    if isinstance(permissions, str):
        try:
            import json
            permissions = json.loads(permissions)
        except:
            return False
    
    if module not in permissions:
        return False
    
    module_permissions = permissions[module]
    
    if isinstance(module_permissions, dict):
        return module_permissions.get(action, False)
    elif isinstance(module_permissions, list):
        return action in module_permissions
    
    return False