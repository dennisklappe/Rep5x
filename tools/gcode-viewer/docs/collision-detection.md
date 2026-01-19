# Collision detection

This document explains how the collision detection system works in the G-code viewer.

## Overview

```mermaid
flowchart TD
    A[User enables collision detection] --> B[Get printhead parameters]
    B --> C[Loop through all G-code commands]
    C --> D{Command has movement?}
    D -->|No| C
    D -->|Yes| E[Update position]
    E --> F{Path > 20 points AND\n> 10 steps since last collision?}
    F -->|No| G{Has extrusion?}
    F -->|Yes| H[Check collisions]
    H --> J{Collision detected?}
    J -->|Yes| K[Record collision point]
    J -->|No| G
    K --> G
    G -->|Yes| I[Add point to printed path]
    G -->|No| C
    I --> C
    C -->|Done| L[Display collision markers]
```

### Why these checks?

- **Path > 20 points**: Skip collision checks at the start when there's barely anything printed yet
- **> 10 steps since last collision**: Avoid recording hundreds of collision points in the same area
- **Has extrusion**: Only extruded material is added to the path (you can't collide with air)
- **All moves are checked**: Both travel moves (G0) and print moves (G1) check for collisions with the printed path

## Collision check process

For each position, the system checks if any part of the printhead collides with the build plate or previously printed path.

```mermaid
flowchart TD
    subgraph Input
        A[Current position X, Y, Z, A, B]
        B[Printed path points]
        C[Printhead geometry]
    end

    A --> D[Build rotation matrix from C and B angles]

    D --> E{Check build plate collisions}
    E --> F[Heatblock corners]
    E --> G[Nozzle bottom edge]
    E --> H[Cable outer end]

    F --> I{Any point Y < 0?}
    G --> I
    H --> I

    I -->|Yes| J[Return: Collision!]
    I -->|No| K{Check path collisions}

    K --> L[For each path point]
    L --> M[Transform to local printhead space]
    M --> N{Inside nozzle cylinder?}
    M --> O{Inside heatblock box?}
    M --> P{Inside cable cylinder?}

    N -->|Yes| J
    O -->|Yes| J
    P -->|Yes| J

    N -->|No| O
    O -->|No| P
    P -->|No| Q{More path points?}
    Q -->|Yes| L
    Q -->|No| R[Return: No collision]
```

## Printhead geometry

The printhead is defined in local space with the nozzle tip at the origin.

```mermaid
flowchart LR
    subgraph Printhead components
        A[Nozzle cylinder]
        B[Heatblock box]
        C[Cable cylinder]
    end

    subgraph Nozzle
        A1[radius: 4.5mm]
        A2[bottom: 2mm]
        A3[top: 8mm]
    end

    subgraph Heatblock
        B1[halfSize: 12 x 10 x 12mm]
        B2[center: 2, 18, 0mm]
    end

    subgraph Cable
        C1[radius: 3mm]
        C2[center: -15, 18, 0mm]
        C3[halfLength: 5mm]
    end

    A --> A1
    A --> A2
    A --> A3
    B --> B1
    B --> B2
    C --> C1
    C --> C2
    C --> C3
```

## Coordinate transformation

The collision detection uses matrix transformations to check collisions efficiently.

```mermaid
flowchart TD
    subgraph "Build plate collision"
        A1[Local printhead point] --> B1[Apply rotation matrix]
        B1 --> C1[Add nozzle tip position]
        C1 --> D1{World Y < 0?}
        D1 -->|Yes| E1[Collision with bed]
    end

    subgraph "Path collision"
        A2[World path point] --> B2[Subtract nozzle tip position]
        B2 --> C2[Apply inverse rotation matrix]
        C2 --> D2[Local space point]
        D2 --> E2{Inside component bounds?}
        E2 -->|Yes| F2[Collision with path]
    end
```

## Component collision checks

### Nozzle cylinder
```
distance_from_axis = sqrt(x² + z²)
collision = distance_from_axis < radius AND y > bottom AND y < top
```

### Heatblock box
```
relative = point - center
collision = |rel.x| < halfSize.x AND |rel.y| < halfSize.y AND |rel.z| < halfSize.z
```

### Cable cylinder (horizontal along X)
```
relative = point - center
distance_from_axis = sqrt(rel.y² + rel.z²)
collision = distance_from_axis < radius AND |rel.x| < halfLength
```
