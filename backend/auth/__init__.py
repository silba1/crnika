"""
OAuth Authentication Module

Supports multiple OAuth providers with extensible architecture.
"""

from .base import OAuthProvider
from .google import GoogleOAuthProvider

__all__ = ['OAuthProvider', 'GoogleOAuthProvider']
