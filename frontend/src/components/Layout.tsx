import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  Home,
  Restaurant,
  PersonAdd,
  EventNote,
  CalendarMonth,
  Logout,
  AccountCircle,
  History,
  Settings,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';

const drawerWidth = 240;

interface NavItem {
  text: string;
  icon: React.ReactNode;
  path: string;
  roles?: string[]; // Which roles can see this item
  modules?: string[]; // Which modules required (e.g., ['apartmani'])
}

const navItems: NavItem[] = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard', roles: ['admin', 'vlasnik', 'zaposlenik'] },
  { text: 'Vlasnici', icon: <People />, path: '/vlasnici', roles: ['admin', 'vlasnik'] },
  { text: 'Apartmani', icon: <Home />, path: '/apartmani', roles: ['admin', 'vlasnik'], modules: ['apartmani'] },
  { text: 'Restorani', icon: <Restaurant />, path: '/restorani', roles: ['admin', 'vlasnik'], modules: ['restorani'] },
  { text: 'Gosti', icon: <PersonAdd />, path: '/gosti', roles: ['admin', 'vlasnik', 'zaposlenik'] },
  { text: 'Rezervacije Stolova', icon: <EventNote />, path: '/stolovi-rezervacije', roles: ['admin', 'vlasnik', 'zaposlenik'], modules: ['restorani'] },
  { text: 'Rezervacije Apartmana', icon: <CalendarMonth />, path: '/rezervacije', roles: ['admin', 'vlasnik', 'zaposlenik'], modules: ['apartmani'] },
  { text: 'Audit Log', icon: <History />, path: '/audit-log', roles: ['admin', 'vlasnik'] },
  { text: 'Postavke', icon: <Settings />, path: '/settings', roles: ['admin', 'vlasnik'] },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const userRole = user?.role || 'zaposlenik';
  const userModuli = user?.moduli || [];

  const filteredNavItems = navItems.filter((item) => {
    // Check role permission
    if (item.roles && !item.roles.includes(userRole)) {
      return false;
    }
    
    // Check module permission (admin bypasses module check)
    if (item.modules && userRole !== 'admin') {
      // User must have at least one of the required modules
      const hasModule = item.modules.some(mod => userModuli.includes(mod));
      if (!hasModule) {
        return false;
      }
    }
    
    return true;
  });

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Apartmani & Restorani
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {filteredNavItems.map((item) => {
          // Dynamic text for Vlasnici page
          let displayText = item.text;
          if (item.path === '/vlasnici' && userRole === 'vlasnik') {
            displayText = 'Zaposlenici';
          }
          
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => handleNavigation(item.path)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={displayText} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {navItems.find((item) => item.path === location.pathname)?.text || 'Dashboard'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">{user?.ime}</Typography>
            <IconButton onClick={handleMenuClick} color="inherit">
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                {user?.ime?.charAt(0) || 'U'}
              </Avatar>
            </IconButton>
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            onClick={handleMenuClose}
          >
            <MenuItem disabled>
              <AccountCircle sx={{ mr: 1 }} />
              {user?.email}
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 1 }} />
              Odjavi se
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
