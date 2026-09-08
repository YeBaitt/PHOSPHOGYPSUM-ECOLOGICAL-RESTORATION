"""Clean and export one generated stage collection as binary glTF."""

import pathlib

import bpy


def _triangle_count(collection):
    count = 0
    for obj in collection.objects:
        if obj.type != 'MESH':
            continue
        obj.data.calc_loop_triangles()
        count += len(obj.data.loop_triangles)
    return count


def export_stage(collection, stage_id, output_dir):
    output_directory = pathlib.Path(output_dir).resolve()
    output_directory.mkdir(parents=True, exist_ok=True)
    output_path = output_directory / f'{stage_id}.glb'

    bpy.ops.object.select_all(action='DESELECT')
    selected = []
    for obj in collection.all_objects:
        obj.select_set(True)
        selected.append(obj)
        if obj.type == 'MESH':
            obj.data.validate(clean_customdata=False)
            obj.data.update(calc_edges=True)
    if not selected:
        raise RuntimeError(f'Cannot export empty stage collection: {stage_id}')

    bpy.context.view_layer.objects.active = selected[0]
    bpy.context.scene.name = f'Phosphogypsum_{stage_id}'
    triangle_count = _triangle_count(collection)
    if triangle_count > 250_000:
        raise RuntimeError(f'{stage_id} has {triangle_count} triangles; limit is 250000')

    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_materials='EXPORT',
        export_yup=True,
    )
    if not output_path.is_file():
        raise RuntimeError(f'Blender did not create {output_path}')
    print(
        f'EXPORTED {stage_id}: objects={len(selected)} '
        f'triangles={triangle_count} bytes={output_path.stat().st_size}'
    )
    return output_path

