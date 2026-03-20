import { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CircularProgress,
} from '@mui/material';
import {
  People,
  Home,
  Restaurant,
  PersonAdd,
  EventNote,
  CalendarMonth,
} from '@mui/icons-material';
import api from '../services/api';
import type { Stats } from '../types';
import { useAuthStore } from '../store/authStore';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              backgroundColor: color,
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setError(null);
      const data = await api.getStats();
      setStats(data);
    } catch (error: any) {
      console.error('Failed to load stats:', error);
      setError(error.response?.data?.detail || 'Greška pri učitavanju statistike');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" color="error" gutterBottom>
            Greška pri učitavanju dashboard-a
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {error}
          </Typography>
        </Paper>
      </Container>
    );
  }

  const userRole = user?.role || 'zaposlenik';
  const isAdmin = userRole === 'admin';
  const isVlasnik = userRole === 'vlasnik';
  const isZaposlenik = userRole === 'zaposlenik';

  // Get labels based on role
  const getLabel = (base: string) => {
    if (isAdmin) return base;
    if (isVlasnik) return `Moji ${base.toLowerCase()}`;
    return base; // Zaposlenik sees "Apartmani" (from nadredeni)
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#1565C0', py: 4 }}>
    <Container maxWidth="lg" sx={{ mb: 4 }}>
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Dobrodošli, {user?.ime}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {isAdmin && 'Administratorski pregled sustava'}
          {isVlasnik && 'Pregled vaših objekata i rezervacija'}
          {isZaposlenik && 'Pregled rezervacija i gostiju'}
        </Typography>
      </Paper>

      <Grid container spacing={3}>
        {isAdmin && stats?.vlasnici !== undefined && (
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Vlasnici"
              value={stats.vlasnici}
              icon={<People sx={{ color: 'white', fontSize: 32 }} />}
              color="#1976d2"
            />
          </Grid>
        )}

        {(isAdmin || isVlasnik) && (
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title={getLabel('Apartmani')}
              value={stats?.apartmani || 0}
              icon={<Home sx={{ color: 'white', fontSize: 32 }} />}
              color="#2e7d32"
            />
          </Grid>
        )}

        {(isAdmin || isVlasnik) && (
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title={getLabel('Restorani')}
              value={stats?.restorani || 0}
              icon={<Restaurant sx={{ color: 'white', fontSize: 32 }} />}
              color="#ed6c02"
            />
          </Grid>
        )}

        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title={getLabel('Gosti')}
            value={stats?.gosti || 0}
            icon={<PersonAdd sx={{ color: 'white', fontSize: 32 }} />}
            color="#9c27b0"
          />
        </Grid>

        {stats?.rezervacije_apartmana !== undefined && (
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title={getLabel('Rezervacije Apartmana')}
              value={stats.rezervacije_apartmana}
              icon={<CalendarMonth sx={{ color: 'white', fontSize: 32 }} />}
              color="#0288d1"
            />
          </Grid>
        )}

        {stats?.rezervacije_stolova !== undefined && (
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title={getLabel('Rezervacije Stolova')}
              value={stats.rezervacije_stolova}
              icon={<EventNote sx={{ color: 'white', fontSize: 32 }} />}
              color="#d32f2f"
            />
          </Grid>
        )}
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Informacije o korisniku
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Email: <strong>{user?.email}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Uloga: <strong>{user?.role}</strong>
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Brzi linkovi
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="primary" sx={{ cursor: 'pointer', mb: 1 }}>
                → Dodaj novi apartman
              </Typography>
              <Typography variant="body2" color="primary" sx={{ cursor: 'pointer', mb: 1 }}>
                → Dodaj novi restoran
              </Typography>
              <Typography variant="body2" color="primary" sx={{ cursor: 'pointer', mb: 1 }}>
                → Dodaj novog gosta
              </Typography>
              <Typography variant="body2" color="primary" sx={{ cursor: 'pointer' }}>
                → Pregledaj rezervacije
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
    </Box>
  );
}
