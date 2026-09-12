"""Blender command-line entry point for phosphogypsum stage generation."""

import argparse
import os
import sys

import bpy

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from export_glb import export_stage
from terrain_generator import STAGE_IDS, create_site_terrain


def parse_args():
    arguments = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', choices=('all',) + STAGE_IDS, default='all')
    parser.add_argument('--output', default='public/assets/models')
    parser.add_argument('--seed', type=int, default=7639)
    return parser.parse_args(arguments)


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != 'Collection':
            bpy.data.collections.remove(collection)


def main():
    args = parse_args()
    clear_scene()
    stages = STAGE_IDS if args.stage == 'all' else (args.stage,)
    for stage_id in stages:
        collection = create_site_terrain(stage_id, seed=args.seed)
        export_stage(collection, stage_id, args.output)


if __name__ == '__main__':
    main()
