# Rep5x - Hardware versioning system

Version management for Rep5x hardware components and mechanical compatibility tracking.

## Hardware versioning principles

Rep5x uses **semantic versioning** to track component compatibility and mechanical iterations:

### Version format: `vMAJOR.MINOR.PATCH`

#### MAJOR version (`v1.0.0` → `v2.0.0`)
**Mechanical breaking changes** - New parts required, not backward compatible:
- **New mounting systems** - Different hole patterns, interfaces that make old parts unusable
- **Fundamental mechanical redesign** - Changed bearing sizes, shaft diameters, structural approach
- **Assembly incompatibility** - Parts that physically cannot work with previous versions
- **Different fastener requirements** - New bolt sizes, thread types that don't fit old holes

#### MINOR version (`v1.0.0` → `v1.1.0`) 
**Compatible mechanical improvements** - Mix-and-match with existing parts:
- **Sensor additions/changes** - Changed hall effect sensor carriage mount to an optical sensor
- **Component refinements** - Better bearing fit, improved strength, but same interfaces
- **Feature additions** - New mounting points added without removing old ones

#### PATCH version (`v1.0.0` → `v1.0.1`)
**Minor mechanical fixes** - Direct drop-in replacements:
- **Dimensional corrections** - Fix clearance issues, improve fits
- **Print quality improvements** - Better overhangs, support removal, surface finish  
- **Material optimizations** - Wall thickness, infill adjustments
- **Assembly ease** - Chamfers, lead-ins for easier installation

## Current hardware status

### Rep5x v1.0.0
- **Release date**: October 2025
- **Status**: Proven hardware design
- **Mechanical compatibility**: All v1.0.0 parts can mix-and-match
- **Core hardware**:
  - Universal 3D printed parts v1.0.0
  - Ender 5 Pro carriage mount v1.0.0  
  - bearings, GT2 belts, NEMA17 motors (standard sizes)

## Hardware component versioning

### Component identification
Each hardware component includes version information for compatibility tracking:

#### 3D printed parts
- **Filename format**: `B_arm_v1.0.0.3mf`, `carriage-mount_v1.1.0.3mf`
- **STEP files**: `B_arm_v1.0.0.step` (for CAD modifications)
- **Assembly files**: `FullAssem_v1.0.0.f3z` (complete assembly)

#### Hardware compatibility examples

**Example 1: Sensor upgrade (v1.0.0 → v1.1.0)**
- **Your current build**: All v1.0.0 parts
- **New sensor option**: carriage-mount_v1.1.0.3mf (adds optical sensor)
- **Compatibility**: Just print new carriage mount, keep everything else
- **Result**: Mixed v1.0.0/v1.1.0 build with sensor upgrade

**Example 2: Drive system choice (v1.1.0)**
- **Belt drive**: Use B-driven-pulley_v1.0.0.3mf (proven belt system)
- **Gear drive**: Use B-driven-gear_v1.1.0.3mf (new direct gear option)
- **Same carriage**: Both work with carriage-mount_v1.1.0.3mf
- **Builder choice**: Pick drive system that suits your needs

**Example 3: Manufacturing improvement (v1.2.0)**
- **Better bearing fit**: B_arm_v1.2.0.3mf (tighter tolerances)
- **Stronger design**: Fan-mount_v1.2.0.3mf (reinforced mounting)
- **Drop-in replacement**: Directly replace any v1.0.0 or v1.1.0 part
- **Performance upgrade**: Better reliability, same interfaces

## Upgrade paths

### Within compatible versions (v1.x)

#### v1.0.0 → v1.1.0 upgrade
1. **Optional hardware updates** - All v1.0.0 parts remain compatible, but new features available:
   - Print new carriage mount v1.1.0 for optical sensor (or keep v1.0.0 with hall effect)
   - All other v1.0.0 parts work perfectly with new carriage mount
2. **Mix and match freely** - Use any combination of v1.0.0 and v1.1.0 parts
3. **Effort required**: Only print new parts you want to upgrade


## Version tracking in builds

### For builders
When documenting your build, record:

#### Component versions used
- **3D printed parts**: Note version of each component
- **Control board**: Record firmware configuration version
- **Documentation**: Assembly guide version followed
- **Build date**: When assembly was completed

#### Benefits of version tracking
- **Troubleshooting**: Enables specific support for your configuration
- **Upgrades**: Clear path for future improvements
- **Compatibility**: Ensures replacement parts work with your build
- **Community support**: Helps others with similar configurations

### For contributors
When submitting improvements:
- **Compatibility analysis**: Does change break existing builds?
- **Version increment**: Determine appropriate version bump (major/minor/patch)
- **Testing**: Verify compatibility with existing versions

---

**Questions about versioning?** Join our [Discord community](https://discord.gg/GNdah82VBg) for discussions about current and future Rep5x releases!