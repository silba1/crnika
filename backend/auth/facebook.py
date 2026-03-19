"""
Facebook OAuth Provider

PLACEHOLDER - To be implemented when Facebook login is added.

Implementation will follow same pattern as GoogleOAuthProvider.
"""

from typing import Dict
from .base import OAuthProvider


class FacebookOAuthProvider(OAuthProvider):
    """Facebook OAuth implementation (TODO)"""
    
    @property
    def provider_name(self) -> str:
        return 'facebook'
    
    async def verify_token(self, token: str) -> Dict[str, str]:
        """
        Verify Facebook access token.
        
        TODO: Implement Facebook token verification
        - Use Facebook Graph API
        - Endpoint: https://graph.facebook.com/me?access_token={token}
        - Extract: email, name, id
        """
        raise NotImplementedError("Facebook OAuth not yet implemented")
