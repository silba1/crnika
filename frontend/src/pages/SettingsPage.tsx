import { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Upload as UploadIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleExport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get JSON data from backend
      const data = await api.exportData();
      
      // Create download link
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = user?.role === 'admin' 
        ? `backup-full-${timestamp}.json`
        : `backup-${user?.ime}-${timestamp}.json`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccess(`Podaci uspješno exportani u ${filename}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri exportu podataka');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        setError('Molimo odaberite JSON datoteku');
        return;
      }
      setSelectedFile(file);
      setImportDialogOpen(true);
    }
  };

  const handleImportConfirm = async () => {
    if (!selectedFile) return;

    try {
      setLoading(true);
      setError(null);
      setImportDialogOpen(false);
      
      // Read file content
      const fileContent = await selectedFile.text();
      const jsonData = JSON.parse(fileContent);
      
      // Send to backend
      await api.importData(jsonData);
      
      setSuccess('Podaci uspješno importani! Osvježite stranicu.');
      setSelectedFile(null);
      
      // Auto-refresh after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri importu podataka. Provjerite JSON format.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportCancel = () => {
    setImportDialogOpen(false);
    setSelectedFile(null);
  };

  // Only admin and vlasnik can access
  if (user?.role === 'zaposlenik') {
    return (
      <Container maxWidth="md">
        <Paper sx={{ p: 3 }}>
          <Alert severity="warning">
            Zaposlenici nemaju pristup postavkama. Samo administratori i vlasnici mogu exportati/importati podatke.
          </Alert>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <SettingsIcon sx={{ fontSize: 32, mr: 1 }} />
          <Typography variant="h4">Postavke</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Export i import podataka. Koristite ovu funkcionalnost za backup ili prijenos podataka između sustava.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <Divider sx={{ my: 3 }} />

        {/* Export Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            📥 Export podataka
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {user?.role === 'admin' 
              ? 'Exporta sve podatke iz sustava u JSON format.'
              : 'Exporta vaše podatke (apartmani, restorani, gosti, rezervacije) u JSON format.'}
          </Typography>

          <List dense>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary={user?.role === 'admin' ? 'Svi vlasnici i zaposlenici' : 'Vaši apartmani i restorani'}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary={user?.role === 'admin' ? 'Svi apartmani i restorani' : 'Vaši gosti'}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary={user?.role === 'admin' ? 'Svi gosti' : 'Vaše rezervacije'}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary={user?.role === 'admin' ? 'Sve rezervacije' : 'Postavke'}
              />
            </ListItem>
          </List>

          <Button
            variant="contained"
            color="primary"
            startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
            onClick={handleExport}
            disabled={loading}
            fullWidth
          >
            {loading ? 'Exportam...' : 'Export u JSON'}
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Import Section */}
        <Box>
          <Typography variant="h6" gutterBottom>
            📤 Import podataka
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {user?.role === 'admin'
              ? 'Importa podatke iz JSON datoteke. Sve postojeće podatke će biti zamijenjeni!'
              : 'Importa vaše podatke iz JSON datoteke. Vaši postojeći podaci će biti zamijenjeni!'}
          </Typography>

          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              ⚠️ VAŽNO UPOZORENJE
            </Typography>
            <Typography variant="body2">
              Import će <strong>ZAMIJENITI</strong> sve postojeće podatke!
              {user?.role === 'admin' && (
                <> Svi vlasnici, apartmani, restorani, gosti i rezervacije će biti obrisani i zamijenjeni podacima iz datoteke.</>
              )}
              {user?.role === 'vlasnik' && (
                <> Vaši apartmani, restorani, gosti i rezervacije će biti obrisani i zamijenjeni podacima iz datoteke.</>
              )}
              <br />
              <strong>Preporučujemo da napravite export prije importa!</strong>
            </Typography>
          </Alert>

          <input
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            id="import-file-input"
          />
          <label htmlFor="import-file-input">
            <Button
              variant="outlined"
              color="warning"
              component="span"
              startIcon={<UploadIcon />}
              fullWidth
              disabled={loading}
            >
              Odaberi JSON datoteku za import
            </Button>
          </label>
        </Box>
      </Paper>

      {/* Import Confirmation Dialog */}
      <Dialog
        open={importDialogOpen}
        onClose={handleImportCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <WarningIcon color="warning" sx={{ mr: 1 }} />
            Potvrda importa
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box>
            <Typography variant="body1" gutterBottom>
              Jeste li sigurni da želite importati podatke iz datoteke:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold', my: 2 }}>
              {selectedFile?.name}
            </Typography>
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>OVO ĆE OBRISATI</strong> sve {user?.role === 'admin' ? 'postojeće' : 'vaše'} podatke i zamijeniti ih podacima iz datoteke!
                <br />
                <br />
                Ova akcija se <strong>NE MOŽE PONIŠTITI</strong>!
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleImportCancel} color="inherit">
            Odustani
          </Button>
          <Button 
            onClick={handleImportConfirm} 
            color="error" 
            variant="contained"
            autoFocus
          >
            DA, Importaj i zamijeni podatke
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
