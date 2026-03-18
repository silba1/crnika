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
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { format } from 'date-fns';
import api from '../services/api';
import type { StoloviRezervacija, Restoran, Gost } from '../types';
import { useAuthStore } from '../store/authStore';

interface RezervacijaFormData {
  restoran_id: number;
  gost_id: number;
  datum: string;
  od_vremena: string;
  do_vremena: string;
  broj_osoba: number;
  status: 'na_čekanju' | 'potvrđena' | 'otkazana';
  napomena: string;
}

export default function StoloviRezervacijePage() {
  const { user } = useAuthStore();
  const [rezervacije, setRezervacije] = useState<StoloviRezervacija[]>([]);
  const [restorani, setRestorani] = useState<Restoran[]>([]);
  const [gosti, setGosti] = useState<Gost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRezervacija, setEditingRezervacija] = useState<StoloviRezervacija | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rezervacijaToDelete, setRezervacijaToDelete] = useState<StoloviRezervacija | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);  // Error inside dialog
  
  // Quick add gost
  const [quickAddGostOpen, setQuickAddGostOpen] = useState(false);
  const [newGostNaziv, setNewGostNaziv] = useState('');
  const [newGostImePrezime, setNewGostImePrezime] = useState('');
  const [newGostEmail, setNewGostEmail] = useState('');
  const [newGostTelefon, setNewGostTelefon] = useState('');
  const [newGostNapomena, setNewGostNapomena] = useState('');
  const [autocompleteInputValue, setAutocompleteInputValue] = useState('');  // Track typed value
  
  // Filters
  const [filterRestoran, setFilterRestoran] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<RezervacijaFormData>({
    defaultValues: {
      restoran_id: 0,
      gost_id: 0,
      datum: format(new Date(), 'yyyy-MM-dd'),
      od_vremena: '12:00',
      do_vremena: '14:00',
      broj_osoba: 2,
      status: 'na_čekanju',
      napomena: '',
    }
  });

  const restoranIdValue = watch('restoran_id');
  const odVremenaValue = watch('od_vremena');

  useEffect(() => {
    loadData();
  }, [filterRestoran, filterStatus]);

  // Auto-set do_vremena to +3h when od_vremena changes
  useEffect(() => {
    if (odVremenaValue && !editingRezervacija) {  // Only for new reservations
      const [hours, minutes] = odVremenaValue.split(':').map(Number);
      const endHours = (hours + 3) % 24;  // +3 hours, wrap at 24
      const endTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      setValue('do_vremena', endTime);
    }
  }, [odVremenaValue, editingRezervacija, setValue]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rezervacijeData, restoraniData, gostiData] = await Promise.all([
        api.getStoloviRezervacije(0, 100, filterRestoran || undefined, filterStatus || undefined),
        api.getRestorani(),
        api.getGosti(),
      ]);
      setRezervacije(rezervacijeData);
      setRestorani(restoraniData);
      setGosti(gostiData);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (rezervacija?: StoloviRezervacija) => {
    if (rezervacija) {
      setEditingRezervacija(rezervacija);
      reset({
        restoran_id: rezervacija.restoran_id,
        gost_id: rezervacija.gost_id,
        datum: rezervacija.datum,
        od_vremena: rezervacija.od_vremena,
        do_vremena: rezervacija.do_vremena,
        broj_osoba: rezervacija.broj_osoba,
        status: rezervacija.status as any,
        napomena: rezervacija.napomena || '',
      });
    } else {
      setEditingRezervacija(null);
      reset({
        restoran_id: restorani.length > 0 ? restorani[0].id! : 0,
        gost_id: 0,  // Empty - user must select
        datum: format(new Date(), 'yyyy-MM-dd'),
        od_vremena: '12:00',
        do_vremena: '14:00',
        broj_osoba: 2,
        status: 'na_čekanju',
        napomena: '',
      });
      setAutocompleteInputValue('');  // Clear autocomplete input
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRezervacija(null);
    setDialogError(null);  // Clear dialog error
    reset();
  };

  const onSubmit = async (data: RezervacijaFormData) => {
    try {
      setDialogError(null);  // Clear dialog error
      
      const submitData: StoloviRezervacija = {
        restoran_id: Number(data.restoran_id),
        gost_id: Number(data.gost_id),
        datum: data.datum,
        od_vremena: data.od_vremena,
        do_vremena: data.do_vremena,
        broj_osoba: Number(data.broj_osoba),
        status: data.status,
        napomena: data.napomena.trim() || null,
      };

      // Check availability before submitting
      try {
        const availabilityCheck = await api.checkStoloviAvailability(
          submitData.restoran_id,
          submitData.datum,
          submitData.od_vremena,
          submitData.do_vremena,
          submitData.broj_osoba,
          editingRezervacija?.id  // Exclude current reservation when editing
        );

        if (!availabilityCheck.available) {
          setDialogError(availabilityCheck.message);  // Show in dialog
          return;
        }
      } catch (err: any) {
        setDialogError(err.response?.data?.detail || 'Greška pri provjeri dostupnosti');  // Show in dialog
        return;
      }

      if (editingRezervacija) {
        // Update full reservation
        await api.updateStoloviRezervacija(editingRezervacija.id!, submitData);
        setSuccess('Rezervacija uspješno ažurirana!');
      } else {
        await api.createStoloviRezervacija(submitData);
        setSuccess('Rezervacija uspješno kreirana!');
      }

      handleCloseDialog();
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setDialogError(err.response?.data?.detail || 'Greška pri spremanju rezervacije');  // Show in dialog
    }
  };

  const handleQuickAddGost = async () => {
    if (!newGostNaziv.trim()) return;
    
    try {
      const newGost = await api.createGost({
        vlasnik_id: user?.id || 0,
        naziv: newGostNaziv.trim(),
        ime_prezime: newGostImePrezime.trim() || null,
        email: newGostEmail.trim() || null,
        telefon: newGostTelefon.trim() || null,
        napomena: newGostNapomena.trim() || null,
      });
      
      // Reload gosti
      const gostiData = await api.getGosti();
      setGosti(gostiData);
      
      // Auto-select new gost
      setValue('gost_id', newGost.id!);
      setAutocompleteInputValue(newGost.naziv);  // Update autocomplete display
      
      // Close dialog and clear form
      setQuickAddGostOpen(false);
      setNewGostNaziv('');
      setNewGostImePrezime('');
      setNewGostEmail('');
      setNewGostTelefon('');
      setNewGostNapomena('');
      
      setSuccess('Gost uspješno dodan!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError('Greška pri dodavanju gosta');
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await api.updateRezervacijaStatus(id, newStatus);
      setSuccess(`Status promijenjen u: ${newStatus}`);
      loadData();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError('Greška pri promjeni statusa');
    }
  };

  const handleDeleteClick = (rezervacija: StoloviRezervacija) => {
    setRezervacijaToDelete(rezervacija);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!rezervacijaToDelete) return;

    try {
      setError(null);
      await api.deleteStoloviRezervacija(rezervacijaToDelete.id!);
      setSuccess('Rezervacija uspješno obrisana!');
      setDeleteDialogOpen(false);
      setRezervacijaToDelete(null);
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri brisanju rezervacije');
      setDeleteDialogOpen(false);
    }
  };

  const getRestoranName = (id: number) => restorani.find(r => r.id === id)?.ime || `ID: ${id}`;
  const getGostName = (id: number) => gosti.find(g => g.id === id)?.naziv || `ID: ${id}`;

  const getStatusColor = (status: string): 'warning' | 'success' | 'error' | 'default' => {
    switch (status) {
      case 'na_čekanju': return 'warning';
      case 'potvrđena': return 'success';
      case 'otkazana': return 'error';
      default: return 'default';
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
          <Typography variant="h4">Rezervacije Stolova</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Nova rezervacija
          </Button>
        </Box>

        {error && typeof error === 'string' && error.trim() && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
        )}

        {success && typeof success === 'string' && success.trim() && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>
        )}

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Filtriraj po restoranu</InputLabel>
              <Select value={filterRestoran} onChange={(e) => setFilterRestoran(e.target.value as number)} label="Filtriraj po restoranu">
                <MenuItem value=""><em>Svi restorani</em></MenuItem>
                {restorani.map(r => (
                  <MenuItem key={r.id} value={r.id}>{r.ime}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Filtriraj po statusu</InputLabel>
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} label="Filtriraj po statusu">
                <MenuItem value=""><em>Svi statusi</em></MenuItem>
                <MenuItem value="na_čekanju">Na čekanju</MenuItem>
                <MenuItem value="potvrđena">Potvrđena</MenuItem>
                <MenuItem value="otkazana">Otkazana</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Restoran</TableCell>
                <TableCell>Gost</TableCell>
                <TableCell>Datum</TableCell>
                <TableCell>Vrijeme</TableCell>
                <TableCell>Osobe</TableCell>
                <TableCell>Obrok</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Akcije</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rezervacije.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary">Nema rezervacija</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rezervacije.map((rez) => (
                  <TableRow key={rez.id} hover>
                    <TableCell>{rez.id}</TableCell>
                    <TableCell>{getRestoranName(rez.restoran_id)}</TableCell>
                    <TableCell>{getGostName(rez.gost_id)}</TableCell>
                    <TableCell>{rez.datum}</TableCell>
                    <TableCell>{rez.od_vremena} - {rez.do_vremena}</TableCell>
                    <TableCell>{rez.broj_osoba}</TableCell>
                    <TableCell>
                      <Chip label={rez.status} color={getStatusColor(rez.status)} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      {rez.status === 'na_čekanju' && (
                        <>
                          <IconButton size="small" onClick={() => handleStatusChange(rez.id!, 'potvrđena')} color="success" title="Potvrdi">
                            <CheckIcon />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleStatusChange(rez.id!, 'otkazana')} color="error" title="Otkaži">
                            <CloseIcon />
                          </IconButton>
                        </>
                      )}
                      <IconButton size="small" onClick={() => handleOpenDialog(rez)} color="primary">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteClick(rez)} color="error">
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
        <DialogTitle>{editingRezervacija ? 'Uredi rezervaciju' : 'Nova rezervacija'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDialogError(null)}>
                {dialogError}
              </Alert>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Controller
                name="restoran_id"
                control={control}
                rules={{ required: 'Restoran je obavezan' }}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.restoran_id}>
                    <InputLabel>Restoran</InputLabel>
                    <Select {...field} label="Restoran" value={field.value || ''} onChange={(e) => field.onChange(Number(e.target.value))}>
                      {restorani.map(r => (
                        <MenuItem key={r.id} value={r.id}>{r.ime}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Controller
                  name="gost_id"
                  control={control}
                  rules={{ required: 'Gost je obavezan' }}
                  render={({ field }) => (
                    <Autocomplete
                      fullWidth
                      options={gosti}
                      getOptionLabel={(option) => option.naziv}
                      value={gosti.find(g => g.id === field.value) || null}
                      onChange={(_, newValue) => {
                        field.onChange(newValue?.id || 0);
                        if (newValue) {
                          setAutocompleteInputValue(newValue.naziv);
                        }
                      }}
                      inputValue={autocompleteInputValue}
                      onInputChange={(_, newInputValue, reason) => {
                        setAutocompleteInputValue(newInputValue);
                        // Clear gost_id if user types something different
                        if (reason === 'input') {
                          field.onChange(0);
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Gost"
                          placeholder="Tipkajte ili odaberite..."
                          error={!!errors.gost_id}
                          helperText={errors.gost_id?.message}
                        />
                      )}
                      noOptionsText="Nema gostiju - dodajte novog"
                      isOptionEqualToValue={(option, value) => option.id === value?.id}
                    />
                  )}
                />
                <Button
                  variant="contained"
                  onMouseDown={(e) => {
                    e.preventDefault();  // Prevent blur
                    const currentValue = autocompleteInputValue;
                    setNewGostNaziv(currentValue || '');  // Pre-fill from typed value
                    setQuickAddGostOpen(true);
                  }}
                  sx={{ whiteSpace: 'nowrap' }}
                  title="Dodaj novog gosta"
                >
                  Dodaj gosta
                </Button>
              </Box>

              <Controller
                name="datum"
                control={control}
                rules={{ required: 'Datum je obavezan' }}
                render={({ field }) => (
                  <TextField {...field} label="Datum" type="date" fullWidth InputLabelProps={{ shrink: true }} error={!!errors.datum} />
                )}
              />

              <Controller
                name="od_vremena"
                control={control}
                rules={{ required: 'Vrijeme je obavezno' }}
                render={({ field }) => (
                  <Box>
                    <TextField {...field} label="Vrijeme rezervacije (trajanje 3 sata)" type="time" fullWidth InputLabelProps={{ shrink: true }} />
                  </Box>
                )}
              />

              {/* Hidden field - auto-calculated */}
              <Controller
                name="do_vremena"
                control={control}
                render={({ field }) => (
                  <input type="hidden" {...field} />
                )}
              />

              <Controller
                name="broj_osoba"
                control={control}
                rules={{ required: 'Broj osoba je obavezan', min: { value: 1, message: 'Minimum 1 osoba' } }}
                render={({ field }) => (
                  <TextField {...field} label="Broj osoba" type="number" fullWidth error={!!errors.broj_osoba} helperText={errors.broj_osoba?.message} onChange={(e) => field.onChange(Number(e.target.value))} />
                )}
              />

              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select {...field} label="Status">
                      <MenuItem value="na_čekanju">Na čekanju</MenuItem>
                      <MenuItem value="potvrđena">Potvrđena</MenuItem>
                      <MenuItem value="otkazana">Otkazana</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />

              <Controller
                name="napomena"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Napomena (opcionalno)" multiline rows={2} fullWidth />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Odustani</Button>
            <Button type="submit" variant="contained">{editingRezervacija ? 'Spremi' : 'Dodaj'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Potvrda brisanja</DialogTitle>
        <DialogContent>
          <Typography>Jeste li sigurni da želite obrisati rezervaciju?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Odustani</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Obriši</Button>
        </DialogActions>
      </Dialog>

      {/* Quick Add Gost Dialog */}
      <Dialog open={quickAddGostOpen} onClose={() => setQuickAddGostOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Dodaj novog gosta</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              autoFocus
              label="Naziv gosta *"
              fullWidth
              value={newGostNaziv}
              onChange={(e) => setNewGostNaziv(e.target.value)}
              helperText="Obavezno polje"
            />
            <TextField
              label="Ime i prezime"
              fullWidth
              value={newGostImePrezime}
              onChange={(e) => setNewGostImePrezime(e.target.value)}
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={newGostEmail}
              onChange={(e) => setNewGostEmail(e.target.value)}
            />
            <TextField
              label="Telefon"
              fullWidth
              value={newGostTelefon}
              onChange={(e) => setNewGostTelefon(e.target.value)}
            />
            <TextField
              label="Napomena"
              fullWidth
              multiline
              rows={3}
              value={newGostNapomena}
              onChange={(e) => setNewGostNapomena(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickAddGostOpen(false)}>Odustani</Button>
          <Button onClick={handleQuickAddGost} variant="contained" disabled={!newGostNaziv.trim()}>
            Dodaj
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
