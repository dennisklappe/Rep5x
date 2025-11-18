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
  try {
    // Load from website config directory
    const response = await fetch('../../website/src/config/theme.json');
    if (response.ok) {
      const websiteTheme = await response.json();
      theme = flattenTheme(websiteTheme);
      console.log('Loaded theme from website config:', theme);
    } else {
      // Fallback to GitHub if local doesn't work (for deployed version)
      const githubResponse = await fetch('https://raw.githubusercontent.com/dennisklappe/Rep5x/main/website/src/config/theme.json');
      if (githubResponse.ok) {
        const githubTheme = await githubResponse.json();
        theme = flattenTheme(githubTheme);
        console.log('Loaded theme from GitHub:', theme);
      } else {
        throw new Error('Could not load from GitHub either');
      }
    }
  } catch (error) {
    console.warn('Could not load theme from website config, using default:', error);
    theme = defaultTheme;
  }
  
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
  root.style.setProperty('--color-text', theme.colors.text);
  root.style.setProperty('--color-text-dark', theme.colors['text-dark']);
  root.style.setProperty('--color-text-light', theme.colors['text-light']);
  
  // Update body background
  document.body.style.backgroundColor = theme.colors.body;
}

// Get theme colors for JavaScript use
function getTheme() {
  return theme || defaultTheme;
}

// Initialize theme loading
loadTheme();