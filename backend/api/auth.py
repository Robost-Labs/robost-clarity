"""
Robost Clarity - Authentication Service
Multi-tenant authentication with business email validation and role-based access control.
"""

import jwt
import re
from datetime import datetime, timedelta
from typing import Optional, Tuple
from uuid import UUID
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext

from config import settings
from models import User, UserInDB, UserRole, Token, TokenData
from database import DatabaseService

# Password hashing - using sha256_crypt to avoid backend issues
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

# JWT Security
security = HTTPBearer()

# Initialize database service
db_service = DatabaseService()

# List of blocked public email domains (users must use business emails)
BLOCKED_EMAIL_DOMAINS = {
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
    'icloud.com', 'protonmail.com', 'mail.com', 'yandex.com', 'zoho.com',
    'live.com', 'msn.com', 'me.com', 'mac.com', 'qq.com', '163.com',
    'sina.com', 'ymail.com', 'rocketmail.com', 'tutanota.com', 'gmx.com'
}

# Store the current admin password hash (will be updated when changed via UI)
# Generate with new bcrypt settings - truncate to 72 bytes for bcrypt compatibility
_admin_password = "admin123"
if isinstance(_admin_password, str):
    _admin_password = _admin_password.encode('utf-8')
if len(_admin_password) > 72:
    _admin_password = _admin_password[:72]
_admin_password_hash = pwd_context.hash(_admin_password)

# Hardcoded admin user (keep separate from database users - for initial setup only)
HARDCODED_ADMIN = UserInDB(
    username="admin",
    role=UserRole.ADMIN,
    hashed_password=_admin_password_hash
)


def validate_business_email(email: str) -> Tuple[bool, str]:
    """
    Validate that an email is a business email (not a public domain).
    Returns (is_valid, error_message_or_domain).
    """
    email = email.lower().strip()
    
    # Basic email format validation
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        return False, "Invalid email format"
    
    # Extract domain
    domain = email.split('@')[1]
    
    # Check against blocked domains
    if domain in BLOCKED_EMAIL_DOMAINS:
        return False, f"Public email domains like {domain} are not allowed. Please use your business email."
    
    return True, domain


def extract_domain_from_email(email: str) -> str:
    """Extract the domain from an email address."""
    return email.lower().strip().split('@')[1]


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    # Truncate password to 72 bytes maximum for bcrypt
    if isinstance(plain_password, str):
        plain_password = plain_password.encode('utf-8')
    if len(plain_password) > 72:
        plain_password = plain_password[:72]
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    # Truncate password to 72 bytes maximum for bcrypt
    if isinstance(password, str):
        password = password.encode('utf-8')
    if len(password) > 72:
        password = password[:72]
    return pwd_context.hash(password)


def authenticate_user(username: str, password: str, require_console_access: bool = True) -> Optional[UserInDB]:
    """
    Authenticate a user with username/email and password.
    
    Args:
        username: Username or email address
        password: Plain text password
        require_console_access: If True, blocks Employee role users from logging in
                               Set to False for extension authentication
    """
    # Check hardcoded admin first (for initial system setup)
    if username == "admin":
        if verify_password(password, _admin_password_hash):
            return UserInDB(
                username="admin",
                role=UserRole.ADMIN,
                hashed_password=_admin_password_hash
            )
        return None
    
    # Check database users - support both username and email
    try:
        db_user = db_service.get_user_by_username(username)
        if not db_user:
            # Try email lookup
            db_user = db_service.get_user_by_email(username)
        
        if db_user and db_user['is_active'] and verify_password(password, db_user['password_hash']):
            user_role = UserRole(db_user['role'])
            
            # Block Employee users from web console login
            if require_console_access and user_role == UserRole.EMPLOYEE:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Employee accounts do not have web console access. Please use the Robost Clarity Chrome Extension."
                )
            
            # Update login timestamp
            db_service.update_user_login(username)
            
            return UserInDB(
                username=db_user['username'],
                role=user_role,
                hashed_password=db_user['password_hash']
            )
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        print(f"Database error during authentication: {e}")
    
    return None


def authenticate_extension_user(email: str, password: str) -> Optional[dict]:
    """
    Authenticate a user for the Chrome extension.
    Returns user info including organization details.
    """
    try:
        db_user = db_service.get_user_by_email(email)
        
        if db_user and db_user['is_active'] and verify_password(password, db_user['password_hash']):
            user_role = UserRole(db_user['role'])
            
            # Only Admin and Employee can use the extension
            if user_role not in [UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.ANALYST]:
                return None
            
            # Get organization info
            org = db_service.get_organization_by_id(db_user['organization_id'])
            if not org:
                return None
            
            # Update login timestamp
            db_service.update_user_login(db_user['username'])
            
            return {
                'user_id': db_user['id'],
                'username': db_user['username'],
                'email': db_user['email'],
                'role': user_role,
                'organization_id': db_user['organization_id'],
                'organization_name': org['name'],
                'password_hash': db_user['password_hash']
            }
    except Exception as e:
        print(f"Database error during extension authentication: {e}")
    
    return None


def update_admin_password(new_password: str):
    """Update the hardcoded admin password"""
    global _admin_password_hash
    # Truncate password to 72 bytes maximum for bcrypt
    if isinstance(new_password, str):
        new_password = new_password.encode('utf-8')
    if len(new_password) > 72:
        new_password = new_password[:72]
    _admin_password_hash = pwd_context.hash(new_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=settings.jwt_expiration_hours)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt


def verify_token(token: str) -> TokenData:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        organization_id: str = payload.get("org_id")
        
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        org_uuid = UUID(organization_id) if organization_id else None
        return TokenData(username=username, role=UserRole(role), organization_id=org_uuid)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get the current authenticated user from JWT token"""
    token_data = verify_token(credentials.credentials)
    
    # Check database users (including admin)
    try:
        db_user = db_service.get_user_by_username(token_data.username)
        if db_user and db_user['is_active']:
            return User(
                username=db_user['username'], 
                role=UserRole(db_user['role']),
                first_name=db_user.get('first_name', ''),
                last_name=db_user.get('last_name', '')
            )
    except Exception as e:
        print(f"Database error during user lookup: {e}")
    
    # Fallback to hardcoded admin if database lookup fails
    if token_data.username == "admin":
        return User(username="admin", role=UserRole.ADMIN, first_name="", last_name="")
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="User not found or inactive",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_console_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency that ensures the user has console access.
    Blocks Employee role users from accessing web endpoints.
    """
    if current_user.role == UserRole.EMPLOYEE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee accounts do not have web console access"
        )
    return current_user


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that requires admin role"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def get_admin_or_analyst(current_user: User = Depends(get_console_user)) -> User:
    """Dependency that requires admin or analyst role (for read-only access)"""
    if current_user.role not in [UserRole.ADMIN, UserRole.ANALYST, UserRole.READ_ONLY]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    return current_user


# Alias for compatibility
require_admin = get_admin_user


def create_token_response(user: UserInDB, organization_id: Optional[UUID] = None) -> Token:
    """Create a token response for a user"""
    access_token_expires = timedelta(hours=settings.jwt_expiration_hours)
    
    token_data = {"sub": user.username, "role": user.role.value}
    if organization_id:
        token_data["org_id"] = str(organization_id)
    
    access_token = create_access_token(
        data=token_data,
        expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=int(access_token_expires.total_seconds()),
        role=user.role
    )


def get_current_user_organization_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[UUID]:
    """Extract organization_id from the current user's JWT token"""
    token_data = verify_token(credentials.credentials)
    return token_data.organization_id