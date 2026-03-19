"""
Google OAuth Provider

Implements Google Sign-In verification using google-auth library.
"""

from typing import Dict
from google.oauth2 import id_token
from google.auth.transport import requests
from .base import OAuthProvider


class GoogleOAuthProvider(OAuthProvider):
    """Google OAuth implementation"""
    
    @property
    def provider_name(self) -> str:
        return 'google'
    
    async def verify_token(self, token: str) -> Dict[str, str]:
        """
        Verify Google ID token and extract user info.
        
        Args:
            token: Google ID token from frontend
            
        Returns:
            Dict with: email, name, provider_id, provider
            
        Raises:
            ValueError: If token is invalid or verification fails
        """
        try:
            # Verify the token with Google
            idinfo = id_token.verify_oauth2_token(
                token, 
                requests.Request(), 
                self.client_id
            )
            
            # Token is valid, extract user info
            email = idinfo.get('email')
            name = idinfo.get('name', '')
            google_id = idinfo.get('sub')  # Google user ID
            
            if not email:
                raise ValueError("Email not provided by Google")
            
            if not idinfo.get('email_verified'):
                raise ValueError("Email not verified by Google")
            
            return {
                'email': email,
                'name': name,
                'provider_id': google_id,
                'provider': self.provider_name
            }
            
        except ValueError as e:
            # Invalid token
            raise ValueError(f"Invalid Google token: {str(e)}")
        except Exception as e:
            # Other errors
            raise ValueError(f"Google token verification failed: {str(e)}")
