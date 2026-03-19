import { useGoogleLogin } from '@react-oauth/google';
import { Button } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useState } from 'react';

interface GoogleLoginButtonProps {
  onSuccess: (credential: string) => void;
  onError?: (error: any) => void;
}

export function GoogleLoginButton({ onSuccess, onError }: GoogleLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      try {
        // Get user info from Google using the access token
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        
        const userInfo = await userInfoResponse.json();
        
        // Create a simple token object with email
        const credential = JSON.stringify({
          email: userInfo.email,
          name: userInfo.name,
          sub: userInfo.sub, // Google ID
          email_verified: userInfo.email_verified
        });
        
        onSuccess(credential);
      } catch (error) {
        console.error('Failed to get user info:', error);
        if (onError) onError(error);
      } finally {
        setIsLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google login failed:', error);
      if (onError) {
        onError(error);
      }
    },
  });

  return (
    <Button
      variant="outlined"
      fullWidth
      onClick={() => login()}
      startIcon={<GoogleIcon />}
      disabled={isLoading}
      sx={{
        borderColor: '#4285f4',
        color: '#4285f4',
        '&:hover': {
          borderColor: '#357ae8',
          backgroundColor: 'rgba(66, 133, 244, 0.04)',
        },
        textTransform: 'none',
        fontSize: '16px',
        py: 1.2,
      }}
    >
      {isLoading ? 'Signing in...' : 'Sign in with Google'}
    </Button>
  );
}
