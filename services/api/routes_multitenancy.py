"""
Robost Clarity - Multi-Tenancy API Routes
Endpoints for organization signup, user management, and extension authentication.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID
import logging

from models import (
    SignupRequest, UserInvite, OrganizationResponse, UserResponse, UserRole,
    ExtensionAuthRequest, ExtensionAuthResponse, PaginatedResponse, User
)
from auth import (
    validate_business_email, get_password_hash, get_current_user, get_admin_user,
    create_access_token, get_console_user
)
from database import DatabaseService
from config import settings

logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Initialize services
db_service = DatabaseService()


# ============================================================
# Public Signup Endpoint
# ============================================================

@router.post("/auth/signup", response_model=dict)
async def signup(signup_data: SignupRequest):
    """
    Create a new organization and admin user.
    
    - Validates business email (blocks gmail.com, yahoo.com, etc.)
    - Creates organization with domain derived from email
    - Creates admin user for the organization
    """
    # Validate business email
    is_valid, result = validate_business_email(signup_data.email)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result
        )
    
    domain = result  # Domain extracted from email
    
    # Check if organization already exists for this domain
    existing_org = db_service.get_organization_by_domain(domain)
    if existing_org:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An organization already exists for domain '{domain}'. Please contact your administrator for access."
        )
    
    # Check if email is already registered
    existing_user = db_service.get_user_by_email(signup_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists."
        )
    
    try:
        # Create organization
        organization = db_service.create_organization(
            name=signup_data.organization_name,
            domain=domain,
            settings={"created_via": "signup", "plan": "free"}
        )
        
        # Create admin user
        password_hash = get_password_hash(signup_data.password)
        user = db_service.create_user_with_org(
            email=signup_data.email,
            password_hash=password_hash,
            role="admin",
            first_name=signup_data.first_name,
            last_name=signup_data.last_name,
            organization_id=organization['id']
        )
        
        # Create access token
        access_token = create_access_token(
            data={
                "sub": user['username'],
                "role": "admin",
                "org_id": str(organization['id'])
            },
            expires_delta=timedelta(hours=settings.jwt_expiration_hours)
        )
        
        return {
            "message": "Organization created successfully",
            "access_token": access_token,
            "token_type": "bearer",
            "organization": {
                "id": str(organization['id']),
                "name": organization['name'],
                "domain": organization['domain']
            },
            "user": {
                "id": str(user['id']),
                "email": user['email'],
                "first_name": user['first_name'],
                "last_name": user['last_name'],
                "role": user['role']
            }
        }
        
    except Exception as e:
        logger.error(f"Signup failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create organization. Please try again."
        )


# ============================================================
# Extension Authentication Endpoint
# ============================================================

@router.post("/auth/extension/login", response_model=ExtensionAuthResponse)
async def extension_login(auth_data: ExtensionAuthRequest):
    """
    Authenticate user for Chrome extension.
    
    - Validates email and password
    - Returns organization info for data association
    - Works for Admin, Analyst, and Employee roles
    """
    from auth import authenticate_extension_user
    
    user_data = authenticate_extension_user(auth_data.email, auth_data.password)
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Create extension-specific token
    access_token = create_access_token(
        data={
            "sub": user_data['username'],
            "role": user_data['role'].value if hasattr(user_data['role'], 'value') else user_data['role'],
            "org_id": str(user_data['organization_id']),
            "source": "extension"
        },
        expires_delta=timedelta(hours=settings.jwt_expiration_hours * 7)  # Longer expiry for extension
    )
    
    return ExtensionAuthResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=int(timedelta(hours=settings.jwt_expiration_hours * 7).total_seconds()),
        organization_id=user_data['organization_id'],
        organization_name=user_data['organization_name'],
        user_id=user_data['user_id']
    )


# ============================================================
# User Invitation Endpoint
# ============================================================

@router.post("/users/invite", response_model=dict)
async def invite_user(
    invite_data: UserInvite,
    current_user: User = Depends(get_admin_user)
):
    """
    Invite a new user to the organization (Admin only).
    
    - Creates user with pending status
    - Sends invitation email (TODO: implement email service)
    - User must belong to same domain or be explicitly allowed
    """
    # Get admin's organization
    admin_user = db_service.get_user_by_username(current_user.username)
    if not admin_user or not admin_user.get('organization_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must belong to an organization to invite users"
        )
    
    organization_id = admin_user['organization_id']
    org = db_service.get_organization_by_id(organization_id)
    
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Validate email domain matches organization (optional strictness)
    is_valid, email_domain = validate_business_email(invite_data.email)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=email_domain
        )
    
    # Check if user already exists
    existing_user = db_service.get_user_by_email(invite_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists"
        )
    
    # Validate role
    if invite_data.role == UserRole.ADMIN:
        # Only allow admin creation if explicitly confirmed
        pass  # Allow for now
    
    try:
        # Generate temporary password (user will reset on first login)
        import secrets
        temp_password = secrets.token_urlsafe(16)
        password_hash = get_password_hash(temp_password)
        
        # Create user
        user = db_service.create_user_with_org(
            email=invite_data.email,
            password_hash=password_hash,
            role=invite_data.role.value if hasattr(invite_data.role, 'value') else invite_data.role,
            first_name=invite_data.first_name,
            last_name=invite_data.last_name,
            organization_id=organization_id
        )
        
        # TODO: Send invitation email with temp password or magic link
        # For now, return the temp password (in production, this would be emailed)
        
        return {
            "message": "User invited successfully",
            "user": {
                "id": str(user['id']),
                "email": user['email'],
                "first_name": user['first_name'],
                "last_name": user['last_name'],
                "role": user['role']
            },
            "temp_password": temp_password,  # TODO: Remove in production, send via email
            "note": "Please share the temporary password securely. User should change it on first login."
        }
        
    except Exception as e:
        logger.error(f"Failed to invite user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )


# ============================================================
# Organization Endpoints
# ============================================================

@router.get("/organizations", response_model=PaginatedResponse)
async def list_organizations(
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    admin_user: User = Depends(get_admin_user)
):
    """
    List all organizations (Super Admin only - for platform management).
    Regular org admins should use /organizations/me endpoint.
    """
    # For now, allow any admin to list orgs (in production, add super-admin check)
    try:
        organizations, total_count = db_service.get_all_organizations(
            page=page,
            page_size=page_size,
            search=search
        )
        
        total_pages = (total_count + page_size - 1) // page_size
        
        # Convert to response format
        items = [
            OrganizationResponse(
                id=org['id'],
                name=org['name'],
                domain=org['domain'],
                settings=org.get('settings'),
                user_count=org.get('user_count', 0),
                created_at=org['created_at'],
                updated_at=org.get('updated_at')
            )
            for org in organizations
        ]
        
        return PaginatedResponse(
            items=items,
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )
        
    except Exception as e:
        logger.error(f"Failed to list organizations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve organizations"
        )


@router.get("/organizations/me", response_model=OrganizationResponse)
async def get_my_organization(
    current_user: User = Depends(get_console_user)
):
    """Get the current user's organization details."""
    try:
        user = db_service.get_user_by_username(current_user.username)
        if not user or not user.get('organization_id'):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User is not associated with an organization"
            )
        
        org = db_service.get_organization_by_id(user['organization_id'])
        if not org:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )
        
        # Get user count for the org
        users, user_count = db_service.get_users_by_organization(
            organization_id=user['organization_id'],
            page=1,
            page_size=1
        )
        
        return OrganizationResponse(
            id=org['id'],
            name=org['name'],
            domain=org['domain'],
            settings=org.get('settings'),
            user_count=user_count,
            created_at=org['created_at'],
            updated_at=org.get('updated_at')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get organization: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve organization"
        )


@router.get("/organizations/me/users", response_model=PaginatedResponse)
async def get_organization_users(
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_admin_user)
):
    """Get users in the current admin's organization."""
    try:
        user = db_service.get_user_by_username(current_user.username)
        if not user or not user.get('organization_id'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not associated with an organization"
            )
        
        users, total_count = db_service.get_users_by_organization(
            organization_id=user['organization_id'],
            page=page,
            page_size=page_size,
            search=search,
            role=role,
            is_active=is_active
        )
        
        total_pages = (total_count + page_size - 1) // page_size
        
        items = [
            UserResponse(
                id=u['id'],
                username=u['username'],
                email=u.get('email'),
                first_name=u.get('first_name', ''),
                last_name=u.get('last_name', ''),
                role=UserRole(u['role']),
                organization_id=u.get('organization_id'),
                is_active=u['is_active'],
                last_login=u.get('last_login'),
                created_at=u['created_at'],
                updated_at=u['updated_at']
            )
            for u in users
        ]
        
        return PaginatedResponse(
            items=items,
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get organization users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve users"
        )


# ============================================================
# Extension LLM Request Submission
# ============================================================

@router.post("/extension/llm-request")
async def submit_llm_request(
    request_data: dict,
    request: "Request",
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())
):
    """
    Submit an LLM request from the Chrome extension.
    
    - Validates extension token
    - Associates request with user's organization
    - Captures client IP from request headers
    - Runs detection engine on prompt
    - Records prompt for analysis
    """
    from auth import verify_token
    
    try:
        token_data = verify_token(credentials.credentials)
        
        if not token_data.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Token does not contain organization information"
            )
        
        # Get user ID if available
        user = db_service.get_user_by_username(token_data.username)
        user_id = user['id'] if user else None
        
        # Capture real client IP from headers (handles proxies)
        client_ip = (
            request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or
            request.headers.get("X-Real-IP") or
            request.client.host if request.client else "unknown"
        )
        request_data['src_ip'] = client_ip
        
        # Run detection engine on prompt if present
        prompt = request_data.get('prompt', '')
        if prompt:
            try:
                detection_result = db_service.analyze_prompt(prompt)
                request_data['risk_score'] = detection_result.get('risk_score', 0)
                request_data['is_flagged'] = detection_result.get('is_flagged', False)
                request_data['flag_reason'] = detection_result.get('flag_reason')
            except Exception as det_error:
                logger.warning(f"Detection failed, continuing without: {det_error}")
        
        # Submit the LLM request
        request_id = db_service.create_llm_request_with_org(
            request_data=request_data,
            organization_id=token_data.organization_id,
            user_id=user_id
        )
        
        return {
            "success": True,
            "request_id": str(request_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit LLM request: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record LLM request"
        )
