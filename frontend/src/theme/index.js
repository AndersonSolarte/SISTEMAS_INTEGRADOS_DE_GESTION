import { createTheme, alpha } from '@mui/material/styles';

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS
   Fuente única de verdad para colores, radios y sombras.
───────────────────────────────────────────────────────────────*/
export const tokens = {
  /* Paleta de marca */
  brand: {
    50:  '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  violet: {
    50:  '#f5f3ff',
    400: '#a78bfa',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9',
  },
  cyan: {
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
  },
  emerald: {
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
  },
  amber: {
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
  },
  rose: {
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
  },
  /* Escala de grises neutra */
  slate: {
    50:  '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
};

/* ─────────────────────────────────────────────────────────────
   SOMBRAS PERSONALIZADAS
───────────────────────────────────────────────────────────────*/
const shadows = [
  'none',
  '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  ...Array(18).fill('none'),
];

/* ─────────────────────────────────────────────────────────────
   THEME PRINCIPAL
───────────────────────────────────────────────────────────────*/
const theme = createTheme({
  /* ── Tipografía ─────────────────────────────────────────── */
  typography: {
    fontFamily: '"Inter", "Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    fontWeightLight:   300,
    fontWeightRegular: 400,
    fontWeightMedium:  500,
    fontWeightBold:    700,
    h1: { fontSize: '2.25rem',  fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.025em' },
    h2: { fontSize: '1.875rem', fontWeight: 800, lineHeight: 1.25, letterSpacing: '-0.02em' },
    h3: { fontSize: '1.5rem',   fontWeight: 700, lineHeight: 1.3,  letterSpacing: '-0.015em' },
    h4: { fontSize: '1.25rem',  fontWeight: 700, lineHeight: 1.4,  letterSpacing: '-0.01em' },
    h5: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
    h6: { fontSize: '1rem',     fontWeight: 600, lineHeight: 1.5 },
    subtitle1: { fontSize: '0.9375rem', fontWeight: 500, lineHeight: 1.5 },
    subtitle2: { fontSize: '0.875rem',  fontWeight: 500, lineHeight: 1.5, color: tokens.slate[500] },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem',  lineHeight: 1.6, color: tokens.slate[600] },
    caption: { fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.02em', color: tokens.slate[500] },
    overline: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' },
    button: { fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.01em', textTransform: 'none' },
  },

  /* ── Paleta ─────────────────────────────────────────────── */
  palette: {
    mode: 'light',
    primary: {
      lighter: tokens.brand[50],
      light:   tokens.brand[300],
      main:    tokens.brand[600],
      dark:    tokens.brand[700],
      darker:  tokens.brand[900],
      contrastText: '#fff',
    },
    secondary: {
      lighter: tokens.violet[50],
      light:   tokens.violet[400],
      main:    tokens.violet[600],
      dark:    tokens.violet[700],
      contrastText: '#fff',
    },
    success: {
      light: tokens.emerald[400],
      main:  tokens.emerald[500],
      dark:  tokens.emerald[600],
    },
    warning: {
      light: tokens.amber[400],
      main:  tokens.amber[500],
      dark:  tokens.amber[600],
    },
    error: {
      light: tokens.rose[400],
      main:  tokens.rose[500],
      dark:  tokens.rose[600],
    },
    info: {
      light: tokens.cyan[400],
      main:  tokens.cyan[500],
      dark:  tokens.cyan[600],
    },
    grey: tokens.slate,
    background: {
      default: tokens.slate[50],
      paper:   '#ffffff',
      subtle:  tokens.slate[100],
    },
    text: {
      primary:   tokens.slate[900],
      secondary: tokens.slate[500],
      disabled:  tokens.slate[300],
    },
    divider: tokens.slate[200],
  },

  /* ── Radios ─────────────────────────────────────────────── */
  shape: { borderRadius: 10 },

  /* ── Sombras ────────────────────────────────────────────── */
  shadows,

  /* ── Transiciones ───────────────────────────────────────── */
  transitions: {
    duration: {
      shortest: 100,
      shorter:  150,
      short:    200,
      standard: 280,
      complex:  380,
      enteringScreen: 220,
      leavingScreen:  180,
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut:   'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn:    'cubic-bezier(0.4, 0, 1, 1)',
      sharp:     'cubic-bezier(0.4, 0, 0.6, 1)',
    },
  },

  /* ── Overrides de componentes ───────────────────────────── */
  components: {

    /* CssBaseline — fuente global */
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        :root { font-synthesis: none; text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; }
        ::selection { background: ${alpha(tokens.brand[500], 0.18)}; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${tokens.slate[100]}; }
        ::-webkit-scrollbar-thumb { background: ${tokens.slate[300]}; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: ${tokens.slate[400]}; }
      `,
    },

    /* Paper */
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${tokens.slate[200]}`,
        },
        rounded: { borderRadius: 14 },
      },
    },

    /* Card */
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: `1px solid ${tokens.slate[200]}`,
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          '&:hover': {
            boxShadow: shadows[4],
            borderColor: tokens.slate[300],
          },
        },
      },
    },

    /* Button */
    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: false },
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 600,
          letterSpacing: '0.01em',
          padding: '8px 18px',
          transition: 'all 0.18s ease',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: `0 4px 14px ${alpha(tokens.brand[500], 0.35)}` },
          '&:active': { transform: 'scale(0.98)' },
        },
        outlined: {
          borderWidth: '1.5px',
          '&:hover': { borderWidth: '1.5px', backgroundColor: alpha(tokens.brand[500], 0.05) },
        },
        sizeSmall:  { padding: '5px 12px', fontSize: '0.8125rem' },
        sizeLarge:  { padding: '11px 26px', fontSize: '0.9375rem' },
      },
    },

    /* IconButton */
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'all 0.18s ease',
          '&:hover': { backgroundColor: alpha(tokens.slate[500], 0.08) },
        },
      },
    },

    /* Chip */
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.75rem',
          letterSpacing: '0.01em',
          borderRadius: 8,
          height: 26,
        },
        sizeSmall: { height: 20, fontSize: '0.6875rem' },
      },
    },

    /* TextField / Input */
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: '#fff',
          transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.brand[400],
          },
          '&.Mui-focused': {
            boxShadow: `0 0 0 3px ${alpha(tokens.brand[500], 0.12)}`,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.brand[500],
            borderWidth: '1.5px',
          },
        },
        notchedOutline: {
          borderColor: tokens.slate[300],
          transition: 'border-color 0.18s ease',
        },
      },
    },

    /* InputLabel */
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          fontWeight: 500,
          color: tokens.slate[500],
        },
      },
    },

    /* Select */
    MuiSelect: {
      styleOverrides: {
        icon: { color: tokens.slate[400] },
      },
    },

    /* Table */
    MuiTableContainer: {
      styleOverrides: {
        root: { borderRadius: 12, border: `1px solid ${tokens.slate[200]}` },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: { backgroundColor: tokens.slate[50] },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontSize: '0.75rem',
          fontWeight: 700,
          color: tokens.slate[500],
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          borderBottom: `1px solid ${tokens.slate[200]}`,
          padding: '10px 14px',
          whiteSpace: 'nowrap',
        },
        body: {
          fontSize: '0.875rem',
          color: tokens.slate[700],
          borderBottom: `1px solid ${tokens.slate[100]}`,
          padding: '10px 14px',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.14s ease',
          '&:hover': { backgroundColor: tokens.slate[50] },
          '&:last-child td': { borderBottom: 0 },
        },
      },
    },

    /* Alert */
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontSize: '0.875rem',
          fontWeight: 500,
          alignItems: 'center',
          border: '1px solid transparent',
        },
        standardSuccess: {
          backgroundColor: alpha(tokens.emerald[500], 0.08),
          borderColor:     alpha(tokens.emerald[500], 0.2),
          color:           tokens.emerald[600],
          '& .MuiAlert-icon': { color: tokens.emerald[500] },
        },
        standardError: {
          backgroundColor: alpha(tokens.rose[500], 0.08),
          borderColor:     alpha(tokens.rose[500], 0.2),
          color:           tokens.rose[600],
          '& .MuiAlert-icon': { color: tokens.rose[500] },
        },
        standardWarning: {
          backgroundColor: alpha(tokens.amber[500], 0.08),
          borderColor:     alpha(tokens.amber[500], 0.2),
          color:           tokens.amber[600],
          '& .MuiAlert-icon': { color: tokens.amber[500] },
        },
        standardInfo: {
          backgroundColor: alpha(tokens.cyan[500], 0.08),
          borderColor:     alpha(tokens.cyan[500], 0.2),
          color:           tokens.cyan[600],
          '& .MuiAlert-icon': { color: tokens.cyan[500] },
        },
      },
    },

    /* Tooltip */
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: tokens.slate[800],
          fontSize: '0.75rem',
          fontWeight: 500,
          borderRadius: 8,
          padding: '6px 10px',
          boxShadow: shadows[4],
        },
        arrow: { color: tokens.slate[800] },
      },
    },

    /* Divider */
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: tokens.slate[200] },
      },
    },

    /* Dialog */
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 18,
          boxShadow: shadows[6],
          border: `1px solid ${tokens.slate[200]}`,
        },
      },
    },

    /* Accordion */
    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${tokens.slate[200]}`,
          borderRadius: '12px !important',
          marginBottom: 8,
          '&:before': { display: 'none' },
          transition: 'box-shadow 0.2s ease',
          '&.Mui-expanded': { boxShadow: shadows[3] },
        },
      },
    },

    /* LinearProgress */
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 99, height: 6, backgroundColor: tokens.slate[200] },
        bar:  { borderRadius: 99 },
      },
    },

    /* CircularProgress */
    MuiCircularProgress: {
      defaultProps: { thickness: 3 },
    },

    /* Avatar */
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          fontSize: '0.8125rem',
        },
      },
    },

    /* ListItemButton */
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          marginBottom: 2,
          transition: 'all 0.15s ease',
          '&.Mui-selected': {
            backgroundColor: alpha(tokens.brand[500], 0.1),
            color:           tokens.brand[700],
            fontWeight:      700,
            '&:hover': { backgroundColor: alpha(tokens.brand[500], 0.14) },
            '& .MuiListItemIcon-root': { color: tokens.brand[600] },
          },
          '&:hover': {
            backgroundColor: alpha(tokens.slate[500], 0.06),
          },
        },
      },
    },

    /* Tabs */
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 40 },
        indicator: { height: 3, borderRadius: '3px 3px 0 0' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.875rem',
          minHeight: 40,
          textTransform: 'none',
          letterSpacing: 0,
          '&.Mui-selected': { color: tokens.brand[600] },
        },
      },
    },

    /* Skeleton */
    MuiSkeleton: {
      defaultProps: { animation: 'wave' },
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },

    /* DataGrid (MUI X) */
    MuiDataGrid: {
      defaultProps: {
        disableRowSelectionOnClick: true,
        density: 'comfortable',
        autoHeight: true,
      },
      styleOverrides: {
        root: {
          border: 'none',
          borderRadius: 0,
          fontFamily: '"Inter", system-ui, sans-serif',
          fontSize: '0.875rem',
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: tokens.slate[50],
            borderBottom: `1px solid ${tokens.slate[200]}`,
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 700,
            fontSize: '0.75rem',
            color: tokens.slate[500],
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          },
          '& .MuiDataGrid-cell': {
            borderBottom: `1px solid ${tokens.slate[100]}`,
            color: tokens.slate[700],
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: tokens.slate[50],
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: `1px solid ${tokens.slate[200]}`,
            backgroundColor: tokens.slate[50],
          },
          '& .MuiDataGrid-toolbarContainer': {
            padding: '10px 14px',
            borderBottom: `1px solid ${tokens.slate[200]}`,
            gap: 1,
          },
        },
      },
    },
  },
});

export default theme;
