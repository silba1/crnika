import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import { Vlasnik, Restoran, Apartman } from '../types';
import { api } from '../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
  zaposlenik: Vlasnik;
  onSuccess: () => void;
}

interface PermissionRow {
  objekt_type: 'restoran' | 'apartman';
  objekt_id: number;
  objekt_name: string;
  can_view: boolean;
  can_edit: boolean;
  can_create: boolean;
  can_delete: boolean;
}

export default function ManageZaposlenikPermissionsDialog({ open, onClose, zaposlenik, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0); // 0=Restorani, 1=Apartmani
  
  const [_restorani, setRestorani] = useState<Restoran[]>([]);
  const [_apartmani, setApartmani] = useState<Apartman[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, zaposlenik.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load restorani and apartmani
      const [restoraniData, apartmaniData, existingPermissions] = await Promise.all([
        api.getRestorani(),
        api.getApartmani(),
        api.getZaposlenikObjekti(zaposlenik.id!),
      ]);

      setRestorani(restoraniData);
      setApartmani(apartmaniData);

      // Build permission rows
      const rows: PermissionRow[] = [];

      // Restorani rows
      restoraniData.forEach(r => {
        const existing = existingPermissions.find(
          p => p.objekt_type === 'restoran' && p.objekt_id === r.id
        );
        rows.push({
          objekt_type: 'restoran',
          objekt_id: r.id!,
          objekt_name: r.ime,
          can_view: existing?.can_view ?? false,
          can_edit: existing?.can_edit ?? false,
          can_create: existing?.can_create ?? false,
          can_delete: existing?.can_delete ?? false,
        });
      });

      // Apartmani rows
      apartmaniData.forEach(a => {
        const existing = existingPermissions.find(
          p => p.objekt_type === 'apartman' && p.objekt_id === a.id
        );
        rows.push({
          objekt_type: 'apartman',
          objekt_id: a.id!,
          objekt_name: a.ime,
          can_view: existing?.can_view ?? false,
          can_edit: existing?.can_edit ?? false,
          can_create: existing?.can_create ?? false,
          can_delete: existing?.can_delete ?? false,
        });
      });

      setPermissions(rows);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (
    objekt_type: 'restoran' | 'apartman',
    objekt_id: number,
    field: 'can_view' | 'can_edit' | 'can_create' | 'can_delete'
  ) => {
    setPermissions(prev =>
      prev.map(p =>
        p.objekt_type === objekt_type && p.objekt_id === objekt_id
          ? { ...p, [field]: !p[field] }
          : p
      )
    );
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build assignments array (only rows with at least one permission)
      const assignments = permissions
        .filter(p => p.can_view || p.can_edit || p.can_create || p.can_delete)
        .map(p => ({
          objekt_type: p.objekt_type,
          objekt_id: p.objekt_id,
          can_view: p.can_view,
          can_edit: p.can_edit,
          can_create: p.can_create,
          can_delete: p.can_delete,
        }));

      await api.bulkAssignZaposlenikObjekti(zaposlenik.id!, assignments);

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Greška pri spremanju');
    } finally {
      setLoading(false);
    }
  };

  const restoraniPermissions = permissions.filter(p => p.objekt_type === 'restoran');
  const apartmaniPermissions = permissions.filter(p => p.objekt_type === 'apartman');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Upravljaj pristupom: {zaposlenik.ime}
      </DialogTitle>

      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Odaberite restorane i apartmane kojima zaposlenik može pristupiti.
              Postavite dozvole za svaki objekt (View, Edit, Create, Delete).
            </Typography>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
              <Tab label={`Restorani (${restoraniPermissions.length})`} />
              <Tab label={`Apartmani (${apartmaniPermissions.length})`} />
            </Tabs>

            {tab === 0 && (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Restoran</TableCell>
                      <TableCell align="center">View</TableCell>
                      <TableCell align="center">Edit</TableCell>
                      <TableCell align="center">Create</TableCell>
                      <TableCell align="center">Delete</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {restoraniPermissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          Nema restorana
                        </TableCell>
                      </TableRow>
                    ) : (
                      restoraniPermissions.map(p => (
                        <TableRow key={p.objekt_id}>
                          <TableCell>{p.objekt_name}</TableCell>
                          <TableCell align="center">
                            <Checkbox
                              checked={p.can_view}
                              onChange={() => togglePermission('restoran', p.objekt_id, 'can_view')}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox
                              checked={p.can_edit}
                              onChange={() => togglePermission('restoran', p.objekt_id, 'can_edit')}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox
                              checked={p.can_create}
                              onChange={() => togglePermission('restoran', p.objekt_id, 'can_create')}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox
                              checked={p.can_delete}
                              onChange={() => togglePermission('restoran', p.objekt_id, 'can_delete')}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {tab === 1 && (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Apartman</TableCell>
                      <TableCell align="center">View</TableCell>
                      <TableCell align="center">Edit</TableCell>
                      <TableCell align="center">Create</TableCell>
                      <TableCell align="center">Delete</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {apartmaniPermissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          Nema apartmana
                        </TableCell>
                      </TableRow>
                    ) : (
                      apartmaniPermissions.map(p => (
                        <TableRow key={p.objekt_id}>
                          <TableCell>{p.objekt_name}</TableCell>
                          <TableCell align="center">
                            <Checkbox
                              checked={p.can_view}
                              onChange={() => togglePermission('apartman', p.objekt_id, 'can_view')}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox
                              checked={p.can_edit}
                              onChange={() => togglePermission('apartman', p.objekt_id, 'can_edit')}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox
                              checked={p.can_create}
                              onChange={() => togglePermission('apartman', p.objekt_id, 'can_create')}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox
                              checked={p.can_delete}
                              onChange={() => togglePermission('apartman', p.objekt_id, 'can_delete')}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Odustani
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          Spremi
        </Button>
      </DialogActions>
    </Dialog>
  );
}
