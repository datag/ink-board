// enclosure/ink-board.scad
// First-version: hollow box with 45° chamfer on long side
// No fillets, no display slot. Inner cavity clipped so angled face remains solid.

// Parameters
L = 160;      // outer length (mm)
W = 80;       // outer width  (mm)
H = 80;       // outer height (mm)
wall_t = 2.5; // wall thickness (mm)
chamfer = 50; // chamfer height from top (mm)

eps = 1; // small oversize to avoid boolean artifacts

module outer_box() {
  // bottom at Z=0 (open), extend to Z=H
  translate([0, 0, 0]) cube([L, W, H], center=false);
}

module inner_cavity() {
  // inner cavity extends up to leave wall_t at the top (fully hollow enclosure)
  inner_h = max(0, H - wall_t); // cavity height, leave top wall thickness
  inner_x = max(0, L - 2*wall_t);
  inner_y = max(0, W - 2*wall_t);
  translate([wall_t, wall_t, 0]) cube([inner_x, inner_y, inner_h], center=false);
}

module chamfer_wedge() {
  // Triangular prism removed from top-front-long edge
  // Built with linear_extrude of a right triangle as in model.txt
  points = [ [-H - eps, chamfer + eps], [-H - eps, 0], [-H + chamfer, 0] ];
  // rotate so extrusion axis aligns with world X
  rotate([0, 90, 0]) linear_extrude(height = L + 2*eps) polygon(points);
}

// Chamfer panel: solid panel that covers the chamfer face (thickness = wall_t)
module chamfer_panel() {
  // panel centered on chamfer face; small eps oversize to ensure clean booleans
  face_w = chamfer * sqrt(2); // true face width along the angled face
  translate([L/2, chamfer/2, H - chamfer/2 - wall_t + 1])
    rotate([45, 0, 0])
      cube([L, face_w - wall_t, wall_t], center=true);
}

// Display slot parameters
slot_l = 70; // mm (visible width along X)
slot_w = 30; // mm (visible height across face)
slot_cut = wall_t + 4; // cutter depth to ensure full cut-through

module display_slot() {
  // cutter box centered on the chamfer face, rotated so it cuts perpendicular to face
  // Reorder cube dimensions so the face-visible height uses slot_w (30 mm)
  translate([L/2, chamfer/2, H - chamfer/2 - wall_t])
    rotate([45, 0, 0])
      translate([-slot_l/2, -slot_w/2, -slot_cut/2])
        cube([slot_l, slot_w, slot_cut]);
}

// Final model: union of chamfered shell + panel, then subtract the slot so it is centered
difference() {
  union() {
    difference() {
      outer_box();
      inner_cavity();
      chamfer_wedge();
    }
    chamfer_panel();
  }
  display_slot();
}
