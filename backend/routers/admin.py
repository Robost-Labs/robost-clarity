from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from uuid import UUID
import secrets
import logging

from auth import verify_google_token, get_password_hash, create_token_response
from database import DatabaseService
from models import Token, UserInDB, UserRole, SSOLoginResponse

router = APIRouter(tags=["admin"])
db_service = DatabaseService()
logger = logging.getLogger(__name__)

class GoogleLoginRequest(BaseModel):
    token: str
    source: str = "web"  # "web" or "extension"

@router.post("/organizations", response_model=Token)
async def create_organization_sso(login_data: GoogleLoginRequest):
    """
    Initialize a new tenant or login to existing one via Google SSO.
    """
    # Verify Google Token
    google_user = verify_google_token(login_data.token)
    email = google_user['email']
    first_name = google_user.get('given_name', '')
    last_name = google_user.get('family_name', '')
    
    # Check if user exists in database
    db_user = db_service.get_user_by_email(email)
    
    if not db_user:
        # Check source - only allow auto-provisioning for web
        if login_data.source == "extension":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found. Please sign up via the web dashboard first.",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        # Auto-provisioning for Web
        try:
            domain = email.split('@')[1]
            
            # Check if organization exists
            organization = db_service.get_organization_by_domain(domain)
            
            if not organization:
                # Create new Organization
                # Derive name from domain (e.g. "robost.ai" -> "Robost.ai")
                org_name = domain.split('.')[0].capitalize()
                organization = db_service.create_organization(
                    name=org_name,
                    domain=domain,
                    settings={"created_via": "sso_signup", "plan": "free"}
                )
                role = "admin" # First user in new org is admin
            else:
                role = "employee" # Subsequent users are employees
            
            random_password = secrets.token_urlsafe(16)
            password_hash = get_password_hash(random_password)
            
            db_user = db_service.create_user_with_org(
                email=email,
                password_hash=password_hash,
                role=role,
                first_name=first_name,
                last_name=last_name,
                organization_id=organization['id']
            )
            
        except Exception as e:
            logger.error(f"Auto-provisioning failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create account via SSO."
            )

    if not db_user['is_active']:
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create user object for token generation
    user = UserInDB(
        username=db_user['username'],
        role=UserRole(db_user['role']),
        hashed_password=db_user['password_hash']
    )
    
    # Update login timestamp
    db_service.update_user_login(db_user['username'])
    
    # Create app token
    org_id = UUID(db_user['organization_id']) if db_user.get('organization_id') else None
    token_resp = create_token_response(user, org_id)
    
    # Get organization name for the response
    org_name = None
    if org_id:
        org = db_service.get_organization_by_id(db_user['organization_id'])
        if org:
            org_name = org['name']
            
    # Return enhanced response
    return SSOLoginResponse(
        access_token=token_resp.access_token,
        token_type=token_resp.token_type,
        expires_in=token_resp.expires_in,
        role=token_resp.role,
        organization_id=org_id,
        organization_name=org_name,
        user_id=UUID(db_user['id']),
        username=db_user['username']
    )
