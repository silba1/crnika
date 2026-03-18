import { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Alert,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import api from '../services/api';
import type { Gost } from '../types';
import { useAuthStore } from '../store/authStore';

interface GostFormData {
  naziv: string;
  ime_prezime: string;
  email: string;
  telefon: string;
  napomena: string;
}

export default function GostiPage() {
  const { user } = useAuthStore();
  const [gosti, setGosti] = useState<Gost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGost, setEditingGost] = useState<Gost | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [gostToDelete, setGostToDelete] = useState<Gost | null>(null);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<GostFormData>({
    defaultValues: {
      naziv: '',
      ime_prezime: '',
      email: '',
      telefon: '',
      napomena: '',
    }
  });

  const nazivValue = watch('naziv');

  useEffect(() => {
    loadGosti();
  }, []);

  const loadGosti = async (search?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getGosti(0, 100, search);
      setGosti(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri učitavanju gostiju');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadGosti(searchQuery);
  };

  const handleOpenDialog = (gost?: Gost) => {
    if (gost) {
      setEditingGost(gost);
      reset({
        naziv: gost.naziv,
        ime_prezime: gost.ime_prezime || '',
        email: gost.email || '',
        telefon: gost.telefon || '',
        napomena: gost.napomena || '',
      });
    } else {
      setEditingGost(null);
      reset({
        naziv: '',
        ime_prezime: '',
        email: '',
        telefon: '',
        napomena: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingGost(null);
    reset();
  };

  const onSubmit = async (data: GostFormData) => {
    try {
      setError(null);
      
      // Validate: at least email or telefon
      if (!data.email?.trim() && !data.telefon?.trim()) {
        setError('Morate unijeti Email ILI Telefon (bar jedno polje)');
        return;
      }
      
      const submitData: Gost = {
        vlasnik_id: user?.id || 0,
        naziv: data.naziv.trim(),
        ime_prezime: data.ime_prezime.trim() || data.naziv.trim(), // Auto-populate
        email: data.email.trim() || null,
        telefon: data.telefon.trim() || null,
        napomena: data.napomena.trim() || null,
      };

      if (editingGost) {
        await api.updateGost(editingGost.id!, submitData);
        setSuccess('Gost uspješno ažuriran!');
      } else {
        await api.createGost(submitData);
        setSuccess('Gost uspješno kreiran!');
      }

      handleCloseDialog();
      loadGosti(searchQuery);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri spremanju gosta');
    }
  };

  const handleDeleteClick = (gost: Gost) => {
    setGostToDelete(gost);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!gostToDelete) return;

    try {
      setError(null);
      await api.deleteGost(gostToDelete.id!);
      setSuccess('Gost uspješno obrisan!');
      setDeleteDialogOpen(false);
      setGostToDelete(null);
      loadGosti(searchQuery);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri brisanju gosta');
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Gosti</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Dodaj gosta
          </Button>
        </Box>

        {error && typeof error === 'string' && error.trim() && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
        )}

        {success && typeof success === 'string' && success.trim() && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>
        )}

        <Box component="form" onSubmit={handleSearch} sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Pretraži goste (naziv, email, telefon)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Naziv</TableCell>
                <TableCell>Ime i prezime</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Telefon</TableCell>
                <TableCell>Napomena</TableCell>
                <TableCell align="right">Akcije</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {gosti.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary">
                      {searchQuery ? 'Nema rezultata pretrage' : 'Nema gostiju'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                gosti.map((gost) => (
                  <TableRow key={gost.id} hover>
                    <TableCell>{gost.id}</TableCell>
                    <TableCell>{gost.naziv}</TableCell>
                    <TableCell>{gost.ime_prezime || '-'}</TableCell>
                    <TableCell>{gost.email || '-'}</TableCell>
                    <TableCell>{gost.telefon || '-'}</TableCell>
                    <TableCell>{gost.napomena ? gost.napomena.substring(0, 30) + (gost.napomena.length > 30 ? '...' : '') : '-'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleOpenDialog(gost)} color="primary">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteClick(gost)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingGost ? 'Uredi gosta' : 'Dodaj novog gosta'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Controller
                name="naziv"
                control={control}
                rules={{ required: 'Naziv je obavezan' }}
                render={({ field }) => (
                  <TextField {...field} label="Naziv / Firma" fullWidth error={!!errors.naziv} helperText={errors.naziv?.message} />
                )}
              />

              <Controller
                name="ime_prezime"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Ime i prezime"
                    fullWidth
                    helperText={!field.value && nazivValue ? `Auto: "${nazivValue}"` : ''}
                  />
                )}
              />

              <Controller
                name="email"
                control={control}
                rules={{
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Nevažeća email adresa'
                  }
                }}
                render={({ field }) => (
                  <TextField 
                    {...field} 
                    label="Email" 
                    type="email" 
                    fullWidth 
                    error={!!errors.email} 
                    helperText={errors.email?.message} 
                  />
                )}
              />

              <Controller
                name="telefon"
                control={control}
                render={({ field }) => (
                  <TextField 
                    {...field} 
                    label="Telefon" 
                    fullWidth 
                  />
                )}
              />

              <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
                Obavezno je unijeti <strong>Email ILI Telefon</strong> (bar jedno od dva polja)
              </Alert>

              <Controller
                name="napomena"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Napomena (opcionalno)" multiline rows={3} fullWidth />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Odustani</Button>
            <Button type="submit" variant="contained">{editingGost ? 'Spremi' : 'Dodaj'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Potvrda brisanja</DialogTitle>
        <DialogContent>
          <Typography>Jeste li sigurni da želite obrisati gosta <strong>{gostToDelete?.naziv}</strong>?</Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>Ova akcija se ne može poništiti!</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Odustani</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Obriši</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
