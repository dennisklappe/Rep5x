// Rep5x Theme Configuration
// This loads the same theme used by the main website

let theme = null;

// Default theme (fallback if fetch fails)
const defaultTheme = {
  colors: {
    primary: '#32D74B',
    secondary: '#1A1A1A',
    body: '#FAFAFA',
    border: '#E5E5E5',
    light: '#F7FFF8',
    dark: '#0D1117',
    success: '#16A34A',
    'success-hover': '#15803D',
    'success-light': '#F0FDF4',
    'success-border': '#BBF7D0',
    'success-text': '#166534',
    danger: '#DC2626',
    'danger-hover': '#B91C1C',
    'danger-light': '#FEF2F2',
    'danger-border': '#FECACA',
    'danger-text': '#991B1B',
    text: '#1F2937',
    'text-dark': '#111827',
    'text-light': '#fff'
  },
  fonts: {
    primary: 'Satoshi',
    secondary: 'Clash Grotesk'
  }
};

// Load theme from main website config
async function loadTheme() {
  // Try multiple relative paths to find theme.json
  const paths = [
    '../website/src/config/theme.json',
    '../../website/src/config/theme.json',
    '../../../website/src/config/theme.json'
  ];

  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        const websiteTheme = await response.json();
        theme = flattenTheme(websiteTheme);
        applyThemeToPage();
        return;
      }
    } catch (error) {
      // Try next path
    }
  }

  // Fallback to GitHub if local doesn't work (for deployed version)
  try {
    const githubResponse = await fetch('https://raw.githubusercontent.com/dennisklappe/Rep5x/main/website/src/config/theme.json');
    if (githubResponse.ok) {
      const githubTheme = await githubResponse.json();
      theme = flattenTheme(githubTheme);
      applyThemeToPage();
      return;
    }
  } catch (error) {
    // Fall through to default
  }

  console.warn('Could not load theme, using default');
  theme = defaultTheme;
  applyThemeToPage();
}

// Flatten nested theme structure for easier use
function flattenTheme(themeData) {
  return {
    colors: {
      ...themeData.colors.default.theme_color,
      ...themeData.colors.default.text_color
    },
    fonts: {
      primary: themeData.fonts.font_family.primary,
      secondary: themeData.fonts.font_family.secondary
    }
  };
}

// Apply theme colors to CSS custom properties
function applyThemeToPage() {
  if (!theme) return;

  const root = document.documentElement;

  // Set CSS custom properties
  root.style.setProperty('--color-primary', theme.colors.primary);
  root.style.setProperty('--color-secondary', theme.colors.secondary);
  root.style.setProperty('--color-body', theme.colors.body);
  root.style.setProperty('--color-border', theme.colors.border);
  root.style.setProperty('--color-light', theme.colors.light);
  root.style.setProperty('--color-dark', theme.colors.dark);
  root.style.setProperty('--color-success', theme.colors.success);
  root.style.setProperty('--color-success-hover', theme.colors['success-hover']);
  root.style.setProperty('--color-success-light', theme.colors['success-light']);
  root.style.setProperty('--color-success-border', theme.colors['success-border']);
  root.style.setProperty('--color-success-text', theme.colors['success-text']);
  root.style.setProperty('--color-danger', theme.colors.danger);
  root.style.setProperty('--color-danger-hover', theme.colors['danger-hover']);
  root.style.setProperty('--color-danger-light', theme.colors['danger-light']);
  root.style.setProperty('--color-danger-border', theme.colors['danger-border']);
  root.style.setProperty('--color-danger-text', theme.colors['danger-text']);
  root.style.setProperty('--color-text', theme.colors.text);
  root.style.setProperty('--color-text-dark', theme.colors['text-dark']);
  root.style.setProperty('--color-text-light', theme.colors['text-light']);

  // Update body background
  document.body.style.backgroundColor = theme.colors.body;

  // Inject button styles
  injectButtonStyles();
}

// Inject CSS for themed buttons
function injectButtonStyles() {
  if (document.getElementById('theme-button-styles')) return;

  const style = document.createElement('style');
  style.id = 'theme-button-styles';
  style.textContent = `
    .btn-success {
      background-color: var(--color-success);
      color: var(--color-text-light);
    }
    .btn-success:hover {
      background-color: var(--color-success-hover);
    }
    .btn-danger {
      background-color: var(--color-danger);
      color: var(--color-text-light);
    }
    .btn-danger:hover {
      background-color: var(--color-danger-hover);
    }
    .btn-primary {
      background-color: var(--color-primary);
      color: var(--color-text-light);
    }
    .btn-primary:hover {
      opacity: 0.9;
    }
    .btn-secondary {
      background-color: var(--color-secondary);
      color: var(--color-text-light);
    }
    .btn-secondary:hover {
      opacity: 0.9;
    }
    .status-success {
      background-color: var(--color-success-light);
      border-color: var(--color-success-border);
      color: var(--color-success-text);
    }
    .status-danger {
      background-color: var(--color-danger-light);
      border-color: var(--color-danger-border);
      color: var(--color-danger-text);
    }
  `;
  document.head.appendChild(style);
}

// Get theme colors for JavaScript use
function getTheme() {
  return theme || defaultTheme;
}

// Initialize theme loading
loadTheme();