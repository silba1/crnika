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
  InputAdornment,
  Checkbox,
  FormControlLabel,
  FormGroup,
  FormLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import api from '../services/api';
import type { Vlasnik, Modul } from '../types';
import { useAuthStore } from '../store/authStore';
import ManageZaposlenikPermissionsDialog from '../components/ManageZaposlenikPermissionsDialog';

interface VlasnikFormData {
  ime: string;
  email: string;
  lozinka: string;
  role: 'admin' | 'vlasnik' | 'zaposlenik';
  nadredeni_vlasnik_id?: number | null;
  modul_ids: number[];
}

export default function VlasniciPage() {
  const { user } = useAuthStore();
  const [vlasnici, setVlasnici] = useState<Vlasnik[]>([]);
  const [moduli, setModuli] = useState<Modul[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVlasnik, setEditingVlasnik] = useState<Vlasnik | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vlasnikToDelete, setVlasnikToDelete] = useState<Vlasnik | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedModuli, setSelectedModuli] = useState<number[]>([]);
  const [dialogError, setDialogError] = useState<string | null>(null);
  
  // Permissions dialog state
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedZaposlenik, setSelectedZaposlenik] = useState<Vlasnik | null>(null);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<VlasnikFormData>({
    defaultValues: {
      ime: '',
      email: '',
      lozinka: '',
      role: 'vlasnik',
      nadredeni_vlasnik_id: null,
      modul_ids: [],
    }
  });

  const watchRole = watch('role');

  useEffect(() => {
    loadData();
    loadModuli();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getVlasnici();
      setVlasnici(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  const loadModuli = async () => {
    try {
      if (user?.role === 'admin') {
        const data = await api.getModuli();
        setModuli(data);
      } else if (user?.role === 'vlasnik') {
        const data = await api.getVlasnikModuli(user.id);
        setModuli(data);
      }
    } catch (err) {
      console.error('Failed to load moduli:', err);
    }
  };

  const handleOpenDialog = async (vlasnik?: Vlasnik) => {
    setDialogError(null);
    if (vlasnik) {
      setEditingVlasnik(vlasnik);
      
      try {
        const vlasnikModuli = await api.getVlasnikModuli(vlasnik.id!);
        const modulIds = vlasnikModuli.map(m => m.id!);
        setSelectedModuli(modulIds);
        
        reset({
          ime: vlasnik.ime,
          email: vlasnik.email,
          lozinka: '',
          role: vlasnik.role,
          nadredeni_vlasnik_id: vlasnik.nadredeni_vlasnik_id || null,
          modul_ids: modulIds,
        });
      } catch (err) {
        console.error('Failed to load vlasnik moduli:', err);
        setSelectedModuli([]);
      }
    } else {
      setEditingVlasnik(null);
      setSelectedModuli([]);
      
      const defaultRole = user?.role === 'vlasnik' ? 'zaposlenik' : 'vlasnik';
      const defaultNadredeni = user?.role === 'vlasnik' ? user.id : null;
      
      reset({
        ime: '',
        email: '',
        lozinka: '',
        role: defaultRole as any,
        nadredeni_vlasnik_id: defaultNadredeni,
        modul_ids: [],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingVlasnik(null);
    setSelectedModuli([]);
    setShowPassword(false);
    setDialogError(null);
    reset();
  };

  const handleModulToggle = (modulId: number) => {
    const newSelected = selectedModuli.includes(modulId)
      ? selectedModuli.filter(id => id !== modulId)
      : [...selectedModuli, modulId];
    
    setSelectedModuli(newSelected);
    setValue('modul_ids', newSelected);
  };

  const onSubmit = async (data: VlasnikFormData) => {
    try {
      setDialogError(null);
      
      if (data.role !== 'admin' && selectedModuli.length === 0) {
        setDialogError('Morate odabrati bar jedan modul');
        return;
      }
      
      let finalNadredeni = data.nadredeni_vlasnik_id;
      if (user?.role === 'vlasnik' && data.role === 'zaposlenik') {
        finalNadredeni = user.id;
      }
      
      const submitData: any = {
        ime: data.ime.trim(),
        email: data.email.trim(),
        role: data.role,
        nadredeni_vlasnik_id: finalNadredeni !== null && finalNadredeni !== undefined 
          ? finalNadredeni 
          : null,
        modul_ids: data.role === 'admin' ? [] : selectedModuli,
      };

      if (editingVlasnik) {
        if (data.lozinka) {
          submitData.lozinka = data.lozinka;
        }
        await api.updateVlasnik(editingVlasnik.id!, submitData);
        setSuccess('Vlasnik uspješno ažuriran!');
        handleCloseDialog();
        loadData();
      } else {
        if (!data.lozinka || data.lozinka.length < 6) {
          setDialogError('Lozinka je obavezna i mora imati najmanje 6 znakova');
          return;
        }
        submitData.lozinka = data.lozinka;
        await api.createVlasnik(submitData);
        setSuccess('Vlasnik uspješno kreiran!');
        handleCloseDialog();
        loadData();
      }
    } catch (err: any) {
      setDialogError(err.response?.data?.detail || 'Greška pri spremanju');
    }
  };

  const handleDeleteClick = (vlasnik: Vlasnik) => {
    setVlasnikToDelete(vlasnik);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!vlasnikToDelete) return;

    try {
      setError(null);
      await api.deleteVlasnik(vlasnikToDelete.id!);
      setSuccess('Vlasnik uspješno obrisan!');
      setDeleteDialogOpen(false);
      setVlasnikToDelete(null);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri brisanju');
      setDeleteDialogOpen(false);
    }
  };

  const handleManagePermissions = (zaposlenik: Vlasnik) => {
    setSelectedZaposlenik(zaposlenik);
    setPermissionsDialogOpen(true);
  };

  const handlePermissionsSuccess = () => {
    setSuccess('Pristup uspješno ažuriran!');
    loadData();
    setTimeout(() => setSuccess(null), 3000);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'vlasnik': return 'Vlasnik';
      case 'zaposlenik': return 'Zaposlenik';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'vlasnik': return 'primary';
      case 'zaposlenik': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const potentialNadredeni = vlasnici.filter(v => v.role === 'vlasnik');

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">
            {user?.role === 'vlasnik' ? 'Moji zaposlenici' : 'Vlasnici'}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            {user?.role === 'vlasnik' ? 'Dodaj zaposlenika' : 'Dodaj vlasnika'}
          </Button>
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
                <TableCell>Ime</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Uloga</TableCell>
                <TableCell>Moduli</TableCell>
                <TableCell>Nadređeni</TableCell>
                <TableCell align="right">Akcije</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vlasnici.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary">Nema vlasnika</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                vlasnici.map((vlasnik) => (
                  <TableRow key={vlasnik.id} hover>
                    <TableCell>{vlasnik.id}</TableCell>
                    <TableCell>{vlasnik.ime}</TableCell>
                    <TableCell>{vlasnik.email}</TableCell>
                    <TableCell>
                      <Chip 
                        label={getRoleLabel(vlasnik.role)} 
                        color={getRoleColor(vlasnik.role) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {vlasnik.role === 'admin' ? (
                        <Chip label="Svi moduli" size="small" color="error" />
                      ) : (
                        vlasnik.moduli && vlasnik.moduli.length > 0 ? (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {vlasnik.moduli.map(mod => (
                              <Chip 
                                key={mod} 
                                label={mod} 
                                size="small" 
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      {vlasnik.nadredeni_vlasnik_id ? (
                        vlasnici.find(v => v.id === vlasnik.nadredeni_vlasnik_id)?.ime || '-'
                      ) : '-'}
                    </TableCell>
                    <TableCell align="right">
                      {vlasnik.role === 'zaposlenik' && (
                        <IconButton 
                          size="small" 
                          onClick={() => handleManagePermissions(vlasnik)} 
                          color="secondary"
                          title="Upravlja pristupom"
                        >
                          <SecurityIcon />
                        </IconButton>
                      )}
                      <IconButton size="small" onClick={() => handleOpenDialog(vlasnik)} color="primary">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteClick(vlasnik)} color="error">
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingVlasnik ? 'Uredi vlasnika' : 'Dodaj novog vlasnika'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDialogError(null)}>
                {dialogError}
              </Alert>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Controller
                name="ime"
                control={control}
                rules={{ required: 'Ime je obavezno' }}
                render={({ field }) => (
                  <TextField 
                    {...field} 
                    label="Ime" 
                    fullWidth 
                    error={!!errors.ime} 
                    helperText={errors.ime?.message} 
                  />
                )}
              />

              <Controller
                name="email"
                control={control}
                rules={{ 
                  required: 'Email je obavezan',
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
                name="lozinka"
                control={control}
                rules={editingVlasnik ? {} : { 
                  required: 'Lozinka je obavezna',
                  minLength: { value: 6, message: 'Lozinka mora imati najmanje 6 znakova' }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={editingVlasnik ? 'Lozinka (ostavi prazno da ne mijenjаš)' : 'Lozinka'}
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    error={!!errors.lozinka}
                    helperText={errors.lozinka?.message}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                            {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />

              {user?.role === 'admin' ? (
                <Controller
                  name="role"
                  control={control}
                  rules={{ required: 'Uloga je obavezna' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.role}>
                      <InputLabel>Uloga</InputLabel>
                      <Select {...field} label="Uloga">
                        <MenuItem value="admin">Admin</MenuItem>
                        <MenuItem value="vlasnik">Vlasnik</MenuItem>
                        <MenuItem value="zaposlenik">Zaposlenik</MenuItem>
                      </Select>
                      {errors.role && <Typography variant="caption" color="error">{errors.role.message}</Typography>}
                    </FormControl>
                  )}
                />
              ) : (
                <TextField
                  label="Uloga"
                  value="Zaposlenik"
                  disabled
                  fullWidth
                  helperText="Vlasnik može kreirati samo zaposlenike"
                />
              )}

              {watchRole === 'zaposlenik' && user?.role === 'admin' && (
                <Controller
                  name="nadredeni_vlasnik_id"
                  control={control}
                  rules={{ required: 'Nadređeni vlasnik je obavezan za zaposlenika' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.nadredeni_vlasnik_id}>
                      <InputLabel>Nadređeni vlasnik</InputLabel>
                      <Select 
                        {...field} 
                        label="Nadređeni vlasnik"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      >
                        <MenuItem value="">
                          <em>Odaberi vlasnika</em>
                        </MenuItem>
                        {potentialNadredeni.map((v) => (
                          <MenuItem key={v.id} value={v.id}>
                            {v.ime} ({v.email})
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.nadredeni_vlasnik_id && (
                        <Typography variant="caption" color="error">
                          {errors.nadredeni_vlasnik_id.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              )}
              
              {watchRole === 'zaposlenik' && user?.role === 'vlasnik' && (
                <Alert severity="info">
                  Zaposlenik će biti dodijeljen vama kao nadređeni vlasnik
                </Alert>
              )}

              {watchRole !== 'admin' && (
                <FormControl component="fieldset" fullWidth>
                  <FormLabel component="legend">
                    Moduli (odaberite bar jedan):
                  </FormLabel>
                  <FormGroup>
                    {moduli.map((modul) => (
                      <FormControlLabel
                        key={modul.id}
                        control={
                          <Checkbox
                            checked={selectedModuli.includes(modul.id!)}
                            onChange={() => handleModulToggle(modul.id!)}
                          />
                        }
                        label={modul.naziv.charAt(0).toUpperCase() + modul.naziv.slice(1)}
                      />
                    ))}
                  </FormGroup>
                  {selectedModuli.length === 0 && (
                    <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                      Morate odabrati bar jedan modul
                    </Typography>
                  )}
                </FormControl>
              )}

              {watchRole === 'admin' && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Admin automatski dobiva pristup svim modulima
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Odustani</Button>
            <Button type="submit" variant="contained">
              {editingVlasnik ? 'Spremi' : 'Dodaj'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Potvrda brisanja</DialogTitle>
        <DialogContent>
          <Typography>
            Jeste li sigurni da želite obrisati vlasnika <strong>{vlasnikToDelete?.ime}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Odustani</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Obriši
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Permissions Dialog */}
      {selectedZaposlenik && (
        <ManageZaposlenikPermissionsDialog
          open={permissionsDialogOpen}
          onClose={() => setPermissionsDialogOpen(false)}
          zaposlenik={selectedZaposlenik}
          onSuccess={handlePermissionsSuccess}
        />
      )}
    </Container>
  );
}
