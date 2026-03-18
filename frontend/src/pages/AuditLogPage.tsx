import { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Alert,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Pagination,
} from '@mui/material';
import {
  History as HistoryIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface AuditLog {
  id: number;
  timestamp: string;
  korisnik_id: number;
  korisnik_ime: string;
  korisnik_role: string;
  akcija: string;
  entitet_tip: string;
  entitet_id: number | null;
  entitet_naziv: string | null;
  detalji: string | null;
  ip_adresa: string | null;
}

export default function AuditLogPage() {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterAkcija, setFilterAkcija] = useState<string>('');
  const [filterEntitetTip, setFilterEntitetTip] = useState<string>('');

  const isAdmin = user?.role === 'admin';
  const logsPerPage = 50;

  useEffect(() => {
    loadLogs();
  }, [page, filterAkcija, filterEntitetTip]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use dedicated audit log endpoint
      const skip = (page - 1) * logsPerPage;
      const auditLogs = await api.getAuditLog(
        skip,
        logsPerPage,
        filterAkcija || undefined,
        filterEntitetTip || undefined
      );
      
      setLogs(auditLogs);
      // Note: Backend doesn't return total count yet, so we estimate
      setTotalPages(auditLogs.length === logsPerPage ? page + 1 : page);
      
      // Sort by timestamp descending (newest first)
      auditLogs.sort((a: AuditLog, b: AuditLog) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      // Pagination
      const startIndex = (page - 1) * logsPerPage;
      const endIndex = startIndex + logsPerPage;
      const paginatedLogs = auditLogs.slice(startIndex, endIndex);
      
      setLogs(paginatedLogs);
      setTotalPages(Math.ceil(auditLogs.length / logsPerPage));
    } catch (err: any) {
      setError('Greška pri učitavanju audit loga');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getAkcijaColor = (akcija: string): 'success' | 'info' | 'warning' | 'error' | 'default' => {
    switch (akcija) {
      case 'dodaj': return 'success';
      case 'uredi': return 'info';
      case 'obrisi': return 'error';
      case 'prijava': return 'success';
      case 'odjava': return 'warning';
      default: return 'default';
    }
  };

  const getRoleColor = (role: string): 'error' | 'primary' | 'secondary' | 'default' => {
    switch (role) {
      case 'admin': return 'error';
      case 'vlasnik': return 'primary';
      case 'zaposlenik': return 'secondary';
      default: return 'default';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'dd.MM.yyyy HH:mm:ss');
    } catch {
      return timestamp;
    }
  };

  const uniqueAkcije = [...new Set(logs.map(log => log.akcija))].filter(Boolean);
  const uniqueEntiteti = [...new Set(logs.map(log => log.entitet_tip))].filter(Boolean);

  if (loading && logs.length === 0) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Paper sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <HistoryIcon sx={{ fontSize: 32, mr: 1 }} />
          <Typography variant="h4">Audit Log</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {user?.role === 'admin' 
            ? 'Pregled svih aktivnosti u sustavu. Prikazuje tko je, kada i što napravio.'
            : 'Pregled vaših aktivnosti u sustavu.'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
        )}

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Filtriraj po akciji</InputLabel>
              <Select value={filterAkcija} onChange={(e) => { setFilterAkcija(e.target.value); setPage(1); }} label="Filtriraj po akciji">
                <MenuItem value=""><em>Sve akcije</em></MenuItem>
                <MenuItem value="dodaj">Dodaj</MenuItem>
                <MenuItem value="uredi">Uredi</MenuItem>
                <MenuItem value="obrisi">Obriši</MenuItem>
                <MenuItem value="prijava">Prijava</MenuItem>
                <MenuItem value="odjava">Odjava</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Filtriraj po entitetu</InputLabel>
              <Select value={filterEntitetTip} onChange={(e) => { setFilterEntitetTip(e.target.value); setPage(1); }} label="Filtriraj po entitetu">
                <MenuItem value=""><em>Svi entiteti</em></MenuItem>
                <MenuItem value="vlasnik">Vlasnik</MenuItem>
                <MenuItem value="apartman">Apartman</MenuItem>
                <MenuItem value="restoran">Restoran</MenuItem>
                <MenuItem value="gost">Gost</MenuItem>
                <MenuItem value="rezervacija">Rezervacija</MenuItem>
                <MenuItem value="rezervacija_stola">Rezervacija stola</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Vrijeme</TableCell>
                <TableCell>Korisnik</TableCell>
                <TableCell>Uloga</TableCell>
                <TableCell>Akcija</TableCell>
                <TableCell>Entitet</TableCell>
                <TableCell>Naziv</TableCell>
                <TableCell>Detalji</TableCell>
                <TableCell>IP</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary">
                      {filterAkcija || filterEntitetTip ? 'Nema rezultata za odabrane filtere' : 'Nema zapisa u audit logu'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell>{log.id}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTimestamp(log.timestamp)}</TableCell>
                    <TableCell>{log.korisnik_ime}</TableCell>
                    <TableCell>
                      <Chip label={log.korisnik_role} color={getRoleColor(log.korisnik_role)} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip label={log.akcija} color={getAkcijaColor(log.akcija)} size="small" />
                    </TableCell>
                    <TableCell>{log.entitet_tip}</TableCell>
                    <TableCell>{log.entitet_naziv || '-'}</TableCell>
                    <TableCell>{log.detalji ? log.detalji.substring(0, 40) + (log.detalji.length > 40 ? '...' : '') : '-'}</TableCell>
                    <TableCell>{log.ip_adresa || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {totalPages > 1 && (
          <Box display="flex" justifyContent="center" mt={3}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, value) => setPage(value)}
              color="primary"
            />
          </Box>
        )}

        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Legenda akcija:</strong> Dodaj (nova stavka), Uredi (promjena), Obriši (brisanje), Prijava/Odjava (auth)
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
