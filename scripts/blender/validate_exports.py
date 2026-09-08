"""Validate generated binary glTF assets without third-party dependencies."""

import json
import pathlib
import struct
import sys


STAGES = ('pit', 'liner', 'stack', 'cover', 'restoration')
MAX_BYTES = 12 * 1024 * 1024


def read_glb(path):
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError('file is shorter than a GLB header')
    magic, version, declared_length = struct.unpack_from('<4sII', data, 0)
    if magic != b'glTF':
        raise ValueError('invalid GLB magic')
    if version != 2:
        raise ValueError(f'unsupported glTF version {version}')
    if declared_length != len(data):
        raise ValueError(f'declared length {declared_length} != {len(data)}')
    json_length, chunk_type = struct.unpack_from('<I4s', data, 12)
    if chunk_type != b'JSON':
        raise ValueError('first GLB chunk is not JSON')
    json_start = 20
    json_end = json_start + json_length
    document = json.loads(data[json_start:json_end].decode('utf-8').rstrip('\x00 '))
    return data, document


def validate_stage(directory, stage):
    path = directory / f'{stage}.glb'
    if not path.is_file():
        raise ValueError('file is missing')
    data, document = read_glb(path)
    if len(data) > MAX_BYTES:
        raise ValueError(f'{len(data)} bytes exceeds {MAX_BYTES}')
    if not document.get('scenes') or not document.get('nodes') or not document.get('meshes'):
        raise ValueError('scene, node or mesh array is empty')
    scene_index = document.get('scene', 0)
    scene_name = document['scenes'][scene_index].get('name', '')
    if stage.lower() not in scene_name.lower():
        raise ValueError(f'scene name {scene_name!r} does not include {stage!r}')
    primitive_count = sum(len(mesh.get('primitives', [])) for mesh in document['meshes'])
    if primitive_count == 0:
        raise ValueError('asset contains no mesh primitives')
    return {
        'bytes': len(data),
        'meshes': len(document['meshes']),
        'materials': len(document.get('materials', [])),
        'primitives': primitive_count,
    }


def main(argv=None):
    arguments = sys.argv[1:] if argv is None else argv
    directory = pathlib.Path(arguments[0] if arguments else 'public/assets/models')
    failures = []
    for stage in STAGES:
        try:
            stats = validate_stage(directory, stage)
            print(
                f"PASS {stage:11} bytes={stats['bytes']:8} meshes={stats['meshes']:3} "
                f"materials={stats['materials']:2} primitives={stats['primitives']:3}"
            )
        except (OSError, ValueError, json.JSONDecodeError) as error:
            failures.append(stage)
            print(f'FAIL {stage:11} {error}')
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
