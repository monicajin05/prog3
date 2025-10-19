import json
import argparse
    
def convert_obj_to_json(obj_filepath, json_filepath):
    """
    Reads a Wavefront .obj file and converts it to a custom JSON format.

    This script parses vertices, normals, and faces from the .obj file.
    It handles triangular and quad faces, triangulating quads automatically.
    The output is a JSON file containing a single model object with vertices,
    normals, triangles, and a default material.
    """
    vertices = []
    normals = []
    triangles = []
    vertices = []
    normalsTEMP = []
    triangles = []
    vidx_to_nidx_mapping = {}

    try:
        with open(obj_filepath, 'r') as obj_file:
            for line in obj_file:
                parts = line.strip().split()
                if not parts:
                    continue

                # Vertex
                if parts[0] == 'v':
                    vertices.append([float(parts[1]), float(parts[2]), float(parts[3])])

                # Normal
                elif parts[0] == 'vn':
                    normalsTEMP.append([float(parts[1]), float(parts[2]), float(parts[3])])

                # Face
                elif parts[0] == 'f':
                    face_vertices = []
                    for part in parts[1:]:
                        indices = part.split('/')
                        v_index = int(indices[0]) - 1

                        # Handle normal index if present
                        if len(indices) >= 3 and indices[2]:
                            n_index = int(indices[2]) - 1
                            vidx_to_nidx_mapping[v_index] = n_index
                        else:
                            # no normal found, default to first normal or zero
                            vidx_to_nidx_mapping[v_index] = 0

                        face_vertices.append(v_index)

                    # Triangulate if needed
                    if len(face_vertices) == 3:
                        triangles.append(face_vertices)
                    elif len(face_vertices) == 4:
                        triangles.append([face_vertices[0], face_vertices[1], face_vertices[2]])
                        triangles.append([face_vertices[0], face_vertices[2], face_vertices[3]])

        # Map normals to vertices (after reading file)
        normals = [normalsTEMP[vidx_to_nidx_mapping.get(i, 0)] for i in range(len(vertices))]

    except FileNotFoundError:
        print(f"Error: The file '{obj_filepath}' was not found.")
        return
    except Exception as e:
        print(f"An error occurred while parsing the file: {e}")
        return

    # Assemble final model
    model_data = [
        {
            "material": {
                "ambient": [0.1, 0.1, 0.1],
                "diffuse": [0.7, 0.7, 0.7],
                "specular": [0.2, 0.2, 0.2],
                "n": 10
            },
            "vertices": vertices,
            "normals": normals,
            "triangles": triangles
        }
    ]

    try:
        with open(json_filepath, 'w') as json_file:
            json.dump(model_data, json_file, indent=2)
        print(f"Successfully converted '{obj_filepath}' to '{json_filepath}'")
    except Exception as e:
        print(f"An error occurred while writing the JSON file: {e}")



if __name__ == '__main__':
    # Set up command-line argument parsing
    parser = argparse.ArgumentParser(description='Convert .obj files to a custom .json format.')
    parser.add_argument('input_file', help='The path to the input .obj file.')
    parser.add_argument('output_file', help='The path for the output .json file.')
    
    args = parser.parse_args()
    
    # Run the conversion
    convert_obj_to_json(args.input_file, args.output_file)

