#!/bin/sh
# Downloads the NASA source models that build_models.py needs into tools/blender/sources/ (not kept in git).
# NASA 3D Resources: https://github.com/nasa/NASA-3D-Resources ("free and without copyright";
# NASA media guidelines apply: https://www.nasa.gov/nasa-brand-center/images-and-media).
set -e
cd "$(dirname "$0")"
mkdir -p sources
B="https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models"
curl -fL -o sources/emu.glb "$B/Extravehicular%20Mobility%20Unit/Extravehicular%20Mobility%20Unit.glb"
curl -fL -o sources/iss_b.glb "$B/International%20Space%20Station%20(ISS)%20(B)/International%20Space%20Station%20(ISS)%20(B).glb"
curl -fL -o sources/crew_lock_bag.glb "$B/Crew%20Lock%20Bag/Crew%20Lock%20Bag.glb"
curl -fL -o sources/pistol_grip_tool.glb "$B/Pistol%20Grip%20Tool/Pistol%20Grip%20Tool.glb"
