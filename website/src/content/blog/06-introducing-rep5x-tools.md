---
title: 'Introducing Rep5x Tools'
description: 'Browser-based tools to help you set up, calibrate, and control your Rep5x 5-axis printer.'
date: 2025-12-15
image: '/images/blog/tools-overview.webp'
categories: ['tools', 'software']
author:
  name: 'Dennis Klappe'
  designation: 'Masters Student'
  avatar: '/images/team/dennis-klappe.webp'
featured: true
---

**Rep5x Tools** is a collection of browser-based tools to help you set up, calibrate, and use your 5-axis printer. No installation needed, just open your browser and connect to your printer.

<div class="rounded" style="overflow: hidden;">
<img src="/images/blog/tools-overview.webp" alt="Rep5x Tools overview" style="width: 100%; height: auto;">
</div>

## Available tools

### Printer Control

Control your printer directly from the browser. Jog all 5 axes, send G-code commands, and monitor position in real-time. Press Space for emergency stop.

<div class="rounded" style="overflow: hidden;">
<img src="/images/blog/tool-printer-control.webp" alt="Printer Control tool" style="width: 100%; height: auto;">
</div>

### Printer Setup

Calibrate Z height, A and B axis positions, and steps/degree. This is the essential first step before kinematic calibration.

<div class="rounded" style="overflow: hidden;">
<img src="/images/blog/tool-printer-setup.webp" alt="Printer Setup tool" style="width: 100%; height: auto;">
</div>

### LA/LB Measure

Measure your printer's LA and LB kinematic parameters with step-by-step guidance. Supports both camera-based and cone-based measurement methods.

<div class="rounded" style="overflow: hidden;">
<img src="/images/blog/tool-la-lb-measure.webp" alt="LA/LB Measure tool" style="width: 100%; height: auto;">
</div>

### Vase Generator

Generate sample 5-axis vase mode G-code to test your printer. Create elbow pipes, mushroom vases, and other curved geometries that are impossible with conventional 3-axis printing.

<div class="rounded" style="overflow: hidden;">
<img src="/images/blog/tool-vase-generator.webp" alt="Vase Generator tool" style="width: 100%; height: auto;">
</div>

### G-code Viewer

Visualise and animate 5-axis G-code in 3D. Preview your prints with proper A/B axis rotation, inverse kinematics support, collision detection, and real-time animation.

<div class="rounded" style="overflow: hidden;">
<img src="/images/blog/tool-gcode-viewer.webp" alt="G-code Viewer tool" style="width: 100%; height: auto;">
</div>

## Hardware: Rep5x Camera

Some tools work even better with the optional **Rep5x Camera** module, a simple USB camera with built-in LED lighting that mounts to your printer's bed.

<div class="rounded" style="overflow: hidden;">
<img src="/images/blog/rep5x-camera.webp" alt="Rep5x Camera module" style="width: 100%; height: auto;">
</div>

The camera enables precise measurements by providing a close-up view of the nozzle. In the LA/LB Measure tool, you align the nozzle tip to a crosshair on screen and confirm the position. Much easier than eyeballing it from the side of your printer.

The upcoming Calibrator tool will also use this camera for automated error mapping across all A and B angles. If you don't want to build the camera module, no problem. **All tools have alternative methods** that work without additional hardware, like the cone-based measurement method already available in LA/LB Measure.

## Coming soon: Calibrator

The **Calibrator** tool is currently in development. It works like bed leveling mesh but for your rotational axes. Measure position errors across different A and B angles to generate error curves, then run your G-code through the tool to apply compensation.

## Try it out

All tools are available at [tools.rep5x.com](https://tools.rep5x.com). Connect to your printer via USB and you're good to go.

Questions or feedback? **[Join our Discord](https://discord.gg/GNdah82VBg)**!
