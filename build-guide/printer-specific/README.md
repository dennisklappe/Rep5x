# Rep5x - Printer-specific adaptations

Custom components and documentation for adapting Rep5x to specific 3D printer models.

## Overview

Each printer model requires specific adaptation components to interface with the universal Rep5x system. This folder contains printer-specific files that supplement the universal components in [`../universal-parts/`](../universal-parts/).

## Supported printer models

### [Ender 5 Pro](ender-5-pro/) - Working prototype
- **Status**: Fully functional and documented
- **Components**: Custom carriage mount, adaptation notes
- **Testing**: Proven design with working prototype
- **Community**: Active builders and support available

### [Ender 3 V3 SE](ender-3-v3-se/) - In development  
- **Status**: Hardware adaptation in progress
- **Components**: Carriage mount, Z endstop modifications planned
- **Timeline**: Development ongoing
- **Help needed**: Testing and validation

## Printer-specific components

### What varies by printer model
While the core Rep5x components in [`universal-parts/`](../universal-parts/) are universal, these elements require printer-specific design:

#### Carriage mount (Required for all printers)
- **Purpose**: Interface between printer's X-carriage and Rep5x rotation assembly
- **Variations**: Mounting hole patterns, carriage dimensions, clearances
- **Files provided**: Both 3MF (printing) and STEP (modification) formats

#### Frame modifications (Varies by printer)
- **Endstop relocations**: Some printers need endstop position changes
- **Cable routing**: Printer-specific wire management solutions  
- **Clearance adjustments**: Frame modifications for rotation range
- **Power supply**: Adequate capacity verification

#### Electronics integration (Printer-dependent)
- **Control board mounting**: Electronics enclosure considerations
- **Wiring harness**: Custom lengths and routing paths
- **Power requirements**: Verification of adequate supply capacity

## Adaptation requirements by model

### Ender 5 Pro adaptations
- **Carriage mount**: Custom bracket for Ender 5 Pro X-carriage
- **Electronics**: BTT Octopus V1.1 fits in stock electronics enclosure
- **Modifications**: Minimal - mostly additive components
- **Build volume impact**: ~10mm reduction in X/Y due to rotation assembly

### Ender 3 V3 SE adaptations (Planned)
- **Carriage mount**: New design for Ender 3 V3 SE X-carriage  
- **Z endstop**: Relocation required for clearance
- **Electronics**: BTT Octopus Pro H723 requires enclosure modification
- **Modifications**: Z-axis endstop relocation, potential frame reinforcement

## Adding new printer support

### Assessment criteria
Before adapting Rep5x to a new printer model, verify:

#### Mechanical compatibility
- **Build volume**: Minimum 200x200x200mm recommended
- **Carriage design**: Adequate mounting points and access
- **Frame rigidity**: Sufficient to handle additional loads
- **Clearances**: Space for rotation assembly and full motion range

#### Electronics compatibility  
- **Power supply**: Adequate capacity for additional motors (~65W extra)
- **Control board space**: Room for 6+ stepper driver board
- **Wiring access**: Paths for additional motor and sensor cables

#### Community viability
- **User base**: Sufficient interest to justify development effort
- **Documentation**: Availability of printer specifications and community
- **Accessibility**: Reasonable cost and availability of base printer

### Adaptation process

#### Phase 1: Assessment and planning
1. **Mechanical survey** - CAD analysis of carriage and frame design
2. **Electronics review** - Power and control board integration options  
3. **Community consultation** - Interest level and resource availability
4. **Compatibility verification** - Test basic mechanical interfaces

#### Phase 2: Design and prototyping
1. **Carriage mount design** - Custom bracket for X-carriage interface
2. **Clearance analysis** - Verify rotation range and collision avoidance
3. **Electronics integration** - Control board mounting and wiring solutions
4. **Prototype testing** - Build and test initial adaptation

#### Phase 3: Documentation and validation
1. **Documentation creation** - Adaptation-specific build guide
2. **Community testing** - Multiple builders verify design
3. **Iteration and refinement** - Address issues and improve design
4. **Final validation** - Proven functionality and reliability

### Design guidelines for new adaptations

#### Mechanical principles
- **Minimize modifications** - Prefer additive over subtractive changes
- **Maintain accessibility** - Preserve maintenance and upgrade paths
- **Standard interfaces** - Use common fasteners and mounting methods
- **Safety first** - Ensure adequate clearances and motion limits

#### Electronics principles  
- **Standard components** - Use proven control boards and drivers
- **Proper thermal management** - Adequate cooling for all components
- **Safety systems** - Emergency stops and thermal protection
- **Future compatibility** - Design for firmware and hardware updates

## Contributing new printer support

### Documentation requirements
For each new printer adaptation, provide:

#### Essential files
- **Carriage mount** - Both 3MF and STEP formats with version info
- **Adaptation guide** - Specific build instructions and modifications required
- **BOM additions** - Printer-specific components and fasteners  
- **Assembly photos** - Visual documentation of key steps

#### Testing verification
- **Functional testing** - Full motion range and operation verification
- **Print quality** - Successful 5-axis prints with good surface finish
- **Safety validation** - Proper endstop function and emergency procedures
- **Documentation accuracy** - Independent builders can follow instructions

### Community process
1. **Proposal discussion** - Community interest and feasibility assessment
2. **Development coordination** - Resource sharing and collaboration
3. **Testing phase** - Multiple builders validate design
4. **Documentation review** - Community feedback on instructions  
5. **Integration** - Inclusion in main repository with ongoing support

## Getting help with adaptations

### Resources available
- **Discord community** - Real-time discussion and problem-solving
- **CAD files** - Universal components available for interface design
- **Reference designs** - Existing adaptations as design guides
- **Testing support** - Community members available for validation

### Development support
- **Design consultation** - Mechanical and electronics guidance  
- **Prototyping assistance** - Community members with different printers
- **Documentation help** - Writing and formatting assistance
- **Testing coordination** - Organized validation across multiple builders

---

**Want to add support for your printer?** Start a discussion in our [Discord community](https://discord.gg/GNdah82VBg) to assess feasibility and coordinate development efforts!