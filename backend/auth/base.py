"""
Base OAuth Provider Interface

Abstract class that all OAuth providers must implement.
This allows easy addition of new providers (Facebook, Microsoft, etc.)
"""

from abc import ABC, abstractmethod
from typing import Dict, Optional


class OAuthProvider(ABC):
    """
    Abstract base class for OAuth providers.
    
    Each provider (Google, Facebook, Microsoft) must implement:
    - verify_token: Verify OAuth token and extract user info
    """
    
    def __init__(self, client_id: str, client_secret: Optional[str] = None):
        """
        Initialize OAuth provider.
        
        Args:
            client_id: OAuth client ID
            client_secret: OAuth client secret (optional for some providers)
        """
        self.client_id = client_id
        self.client_secret = client_secret
    
    @abstractmethod
    async def verify_token(self, token: str) -> Dict[str, str]:
        """
        Verify OAuth token and extract user information.
        
        Args:
            token: OAuth token from frontend
            
        Returns:
            Dictionary with user info:
            {
                'email': 'user@example.com',
                'name': 'John Doe',
                'provider_id': '123456789',  # Unique ID from provider
                'provider': 'google'  # Provider name
            }
            
        Raises:
            ValueError: If token is invalid
        """
        pass
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return provider name (e.g., 'google', 'facebook')"""
        pass
