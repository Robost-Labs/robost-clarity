from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import logging

from models import DetectionRuleResponse
from auth import get_current_user, User
from database import DatabaseService

router = APIRouter(tags=["proxy"])
db_service = DatabaseService()
logger = logging.getLogger(__name__)

@router.get("/proxy/rules", response_model=List[dict])
async def get_proxy_rules(current_user: User = Depends(get_current_user)):
    """
    Fetch active regex rules for the extension.
    The extension uses these rules to intercept/highlight content.
    """
    try:
        # Fetch all active rules
        # In a real multi-tenant setup, this might be filtered by current_user.organization_id
        # For now, we return all enabled system rules
        rules, _ = db_service.get_detection_rules_paginated(
            page=1, 
            page_size=1000, 
            is_active=True
        )
        return rules
    except Exception as e:
        logger.error(f"Failed to fetch proxy rules: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to fetch rules"
        )
