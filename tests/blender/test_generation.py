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

    def test_pit_floor_is_below_the_slope_edge(self):
        collection = create_site_terrain('pit', seed=7639)
        floor = collection.objects['PitFloor']
        slope = collection.objects['PitSlope']
        self.assertLess(floor.location.z, slope.location.z - 2.0)
        self.assertGreater(floor.dimensions.x, 42.0)
        self.assertGreater(floor.dimensions.y, 30.0)

    def test_stage_details_are_distinct(self):
        expectations = {
            'pit': {'PitShoulder', 'PitSlope', 'PitFloor'},
            'liner': {'PitShoulder', 'Geomembrane', 'LinerFloor'},
            'stack': {
                'HaulRoad', 'BenchRoad', 'CompactionBands', 'SlopeRills',
                'WorkingCellWest', 'WorkingCellEast',
            },
            'cover': {'CoverSoil'},
            'restoration': {'VegetationPatches', 'Shrubs', 'YoungTrees'},
        }
        for stage, required in expectations.items():
            clear_scene()
            collection = create_site_terrain(stage, seed=7639)
            self.assertTrue(
                required <= {obj.name for obj in collection.objects},
                f'{stage} is missing {required - {obj.name for obj in collection.objects}}',
            )

    def test_ambiguous_regular_construction_details_are_absent(self):
        forbidden = {
            'pit': {'PitRim', 'PitAccessRoad', 'ToeDrain'},
            'liner': {'PitRim', 'LinerSeams', 'DrainagePipe'},
            'cover': {'WorkingCellWest', 'WorkingCellEast', 'CoverTracks',
                      'CoverHaulRoad', 'CoverBenchRoad'},
            'restoration': {'WorkingCellWest', 'WorkingCellEast',
                            'RestorationHaulRoad', 'RestorationBenchRoad'},
        }
        for stage, excluded in forbidden.items():
            clear_scene()
            names = {obj.name for obj in create_site_terrain(stage, seed=7639).objects}
            self.assertFalse(names & excluded, f'{stage} still contains {names & excluded}')

    def test_restoration_terrain_is_fully_vegetated(self):
        collection = create_site_terrain('restoration', seed=7639)
        terrain_material = collection.objects['RestorationSlope01'].data.materials[0]
        self.assertEqual(terrain_material.name, 'PG_grass')

    def test_pit_shoulder_blends_with_surrounding_soil(self):
        for stage in ('pit', 'liner'):
            clear_scene()
            collection = create_site_terrain(stage, seed=7639)
            material = collection.objects['PitShoulder'].data.materials[0]
            self.assertEqual(material.name, 'PG_rock_soil')
            color = material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value
            self.assertLess(max(color[:3]), 0.20)
            self.assertGreater(color[0], color[2] * 2.0)

    def test_stack_material_is_gray_white_and_rough(self):
        collection = create_site_terrain('stack', seed=7639)
        material = collection.objects['StackTop'].data.materials[0]
        principled = material.node_tree.nodes.get('Principled BSDF')
        color = principled.inputs['Base Color'].default_value

        self.assertGreater(min(color[:3]), 0.18)
        self.assertLess(max(color[:3]) - min(color[:3]), 0.12)
        self.assertGreater(principled.inputs['Roughness'].default_value, 0.75)

        slope_material = collection.objects['StackSlope01'].data.materials[0]
        bench_material = collection.objects['StackBench01'].data.materials[0]
        road_material = collection.objects['HaulRoad'].data.materials[0]
        self.assertNotEqual(slope_material.name, bench_material.name)
        self.assertNotEqual(bench_material.name, road_material.name)

    def test_stack_working_cells_are_asymmetric(self):
        collection = create_site_terrain('stack', seed=7639)
        west = collection.objects['WorkingCellWest']
        east = collection.objects['WorkingCellEast']

        self.assertLess(west.location.x, -2.0)
        self.assertGreater(east.location.x, 2.0)
        self.assertNotAlmostEqual(west.dimensions.x, east.dimensions.x, places=1)
        self.assertNotAlmostEqual(west.dimensions.y, east.dimensions.y, places=1)


if __name__ == '__main__':
    result = unittest.main(argv=[sys.argv[0]], exit=False)
    if not result.result.wasSuccessful():
        raise SystemExit(1)
