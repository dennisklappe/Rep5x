// GitHub repo configuration
const GITHUB_REPO = "https://github.com/dennisklappe/Rep5x";
const GITHUB_BRANCH = "main";

// Function to process markdown content for web display
export function processMarkdownForWeb(content: string, printerFolder?: string): string {
  let processed = content;

  // Remove main h1 headings from assembly instructions and BOMs (redundant with section dividers)
  processed = processed.replace(/^# Rep5x - Universal assembly instructions\s*$/gmi, "");
  processed = processed.replace(/^# Rep5x - Universal BOM\s*$/gmi, "");
  processed = processed.replace(/^# Rep5x - [A-Za-z0-9\s]+ assembly instructions\s*$/gmi, "");
  processed = processed.replace(/^# Rep5x - [A-Za-z0-9\s]+ BOM\s*$/gmi, "");

  processed = processed.replace(/^#+ Rep5x - /gm, "# ");
  processed = processed.replace(/^#+ Rep5x$/gm, "");

  // Remove redundant cross-references to universal BOM
  processed = processed.replace(
    /See the \[universal BOM\]\([^)]+\) for common components required across all printer models\./gi,
    ""
  );
  processed = processed.replace(
    /This BOM covers components specific to the [^.]+\.\s*/gi,
    ""
  );

  // Remove cross-references to assembly instructions (already on same page)
  processed = processed.replace(
    /Follow the main \[assembly instructions\]\([^)]+\) and refer to this document for printer-specific details\./gi,
    ""
  );
  processed = processed.replace(
    /See \[assembly instructions\]\([^)]+\) for complete build instructions/gi,
    ""
  );

  // Convert local file paths to GitHub links
  if (printerFolder) {
    // Replace relative paths in printer-specific files (with backticks)
    processed = processed.replace(
      /\[`([^`]+)`\]\(([^)]+)\)/g,
      (_match, text, path) => {
        if (path.startsWith("http")) return _match; // Already a URL
        const isFile = path.match(/\.(md|txt|json|h|cpp|ino)$/i);
        const viewType = isFile ? "blob" : "tree";
        const githubPath = `${GITHUB_REPO}/${viewType}/${GITHUB_BRANCH}/build-guide/printer-specific/${printerFolder}/${path}`;
        return `<a href="${githubPath}" target="_blank" rel="noopener noreferrer"><code>${text}</code></a>`;
      }
    );
    // Replace relative paths in printer-specific files (without backticks)
    processed = processed.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_match, text, path) => {
        if (path.startsWith("http") || path.startsWith("#")) return _match; // Already a URL or anchor
        if (text.includes("`") || text.includes("<code>")) return _match; // Already handled above
        const isFile = path.match(/\.(md|txt|json|h|cpp|ino)$/i);
        const viewType = isFile ? "blob" : "tree";
        const githubPath = `${GITHUB_REPO}/${viewType}/${GITHUB_BRANCH}/build-guide/printer-specific/${printerFolder}/${path}`;
        return `<a href="${githubPath}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
    );
  }

  // Convert universal file paths to GitHub links (with backticks)
  processed = processed.replace(
    /\[`([^`]+)`\]\(\.\.\/([^)]+)\)/g,
    (_match, text, path) => {
      const isFile = path.match(/\.(md|txt|json|h|cpp|ino)$/i);
      const viewType = isFile ? "blob" : "tree";
      const githubPath = `${GITHUB_REPO}/${viewType}/${GITHUB_BRANCH}/build-guide/${path}`;
      return `<a href="${githubPath}" target="_blank" rel="noopener noreferrer"><code>${text}</code></a>`;
    }
  );
  // Convert universal file paths to GitHub links (without backticks)
  processed = processed.replace(
    /\[([^\]]+)\]\(\.\.\/([^)]+)\)/g,
    (_match, text, path) => {
      if (path.startsWith("http") || path.startsWith("#")) return _match; // Already a URL or anchor
      const isFile = path.match(/\.(md|txt|json|h|cpp|ino)$/i);
      const viewType = isFile ? "blob" : "tree";
      const githubPath = `${GITHUB_REPO}/${viewType}/${GITHUB_BRANCH}/build-guide/${path}`;
      return `<a href="${githubPath}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }
  );

  // Convert relative paths in universal content (paths without ../)
  if (!printerFolder) {
    processed = processed.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_match, text, path) => {
        // Skip if already a URL, anchor, or contains special characters suggesting it's already processed
        if (path.startsWith("http") || path.startsWith("#") || path.includes("<")) return _match;
        // Skip if doesn't look like a file path
        if (!path.includes("/") && !path.match(/\.(md|txt|json|h|cpp|ino)$/i)) return _match;

        const isFile = path.match(/\.(md|txt|json|h|cpp|ino)$/i);
        const viewType = isFile ? "blob" : "tree";
        const githubPath = `${GITHUB_REPO}/${viewType}/${GITHUB_BRANCH}/build-guide/${path}`;
        return `<a href="${githubPath}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
    );
  }

  // Convert image paths to GitHub raw URLs
  processed = processed.replace(
    /<img src="([^"]+)"/g,
    (_match, src) => {
      if (src.startsWith("http")) return _match; // Already a URL
      // Handle relative paths
      let imagePath = src;
      if (printerFolder) {
        // For printer-specific images
        if (src.startsWith("images/")) {
          imagePath = `build-guide/printer-specific/${printerFolder}/${src}`;
        } else if (!src.startsWith("/")) {
          imagePath = `build-guide/printer-specific/${printerFolder}/${src}`;
        }
      } else {
        // For universal images
        if (src.startsWith("images/")) {
          imagePath = `build-guide/${src}`;
        } else if (!src.startsWith("/")) {
          imagePath = `build-guide/${src}`;
        }
      }
      const githubRawUrl = `https://raw.githubusercontent.com/dennisklappe/Rep5x/${GITHUB_BRANCH}/${imagePath}`;
      return `<img src="${githubRawUrl}"`;
    }
  );

  return processed;
}
