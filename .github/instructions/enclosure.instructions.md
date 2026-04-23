---
applyTo: "enclosure/**"
---

# Copilot instructions for ink-board enclosure

This module contains the OpenSCAD design for a 3D-printable enclosure for the
ink-board ePaper device. See `enclosure/model.txt` for the full model description.

## Render and inspect commands

OpenSCAD version 2021.01 is installed. Always use the CLI for renders — do NOT
open the GUI. The working directory for all commands is `enclosure/`.

```bash
# Isometric perspective render (beauty shot)
openscad --render \
  --camera=80,40,100,55,0,25,350 \
  --imgsize=1200x800 \
  -o render_iso.png ink-board.scad

# Face-on render (looking straight at the angled display face)
openscad --render \
  --camera=80,-60,65,90,0,0,200 \
  --imgsize=1200x800 \
  -o /tmp/face_on.png ink-board.scad

# Top-down render
openscad --render \
  --camera=80,40,200,0,0,0,200 \
  --imgsize=1200x800 \
  -o /tmp/top_down.png ink-board.scad

# Cross-section at X=80 (midpoint along length) — useful for slot debugging
# Use intersection() in a wrapper script or add a temporary slab in the .scad
```

Camera parameter format: `tx,ty,tz,rx,ry,rz,dist`
- `tx,ty,tz` — look-at target (translate)
- `rx,ry,rz` — camera rotation in degrees
- `dist`     — distance from target

`--render` forces full CGAL evaluation (catches mesh errors). Omit for faster
preview-quality renders during iteration.

## File structure

```
enclosure/
  ink-board.scad    — sole design file; all geometry defined here
  model.txt         — durable prose description of the intended model
  render_iso.png    — committed beauty render (regenerate after design changes)
```

## Model overview

A bottom-less box (160 × 80 × 80 mm, wall 2.5 mm) printed upside-down.
A 45° chamfer (leg = 30 mm) is cut from the top-front-long edge, creating an
angled face (≈42.4 mm wide, 160 mm long) with a 70 × 30 mm display window.
The outer box has 1.5 mm fillets on all visible edges.

Key parameters (all mm):

| Symbol     | Value | Meaning                                      |
|------------|-------|----------------------------------------------|
| `L`        | 160   | outer length                                 |
| `W`        |  80   | outer width                                  |
| `H`        |  80   | outer height                                 |
| `wall_t`   |   2.5 | wall thickness (all sides + top)             |
| `chamfer`  |  30   | 45° chamfer leg — face width = chamfer × √2  |
| `slot_l`   |  70   | display slot length (along L)                |
| `slot_w`   |  30   | display slot width (across face)             |
| `slot_cut` |  15   | cutter depth through face                    |
| `fillet_r` |   1.5 | outer edge fillet radius                     |
| `$fn`      |  64   | circle/sphere resolution                     |

## Key geometry conventions

### Cross-section (YZ plane, short-end view)

```
     ___________
    /            |   ← 45° angled face (chamfer leg = 30 mm each side)
   |             |
   |             |   total height = 80 mm
   |_____________|   ← open bottom (Z = 0)
```

### Coordinate system
- X axis: along the 160 mm length (0 → 160)
- Y axis: from front (Y=0) to rear (Y=80)
- Z axis: from open bottom (Z=0) to closed top (Z=80)
- Angled face center in world coords: `(L/2, chamfer/2, H−chamfer/2)` = `(80, 15, 65)`
- Angled face outward normal: `[0, −1/√2, +1/√2]` (forward-upward)

### Chamfer wedge (linear_extrude approach)
The triangular prism is built with `rotate([0,90,0]) linear_extrude(L+2·eps)` of a
right-triangle polygon. The 2D polygon uses local coordinates where:
  `local_x = −world_z`,  `local_y = world_y`

Triangle vertices (CCW, positive area required):
```
[(−H−eps,  chamfer+eps),   // world (y=chamfer+eps, z=H+eps)
 (−H−eps,  0           ),  // world (y=0,           z=H+eps)
 (−H+chamfer, 0        )]  // world (y=0,           z=H−chamfer)
```
The `eps=1` oversizing ensures clean boolean subtraction at shared faces.

### Display slot rotation
`rotate([45, 0, 0])` aligns the cube's Z axis with the face outward normal,
so the cutter penetrates perpendicularly through the angled face.
The slot is centered at the face center before rotating.

## OpenSCAD module structure

```
filleted_box(l, w, h, r)   Solid box with filleted vertical edges and rounded top
                            corners; bottom rim stays sharp. Built with hull() of
                            cylinders (vertical edges) and spheres (top corners).

outer_shell()               Hollow shell: filleted_box minus inner cavity.
                            Inner cavity starts at Z=0 (open bottom), leaves
                            wall_t on all five closed sides.

chamfer_wedge()             Triangular prism removed from top-front-long edge.
                            Built via rotate([0,90,0]) + linear_extrude of a
                            right-triangle polygon — NOT polyhedron (see pitfalls).
                            Coordinate mapping: local_x = −world_z, local_y = world_y;
                            extrusion axis → world X.

display_slot()              Rectangular cutter (slot_l × slot_w × slot_cut) centered
                            on the angled face. Placed at the face center
                            (L/2, chamfer/2, H−chamfer/2), then rotate([45,0,0])
                            aligns the cut perpendicular to the face.

Main:  difference() { outer_shell(); chamfer_wedge(); display_slot(); }
```

## Print orientation

Model origin: open bottom at Z=0. Place on build plate with Z=0 face down (box
printed "upside-down"). The 45° angled face overhangs at 45° — within the typical
no-support threshold. All other faces are vertical or horizontal; no supports needed.

## Known pitfalls

### 1. Avoid `polyhedron` for the chamfer wedge
OpenSCAD's `polyhedron` with incorrect face winding produces a "mesh not closed"
CGAL error. Use `linear_extrude` + `polygon` instead (already done in the current
implementation).

### 2. Slot spans the full face (design bug — unfixed as of initial commit)
**Symptom**: From the front, the entire 42.4 mm × 160 mm chamfer area appears as a
large dark opening; the 70 × 30 mm slot boundary is invisible.

**Root cause**: `outer_shell()` hollows the box with an inner cavity that extends
into the chamfer region. After `chamfer_wedge()` removes the top-front corner, only
a ~3.54 mm thin shell wall remains on the angled face. The hollow box interior is
immediately behind it, making the whole chamfer region look like a gaping hole.

**Fix approach**: The angled face must be a solid panel with only the `display_slot`
as the opening. Options:
  - Clip the inner cavity to stop at `Z = H − chamfer` in the front-face region
  - Add a `chamfer_fill()` module that re-adds solid material at the face, then
    subtract only the `display_slot` through it

### 3. Cross-section renders appear blank
If a cross-section slab is too thin (<5 mm), or the camera `tx` target is outside
the model bounds, the render produces a blank image. Target the camera at the model
center `(80, 40, 40)` and increase slab thickness to ≥10 mm.

## Commit convention

After any design change, regenerate `render_iso.png` and include it in the commit
alongside the `.scad` change.
