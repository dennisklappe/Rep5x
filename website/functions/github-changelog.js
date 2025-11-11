export async function onRequestGet(context) {
  try {
    const GITHUB_OWNER = "dennisklappe";
    const GITHUB_REPO = "Rep5x";
    const GITHUB_API_BASE = "https://api.github.com";
    
    // Fetch available blog images dynamically
    let availableImages = ['/images/blog/cad-model-rw2-print-head.png']; // fallback
    try {
      const imagesResponse = await fetch('https://rep5x-website.pages.dev/api/blog-images.json');
      if (imagesResponse.ok) {
        const imagesData = await imagesResponse.json();
        availableImages = imagesData.images || availableImages;
      }
    } catch (e) {
      }
    
    // Fetch merged pull requests
    const prsResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls?state=closed&per_page=20`,
      {
        headers: {
          'User-Agent': 'Rep5x-Website/1.0',
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    if (!prsResponse.ok) {
      throw new Error(`GitHub API returned ${prsResponse.status}: ${prsResponse.statusText}`);
    }
    
    const prs = await prsResponse.json();
  
    // Process merged PRs into changelog format
    const changelogItems = [];
    
    for (const pr of prs.filter(p => p.merged_at)) {
      // Random image selection
      const randomIndex = Math.floor(Math.random() * availableImages.length);
      const selectedImage = availableImages[randomIndex];
      
      changelogItems.push({
        version: `PR #${pr.number}`,
        title: pr.title,
        date: new Date(pr.merged_at).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        image: selectedImage,
        content: pr.body || pr.title,
        url: pr.html_url,
        type: "pr"
      });
    }

    // Add initial repository creation
    changelogItems.push({
      version: "Initial Release",
      title: "Rep5x Project Repository Created",
      date: "October 2025",
      image: availableImages[0] || "/images/blog/ender-5-pro-rw2-retrofit.png",
      content: "First public release of Rep5x design files and documentation. Basic 5-axis retrofit system for testing with initial firmware and inverse kinematics support. Community documentation and build guides now available.",
      url: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`,
      type: "release"
    });

    // Sort by date (newest first)
    const sortedItems = changelogItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return new Response(JSON.stringify({ changelogItems: sortedItems }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
    
  } catch (error) {
    console.error('Error fetching GitHub data:', error);
    console.error('Error details:', error.message);
    // Fallback to static content
    return new Response(JSON.stringify({
      changelogItems: [{
        version: "v0.3.0",
        title: "Firmware Improvements",
        date: "October 2025",
        image: "/images/blog/cad-model-rw2-print-head.png",
        content: "Enhanced inverse kinematics calculations for better precision. Added support for dual-board configuration.",
        type: "release"
      }]
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
}