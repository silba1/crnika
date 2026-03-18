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
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import api from '../services/api';
import type { Restoran, Vlasnik } from '../types';
import { useAuthStore } from '../store/authStore';

interface RestoranFormData {
  vlasnik_id: number;
  ime: string;
  opis: string;
  rucak_od: string;
  rucak_do: string;
  vecera_od: string;
  vecera_do: string;
  max_osoba_rucak: number;
  max_osoba_vecera: number;
}

export default function RestoraniPage() {
  const { user } = useAuthStore();
  const [restorani, setRestorani] = useState<Restoran[]>([]);
  const [vlasnici, setVlasnici] = useState<Vlasnik[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRestoran, setEditingRestoran] = useState<Restoran | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [restoranToDelete, setRestoranToDelete] = useState<Restoran | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<RestoranFormData>({
    defaultValues: {
      vlasnik_id: 0,
      ime: '',
      opis: '',
      rucak_od: '12:00',
      rucak_do: '15:00',
      vecera_od: '18:00',
      vecera_do: '22:00',
      max_osoba_rucak: 50,
      max_osoba_vecera: 80,
    }
  });

  const isAdmin = user?.role === 'admin';
  const canEdit = isAdmin || user?.role === 'vlasnik';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [restoraniData, vlasniciData] = await Promise.all([
        api.getRestorani(),
        isAdmin ? api.getVlasnici() : Promise.resolve([]),
      ]);
      setRestorani(restoraniData);
      setVlasnici(vlasniciData);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (restoran?: Restoran) => {
    if (restoran) {
      setEditingRestoran(restoran);
      reset({
        vlasnik_id: restoran.vlasnik_id,
        ime: restoran.ime,
        opis: restoran.opis,
        rucak_od: restoran.rucak_od || '12:00',
        rucak_do: restoran.rucak_do || '15:00',
        vecera_od: restoran.vecera_od || '18:00',
        vecera_do: restoran.vecera_do || '22:00',
        max_osoba_rucak: restoran.max_osoba_rucak || 50,
        max_osoba_vecera: restoran.max_osoba_vecera || 80,
      });
    } else {
      setEditingRestoran(null);
      reset({
        vlasnik_id: isAdmin && vlasnici.length > 0 ? vlasnici[0].id! : user?.id || 0,
        ime: '',
        opis: '',
        rucak_od: '12:00',
        rucak_do: '15:00',
        vecera_od: '18:00',
        vecera_do: '22:00',
        max_osoba_rucak: 50,
        max_osoba_vecera: 80,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRestoran(null);
    reset();
  };

  const onSubmit = async (data: RestoranFormData) => {
    try {
      setError(null);
      
      const submitData: Restoran = {
        vlasnik_id: Number(data.vlasnik_id),
        ime: data.ime.trim(),
        opis: data.opis.trim(),
        rucak_od: data.rucak_od || null,
        rucak_do: data.rucak_do || null,
        vecera_od: data.vecera_od || null,
        vecera_do: data.vecera_do || null,
        max_osoba_rucak: data.max_osoba_rucak ? Number(data.max_osoba_rucak) : null,
        max_osoba_vecera: data.max_osoba_vecera ? Number(data.max_osoba_vecera) : null,
      };

      if (editingRestoran) {
        await api.updateRestoran(editingRestoran.id!, submitData);
        setSuccess('Restoran uspješno ažuriran!');
      } else {
        await api.createRestoran(submitData);
        setSuccess('Restoran uspješno kreiran!');
      }

      handleCloseDialog();
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri spremanju restorana');
    }
  };

  const handleDeleteClick = (restoran: Restoran) => {
    setRestoranToDelete(restoran);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!restoranToDelete) return;

    try {
      setError(null);
      await api.deleteRestoran(restoranToDelete.id!);
      setSuccess('Restoran uspješno obrisan!');
      setDeleteDialogOpen(false);
      setRestoranToDelete(null);
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri brisanju restorana');
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
          <Typography variant="h4">Restorani</Typography>
          {canEdit && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
              Dodaj restoran
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
                <TableCell>Ručak</TableCell>
                <TableCell>Večera</TableCell>
                <TableCell>Opis</TableCell>
                <TableCell align="right">Akcije</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {restorani.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary">Nema restorana</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                restorani.map((restoran) => (
                  <TableRow key={restoran.id} hover>
                    <TableCell>{restoran.id}</TableCell>
                    <TableCell>{restoran.ime}</TableCell>
                    <TableCell>{isAdmin ? getVlasnikName(restoran.vlasnik_id) : user?.ime}</TableCell>
                    <TableCell>
                      {restoran.rucak_od && restoran.rucak_do 
                        ? `${restoran.rucak_od} - ${restoran.rucak_do}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {restoran.vecera_od && restoran.vecera_do
                        ? `${restoran.vecera_od} - ${restoran.vecera_do}`
                        : '-'}
                    </TableCell>
                    <TableCell>{restoran.opis.substring(0, 40)}{restoran.opis.length > 40 ? '...' : ''}</TableCell>
                    <TableCell align="right">
                      {canEdit && (
                        <>
                          <IconButton size="small" onClick={() => handleOpenDialog(restoran)} color="primary">
                            <EditIcon />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeleteClick(restoran)} color="error">
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingRestoran ? 'Uredi restoran' : 'Dodaj novi restoran'}</DialogTitle>
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
                  <TextField {...field} label="Naziv restorana" fullWidth error={!!errors.ime} helperText={errors.ime?.message} />
                )}
              />

              <Controller
                name="opis"
                control={control}
                rules={{ required: 'Opis je obavezan' }}
                render={({ field }) => (
                  <TextField {...field} label="Opis" multiline rows={3} fullWidth error={!!errors.opis} helperText={errors.opis?.message} />
                )}
              />

              <Typography variant="subtitle1" sx={{ mt: 2 }}>Radno vrijeme - Ručak</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Controller
                    name="rucak_od"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} label="Od" type="time" fullWidth InputLabelProps={{ shrink: true }} />
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Controller
                    name="rucak_do"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} label="Do" type="time" fullWidth InputLabelProps={{ shrink: true }} />
                    )}
                  />
                </Grid>
              </Grid>

              <Controller
                name="max_osoba_rucak"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Max osoba (ručak)" type="number" fullWidth onChange={(e) => field.onChange(Number(e.target.value))} />
                )}
              />

              <Typography variant="subtitle1" sx={{ mt: 2 }}>Radno vrijeme - Večera</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Controller
                    name="vecera_od"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} label="Od" type="time" fullWidth InputLabelProps={{ shrink: true }} />
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Controller
                    name="vecera_do"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} label="Do" type="time" fullWidth InputLabelProps={{ shrink: true }} />
                    )}
                  />
                </Grid>
              </Grid>

              <Controller
                name="max_osoba_vecera"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Max osoba (večera)" type="number" fullWidth onChange={(e) => field.onChange(Number(e.target.value))} />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Odustani</Button>
            <Button type="submit" variant="contained">{editingRestoran ? 'Spremi' : 'Dodaj'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Potvrda brisanja</DialogTitle>
        <DialogContent>
          <Typography>Jeste li sigurni da želite obrisati restoran <strong>{restoranToDelete?.ime}</strong>?</Typography>
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
