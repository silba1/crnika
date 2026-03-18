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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import api from '../services/api';
import type { Apartman, Vlasnik } from '../types';
import { useAuthStore } from '../store/authStore';

interface ApartmanFormData {
  vlasnik_id: number;
  ime: string;
  kapacitet: number;
  opis: string;
}

export default function ApartmaniPage() {
  const { user } = useAuthStore();
  const [apartmani, setApartmani] = useState<Apartman[]>([]);
  const [vlasnici, setVlasnici] = useState<Vlasnik[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingApartman, setEditingApartman] = useState<Apartman | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [apartmanToDelete, setApartmanToDelete] = useState<Apartman | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<ApartmanFormData>({
    defaultValues: {
      vlasnik_id: 0,
      ime: '',
      kapacitet: 1,
      opis: '',
    }
  });

  const isAdmin = user?.role === 'admin';
  const canEdit = isAdmin || user?.role === 'vlasnik'; // Admin ili Vlasnik mogu editirati

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [apartmaniData, vlasniciData] = await Promise.all([
        api.getApartmani(),
        isAdmin ? api.getVlasnici() : Promise.resolve([]),
      ]);
      setApartmani(apartmaniData);
      setVlasnici(vlasniciData);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (apartman?: Apartman) => {
    if (apartman) {
      setEditingApartman(apartman);
      reset({
        vlasnik_id: apartman.vlasnik_id,
        ime: apartman.ime,
        kapacitet: apartman.kapacitet,
        opis: apartman.opis,
      });
    } else {
      setEditingApartman(null);
      reset({
        vlasnik_id: isAdmin && vlasnici.length > 0 ? vlasnici[0].id! : user?.id || 0,
        ime: '',
        kapacitet: 1,
        opis: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingApartman(null);
    reset();
  };

  const onSubmit = async (data: ApartmanFormData) => {
    try {
      setError(null);
      
      const submitData: Apartman = {
        vlasnik_id: Number(data.vlasnik_id),
        ime: data.ime.trim(),
        kapacitet: Number(data.kapacitet),
        opis: data.opis.trim(),
      };

      if (editingApartman) {
        await api.updateApartman(editingApartman.id!, submitData);
        setSuccess('Apartman uspješno ažuriran!');
      } else {
        await api.createApartman(submitData);
        setSuccess('Apartman uspješno kreiran!');
      }

      handleCloseDialog();
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri spremanju apartmana');
    }
  };

  const handleDeleteClick = (apartman: Apartman) => {
    setApartmanToDelete(apartman);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!apartmanToDelete) return;

    try {
      setError(null);
      await api.deleteApartman(apartmanToDelete.id!);
      setSuccess('Apartman uspješno obrisan!');
      setDeleteDialogOpen(false);
      setApartmanToDelete(null);
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri brisanju apartmana');
      setDeleteDialogOpen(false);
    }
  };

  const getVlasnikName = (vlasnikId: number) => {
    const vlasnik = vlasnici.find(v => v.id === vlasnikId);
    return vlasnik ? vlasnik.ime : `ID: ${vlasnikId}`;
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
          <Typography variant="h4">Apartmani</Typography>
          {canEdit && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
              Dodaj apartman
            </Button>
          )}
        </Box>

        {error && typeof error === 'string' && error.trim() && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
        )}

        {success && typeof success === 'string' && success.trim() && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>
        )}

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Naziv</TableCell>
                <TableCell>Vlasnik</TableCell>
                <TableCell>Kapacitet</TableCell>
                <TableCell>Opis</TableCell>
                <TableCell align="right">Akcije</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apartmani.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary">Nema apartmana</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                apartmani.map((apartman) => (
                  <TableRow key={apartman.id} hover>
                    <TableCell>{apartman.id}</TableCell>
                    <TableCell>{apartman.ime}</TableCell>
                    <TableCell>{isAdmin ? getVlasnikName(apartman.vlasnik_id) : user?.ime}</TableCell>
                    <TableCell>{apartman.kapacitet}</TableCell>
                    <TableCell>{apartman.opis.substring(0, 50)}{apartman.opis.length > 50 ? '...' : ''}</TableCell>
                    <TableCell align="right">
                      {canEdit && (
                        <>
                          <IconButton size="small" onClick={() => handleOpenDialog(apartman)} color="primary">
                            <EditIcon />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeleteClick(apartman)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </>
                      )}
                      {!canEdit && (
                        <Typography variant="body2" color="text.secondary">
                          Samo pregled
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingApartman ? 'Uredi apartman' : 'Dodaj novi apartman'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              {isAdmin && (
                <Controller
                  name="vlasnik_id"
                  control={control}
                  rules={{ required: 'Vlasnik je obavezan' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.vlasnik_id}>
                      <InputLabel>Vlasnik</InputLabel>
                      <Select {...field} label="Vlasnik" value={field.value || ''} onChange={(e) => field.onChange(Number(e.target.value))}>
                        {vlasnici.map(v => (
                          <MenuItem key={v.id} value={v.id}>{v.ime} ({v.email})</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              )}

              <Controller
                name="ime"
                control={control}
                rules={{ required: 'Ime je obavezno' }}
                render={({ field }) => (
                  <TextField {...field} label="Naziv apartmana" fullWidth error={!!errors.ime} helperText={errors.ime?.message} />
                )}
              />

              <Controller
                name="kapacitet"
                control={control}
                rules={{
                  required: 'Kapacitet je obavezan',
                  min: { value: 1, message: 'Minimum 1 osoba' },
                  max: { value: 100, message: 'Maximum 100 osoba' }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Kapacitet (broj osoba)"
                    type="number"
                    fullWidth
                    error={!!errors.kapacitet}
                    helperText={errors.kapacitet?.message}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                )}
              />

              <Controller
                name="opis"
                control={control}
                rules={{ required: 'Opis je obavezan' }}
                render={({ field }) => (
                  <TextField {...field} label="Opis" multiline rows={4} fullWidth error={!!errors.opis} helperText={errors.opis?.message} />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Odustani</Button>
            <Button type="submit" variant="contained">{editingApartman ? 'Spremi' : 'Dodaj'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Potvrda brisanja</DialogTitle>
        <DialogContent>
          <Typography>Jeste li sigurni da želite obrisati apartman <strong>{apartmanToDelete?.ime}</strong>?</Typography>
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
