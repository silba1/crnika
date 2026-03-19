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
  Autocomplete,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { format, differenceInDays } from 'date-fns';
import api from '../services/api';
import type { Rezervacija, Apartman, Gost } from '../types';
import { useAuthStore } from '../store/authStore';
import logger from '../utils/logger';

interface RezervacijaFormData {
  apartman_id: number;
  gost_id: number;
  od_datuma: string;
  do_datuma: string;
  cijena: number;
  status: 'na_čekanju' | 'potvrđena' | 'otkazana';
  napomena: string;
}

export default function RezervacijePage() {
  const { user } = useAuthStore();
  const [rezervacije, setRezervacije] = useState<Rezervacija[]>([]);
  const [apartmani, setApartmani] = useState<Apartman[]>([]);
  const [gosti, setGosti] = useState<Gost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRezervacija, setEditingRezervacija] = useState<Rezervacija | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rezervacijaToDelete, setRezervacijaToDelete] = useState<Rezervacija | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  
  // Quick add gost
  const [quickAddGostOpen, setQuickAddGostOpen] = useState(false);
  const [newGostNaziv, setNewGostNaziv] = useState('');
  const [newGostImePrezime, setNewGostImePrezime] = useState('');
  const [newGostEmail, setNewGostEmail] = useState('');
  const [newGostTelefon, setNewGostTelefon] = useState('');
  const [newGostNapomena, setNewGostNapomena] = useState('');
  const [autocompleteInputValue, setAutocompleteInputValue] = useState('');
  
  const [filterApartman, setFilterApartman] = useState<number | ''>('');

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<RezervacijaFormData>({
    defaultValues: {
      apartman_id: 0,
      gost_id: 0,
      od_datuma: format(new Date(), 'yyyy-MM-dd'),
      do_datuma: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      cijena: 0,
      status: 'na_čekanju',
      napomena: '',
    }
  });

  const odDatumaValue = watch('od_datuma');
  const doDatumaValue = watch('do_datuma');

  useEffect(() => {
    loadData();
  }, [filterApartman]);

  useEffect(() => {
    if (odDatumaValue && doDatumaValue) {
      const nights = differenceInDays(new Date(doDatumaValue), new Date(odDatumaValue));
      if (nights > 0) {
        setValue('cijena', nights * 50);
      }
    }
  }, [odDatumaValue, doDatumaValue, setValue]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      logger.log('🔄 RezervacijePage: Loading data...');
      
      const [rezervacijeData, apartmaniData, gostiData] = await Promise.all([
        api.getRezervacije(0, 100, filterApartman || undefined),
        api.getApartmani(),
        api.getGosti(),
      ]);
      
      logger.log('📦 Loaded data:', {
        rezervacije: rezervacijeData.length,
        apartmani: apartmaniData.length,
        gosti: gostiData.length
      });
      
      setRezervacije(rezervacijeData);
      setApartmani(apartmaniData);
      setGosti(gostiData);
    } catch (err: any) {
      logger.error('❌ Error loading data:', err);
      setError(err.response?.data?.detail || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (rezervacija?: Rezervacija) => {
    logger.log('Opening dialog, apartmani count:', apartmani.length);
    
    if (rezervacija) {
      setEditingRezervacija(rezervacija);
      reset({
        apartman_id: rezervacija.apartman_id,
        gost_id: rezervacija.gost_id,
        od_datuma: rezervacija.od_datuma,
        do_datuma: rezervacija.do_datuma,
        cijena: rezervacija.cijena,
        status: rezervacija.status as any,
        napomena: rezervacija.napomena || '',
      });
    } else {
      setEditingRezervacija(null);
      const defaultApartmanId = apartmani.length > 0 ? apartmani[0].id! : 0;
      
      reset({
        apartman_id: defaultApartmanId,
        gost_id: 0,
        od_datuma: format(new Date(), 'yyyy-MM-dd'),
        do_datuma: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        cijena: 350,
        status: 'na_čekanju',
        napomena: '',
      });
      setAutocompleteInputValue('');
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRezervacija(null);
    setDialogError(null);
    reset();
  };

  const onSubmit = async (data: RezervacijaFormData) => {
    try {
      setDialogError(null);
      
      if (new Date(data.do_datuma) <= new Date(data.od_datuma)) {
        setDialogError('Datum odlaska mora biti nakon datuma dolaska');
        return;
      }
      
      const submitData: Rezervacija = {
        apartman_id: Number(data.apartman_id),
        gost_id: Number(data.gost_id),
        od_datuma: data.od_datuma,
        do_datuma: data.do_datuma,
        cijena: Number(data.cijena),
        status: data.status,
        napomena: data.napomena.trim() || null,
      };

      if (editingRezervacija) {
        await api.updateRezervacija(editingRezervacija.id!, submitData);
        setSuccess('Rezervacija uspješno ažurirana!');
      } else {
        await api.createRezervacija(submitData);
        setSuccess('Rezervacija uspješno kreirana!');
      }

      handleCloseDialog();
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setDialogError(err.response?.data?.detail || 'Greška pri spremanju rezervacije');
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
      
      const gostiData = await api.getGosti();
      setGosti(gostiData);
      
      setValue('gost_id', newGost.id!);
      setAutocompleteInputValue(newGost.naziv);
      
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
      await api.updateApartmanRezervacijaStatus(id, newStatus);
      setSuccess(`Status promijenjen u: ${newStatus}`);
      loadData();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError('Greška pri promjeni statusa');
    }
  };

  const handleDeleteClick = (rezervacija: Rezervacija) => {
    setRezervacijaToDelete(rezervacija);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!rezervacijaToDelete) return;

    try {
      setError(null);
      await api.deleteRezervacija(rezervacijaToDelete.id!);
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

  const getApartmanName = (id: number) => apartmani.find(a => a.id === id)?.ime || `ID: ${id}`;
  const getGostName = (id: number) => gosti.find(g => g.id === id)?.naziv || `ID: ${id}`;

  const getStatusColor = (status: string): 'warning' | 'success' | 'error' | 'default' => {
    switch (status) {
      case 'na_čekanju': return 'warning';
      case 'potvrđena': return 'success';
      case 'otkazana': return 'error';
      default: return 'default';
    }
  };

  const calculateNights = (odDatuma: string, doDatuma: string) => {
    return differenceInDays(new Date(doDatuma), new Date(odDatuma));
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
          <Typography variant="h4">Rezervacije Apartmana</Typography>
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

        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth size="small" sx={{ maxWidth: 300 }}>
            <InputLabel>Filtriraj po apartmanu</InputLabel>
            <Select value={filterApartman} onChange={(e) => setFilterApartman(e.target.value as number)} label="Filtriraj po apartmanu">
              <MenuItem value=""><em>Svi apartmani</em></MenuItem>
              {apartmani.map(a => (
                <MenuItem key={a.id} value={a.id}>{a.ime}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Apartman</TableCell>
                <TableCell>Gost</TableCell>
                <TableCell>Dolazak</TableCell>
                <TableCell>Odlazak</TableCell>
                <TableCell>Noćenja</TableCell>
                <TableCell>Cijena</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Napomena</TableCell>
                <TableCell align="right">Akcije</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rezervacije.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography variant="body2" color="text.secondary">Nema rezervacija</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rezervacije.map((rez) => (
                  <TableRow key={rez.id} hover>
                    <TableCell>{rez.id}</TableCell>
                    <TableCell>{getApartmanName(rez.apartman_id)}</TableCell>
                    <TableCell>{getGostName(rez.gost_id)}</TableCell>
                    <TableCell>{rez.od_datuma}</TableCell>
                    <TableCell>{rez.do_datuma}</TableCell>
                    <TableCell>{calculateNights(rez.od_datuma, rez.do_datuma)}</TableCell>
                    <TableCell>{rez.cijena.toFixed(2)} €</TableCell>
                    <TableCell>
                      <Chip label={rez.status} color={getStatusColor(rez.status)} size="small" />
                    </TableCell>
                    <TableCell>{rez.napomena ? rez.napomena.substring(0, 30) + (rez.napomena.length > 30 ? '...' : '') : '-'}</TableCell>
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
                      <IconButton size="small" onClick={() => handleOpenDialog(rez)} color="primary" sx={{ mr: 1 }}>
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
                name="apartman_id"
                control={control}
                rules={{ required: 'Apartman je obavezan' }}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.apartman_id}>
                    <InputLabel>Apartman</InputLabel>
                    <Select {...field} label="Apartman" value={field.value || ''} onChange={(e) => field.onChange(Number(e.target.value))}>
                      {apartmani.length === 0 ? (
                        <MenuItem value="" disabled>
                          <em>Nema apartmana - dodajte prvo apartman</em>
                        </MenuItem>
                      ) : (
                        apartmani.map(a => (
                          <MenuItem key={a.id} value={a.id}>{a.ime} (kapacitet: {a.kapacitet})</MenuItem>
                        ))
                      )}
                    </Select>
                    {apartmani.length === 0 && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                        Molimo dodajte apartmane prije kreiranja rezervacije
                      </Typography>
                    )}
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
                    e.preventDefault();
                    const currentValue = autocompleteInputValue;
                    setNewGostNaziv(currentValue || '');
                    setQuickAddGostOpen(true);
                  }}
                  sx={{ whiteSpace: 'nowrap' }}
                  title="Dodaj novog gosta"
                >
                  Dodaj gosta
                </Button>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Controller
                    name="od_datuma"
                    control={control}
                    rules={{ required: 'Datum dolaska je obavezan' }}
                    render={({ field }) => (
                      <TextField {...field} label="Dolazak (check-in)" type="date" fullWidth InputLabelProps={{ shrink: true }} error={!!errors.od_datuma} />
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Controller
                    name="do_datuma"
                    control={control}
                    rules={{ required: 'Datum odlaska je obavezan' }}
                    render={({ field }) => (
                      <TextField {...field} label="Odlazak (check-out)" type="date" fullWidth InputLabelProps={{ shrink: true }} error={!!errors.do_datuma} />
                    )}
                  />
                </Grid>
              </Grid>

              {odDatumaValue && doDatumaValue && (
                <Alert severity="info">
                  Broj noćenja: <strong>{calculateNights(odDatumaValue, doDatumaValue)}</strong>
                </Alert>
              )}

              <Controller
                name="cijena"
                control={control}
                rules={{ required: 'Cijena je obavezna', min: { value: 0, message: 'Cijena mora biti pozitivna' } }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Ukupna cijena"
                    type="number"
                    fullWidth
                    error={!!errors.cijena}
                    helperText={errors.cijena?.message || 'Auto-kalkulirano: noćenja × 50€'}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    InputProps={{ endAdornment: '€' }}
                  />
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
                  <TextField {...field} label="Napomena (opcionalno)" multiline rows={3} fullWidth />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Odustani</Button>
            <Button type="submit" variant="contained">
              {editingRezervacija ? 'Spremi' : 'Dodaj'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Potvrda brisanja</DialogTitle>
        <DialogContent>
          <Typography>Jeste li sigurni da želite obrisati rezervaciju?</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Gost: <strong>{rezervacijaToDelete && getGostName(rezervacijaToDelete.gost_id)}</strong><br />
            Apartman: <strong>{rezervacijaToDelete && getApartmanName(rezervacijaToDelete.apartman_id)}</strong>
          </Typography>
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
