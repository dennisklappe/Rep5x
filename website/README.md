# Rep5x - Website

Official website for Rep5x open-source 5-axis 3D printer retrofit system.

## Quick start

```bash
npm install
npm run dev
```

## Tech stack

- **Astro** - Static site generator with component islands
- **Tailwind CSS** - Utility-first styling framework  
- **Cloudflare Pages** - Deployment platform with edge functions

## Folder structure

```
functions/          # Cloudflare Pages Functions  
public/             # Static assets
src/
  config/           # Site configuration
  content/          # Markdown content (blog posts, pages)
  layouts/          # Page templates and components
  pages/            # Website routes
  styles/           # CSS stylesheets
```

## Available scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run format` - Format code with Prettier

## Adding blog posts

This website is open source to enable community contributions. To add a blog post:

1. Create new markdown file in `src/content/blog/`
2. Use this frontmatter template:
   ```yaml
   ---
   title: "Your Post Title"
   description: "Brief description"
   date: 2024-01-01
   image: "/images/blog/your-image.jpg"
   categories: ["hardware", "software", "community"]
   ---
   ```
3. Write your content in markdown below the frontmatter
4. Submit a pull request

## License

GPL v3 - see main repository for details.