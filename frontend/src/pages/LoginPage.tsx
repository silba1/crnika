import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addDebugLog = (msg: string) => {
    console.log('🐛 DEBUG:', msg);
    setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    addDebugLog('Form submitted');
    setLocalError('');

    if (!email || !password) {
      addDebugLog('Validation failed - empty fields');
      setLocalError('Email i password su obavezni');
      return;
    }

    addDebugLog('Calling login...');
    try {
      await login(email, password);
      addDebugLog('Login successful!');
      navigate('/dashboard');
    } catch (err: any) {
      addDebugLog('Login failed - entering catch block');
      console.error('Login error full object:', err);
      console.error('Response:', err.response);
      console.error('Response data:', err.response?.data);
      
      // Set local error from API response with multiple fallbacks
      let errorMsg = 'Prijava nije uspjela. Provjerite email i password.';
      
      if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
        addDebugLog(`Error from backend: ${errorMsg}`);
      } else if (err.response?.status === 401) {
        errorMsg = 'Neispravni email ili lozinka';
        addDebugLog('401 status - wrong credentials');
      } else if (err.message) {
        errorMsg = err.message;
        addDebugLog(`Error message: ${errorMsg}`);
      }
      
      addDebugLog(`Setting localError: ${errorMsg}`);
      setLocalError(errorMsg);
      addDebugLog('Error set, staying on page');
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <LoginIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          
          <Typography component="h1" variant="h5" gutterBottom>
            Apartmani & Restorani
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Prijavite se za nastavak
          </Typography>

          {localError && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {localError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={isLoading}
            >
              {isLoading ? 'Prijava...' : 'Prijavi se'}
            </Button>

            {debugLog.length > 0 && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1, maxHeight: 200, overflow: 'auto' }}>
                <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 1 }}>
                  🐛 Debug Log (stays after reload):
                </Typography>
                {debugLog.map((log, idx) => (
                  <Typography key={idx} variant="caption" display="block" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {log}
                  </Typography>
                ))}
              </Box>
            )}

            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                <strong>Default admin:</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Email: admin@admin.com
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Password: admin123
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
