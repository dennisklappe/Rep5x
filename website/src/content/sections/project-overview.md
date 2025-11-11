---
title: "Rep5x Project Overview"
description: "An open-source research project developing affordable 5-axis printing retrofits for consumer 3D printers, enabling new printing capabilities through community collaboration."
badge: "Project Features"

list_columns:
  - title: "5-Axis Motion Control <br> Implementation"
    images:
      - "/images/rw2-print-head-cad.webp"
    description: "Adding yaw and pitch rotation to standard 3D printers lets you print complex shapes without support material, reducing reliance on support structures."
    list:
      - icon: "lucide:rotate-3d"
        title: "Coordinated Multi-Axis Movement"
        description: "Continuous yaw rotation and >90° pitch tilt allow parts to be printed from optimal angles."
      - icon: "lucide:minimize"
        title: "Support Structure Reduction"
        description: "Strategic part orientation can eliminate support material for many complex geometries."

  - title: "Open-Source Retrofit System Design"
    images:
      - "/images/blog/github-repo-screenshot.webp"
    description: "Complete documentation and modular design allow adaptation to different printer models, with community contributions driving development forward."
    list_check:
      - "CAD files and build documentation available on GitHub"
      - "Marlin firmware modifications for 5-axis control"
      - "Currently tested on Ender 5 Pro platform"
      - "Community-driven adaptation to additional printer models"
    button:
      enable: true
      label: "View Project"
      link: "https://github.com/dennisklappe/rep5x"
---
