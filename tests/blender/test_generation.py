import os
import sys
import unittest

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BLENDER_SCRIPTS = os.path.join(ROOT, 'scripts', 'blender')
if BLENDER_SCRIPTS not in sys.path:
    sys.path.insert(0, BLENDER_SCRIPTS)

from terrain_generator import create_site_terrain


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != 'Collection':
            bpy.data.collections.remove(collection)


class TerrainGenerationTest(unittest.TestCase):
    def setUp(self):
        clear_scene()

    def test_stack_has_four_terraces_and_broad_top(self):
        collection = create_site_terrain('stack', seed=7639)
        names = {obj.name for obj in collection.objects}

        self.assertTrue({
            'StackSlope01', 'StackSlope02', 'StackSlope03', 'StackSlope04',
            'StackBench01', 'StackBench02', 'StackBench03', 'StackBench04',
            'StackTop',
        } <= names)
        top = collection.objects['StackTop']
        self.assertGreater(top.dimensions.x, 32.0)
        self.assertGreater(top.dimensions.y, 24.0)
        self.assertLess(top.dimensions.z, 1.2)

    def test_stack_boundary_is_not_a_regular_ellipse(self):
        collection = create_site_terrain('stack', seed=7639)
        slope = collection.objects['StackSlope01']
        outer_vertices = [
            vertex.co for vertex in slope.data.vertices
            if vertex.co.z < 0.4
        ]
        normalized_radii = [
            ((vertex.x / 54.0) ** 2 + (vertex.y / 44.0) ** 2) ** 0.5
            for vertex in outer_vertices
        ]
        self.assertGreater(max(normalized_radii) - min(normalized_radii), 0.06)

    def test_pit_floor_is_below_the_rim(self):
        collection = create_site_terrain('pit', seed=7639)
        floor = collection.objects['PitFloor']
        rim = collection.objects['PitRim']
        self.assertLess(floor.location.z, rim.location.z - 2.0)
        self.assertGreater(floor.dimensions.x, 42.0)
        self.assertGreater(floor.dimensions.y, 30.0)


if __name__ == '__main__':
    result = unittest.main(argv=[sys.argv[0]], exit=False)
    if not result.result.wasSuccessful():
        raise SystemExit(1)
