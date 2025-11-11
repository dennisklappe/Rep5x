---
title: 'GitHub repo now available'
description: 'First public release of Rep5x design files and documentation for the community'
date: 2025-10-20
image: '/images/blog/github-repo-screenshot.webp'
categories: ['community', 'open-source']
author:
  name: 'Dennis Klappe'
  designation: 'Masters Student'
  avatar: '/images/team/dennis-klappe.webp'
---

I'm always having a hard time publishing things that are unpolished or not worked out enough yet. But I've had many people messaging me for the past week asking if there are already files available and that they'd just like to have a look at it.

So here's a release of the very pre-alpha files and some basic instructions. This will improve soon.

## What's available now

The [Rep5x GitHub repository](https://github.com/dennisklappe/rep5x) is now live with:

- Ender 5 Pro working prototype
- Complete bill of materials with all parts needed
- Marlin firmware configurations for BTT Octopus V1.1 (tested) and Pro H723 (in development)
- Wiring diagrams for electronics setup
- Basic documentation to get started

## Current status

This is a pre-alpha release. The Ender 5 Pro configuration represents a working prototype that's been tested, but documentation is still being refined.

The firmware uses Marlin 2.1.x with configurations for two control boards. The V1.1 board configuration is proven working. The Pro H723 configuration is in development for the Ender 3 V3 SE conversion.

## Repository structure

I'm not 100% sure yet how to structure the repo. Please let me know what would work well. Current structure organises by printer models and firmware by control board type.

I tried to keep things simple. Hardware files go in printer-specific folders. Firmware configurations are organised by the actual control board used, not by printer model, since the same board can work across different printers.

## Get involved

The project is very much community-driven. Your feedback on repository organisation and documentation would help a lot.

Join the [Discord](https://discord.gg/75Hy5dMwTJ) for discussions, support, and feedback. Or check out the [GitHub repo](https://github.com/dennisklappe/rep5x) and let me know what you think.

More detailed assembly instructions, calibration guides, and additional printer support will be added as development continues.