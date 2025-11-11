---
title: 'Current state printer'
description: 'Understanding the existing Rep5x hardware and building on previous research achievements'
date: 2025-09-15
image: '/images/blog/cad-model-rw2-print-head.png'
categories: ['hardware', 'history']
author:
  name: 'Dennis Klappe'
  designation: 'Masters Student'
  avatar: '/images/team/dennis-klappe.webp'
---

In 2023, my supervisor Janis Andersons built the first version of this 5-axis printer for his master's thesis. He took a standard Ender 5 Pro and added a 2-axis print-head retrofit that could tilt and rotate the nozzle.

## What Janis achieved

Janis designed what he called the "robot wrist" (RW2), a print-head that adds two rotational axes to a standard printer. The A-axis rotates around the vertical Z-axis (like turning your head left and right), while the B-axis tilts the nozzle forward and back.

![CAD model of RW2 print-head](/images/blog/cad-model-rw2-print-head.png)
*CAD model of RW2 print-head (Andersons, 2023)*

He kept it simple. The design uses standard NEMA17 stepper motors with 3 to 1 belt reduction for both axes. Everything can be 3D printed except for some bearings, belts, and electronics. The whole retrofit costs under €150.

His test prints proved the concept. He printed tubes with 90-degree overhangs without any supports. Surface quality on angled surfaces improved compared to standard printing. The dimensional accuracy stayed within 0.6mm, which is decent for a first prototype.

![Ender 5 Pro with retrofit RW2 print-head, executing a large print](/images/blog/ender-5-pro-rw2-retrofit.png)
*Ender 5 Pro with retrofit RW2 print-head, executing a large print (Andersons, 2023)*

## Hardware details

Why did Janis choose specific components? Most 3D printer boards support 5 stepper motors (X, Y, Z1, Z2, E), but 5-axis printing needs 6 motors (X, Y, Z, A, B, E). Janis used the BTT Octopus board with TMC2208 stepper drivers, costing €107.50 for the electronics (way cheaper nowadays).
 
The mechanical design keeps things simple. Most parts can be 3D printed, and the rest are standard components you probably have lying around.

### Key components (simplified)
- **Motors**: 2x NEMA17 steppers (€24 total)
- **Bearings**: 608 2RS bearings (€0.64)
- **Belts and pulleys**: GT2 timing belt and pulleys (€12.60)
- **Hardware**: Various M3 bolts and heat-set inserts (€3)
- **3D printed parts**: About 27g of filament
- **Total mechanical parts**: ~€33

With the BTT Octopus board and drivers, the total retrofit cost comes to around €140.

## Current status

So where does that leave us? We have a working 5-axis printer. It prints overhangs without supports, improves surface quality on angled faces, and costs less than €150 to build.

But it's not perfect. The RW2 print-head reduced the build height, the accuracy got worse and the B-axis motor overheats during long prints. Complicated parts do not print well at the moment. Most importantly, there's no easily accessible software to actually use these capabilities or a way for other makers to recreate the project.

That's where my work begins. The hardware exists, it's been tested, and it works. Now we need to make it accessible to everyone else.