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

    try:
        with open(obj_filepath, 'r') as obj_file:
            for line in obj_file:
                parts = line.strip().split()
                if not parts:
                    continue

                # Parse vertex positions (e.g., "v x y z")
                if parts[0] == 'v':
                    vertices.append([float(parts[1]), float(parts[2]), float(parts[3])])
                
                # Parse vertex normals (e.g., "vn nx ny nz")
                elif parts[0] == 'vn':
                    normals.append([float(parts[1]), float(parts[2]), float(parts[3])])
                
                # Parse faces (e.g., "f v1/vt1/vn1 v2/vt2/vn2 ...")
                elif parts[0] == 'f':
                    face_vertices = []
                    for part in parts[1:]:
                        # .obj files are 1-indexed, so we subtract 1.
                        # Split by '/' to handle formats like 'v/vt/vn', 'v//vn', or 'v'.
                        # We only care about the vertex index, which is always the first number.
                        v_index = int(part.split('/')[0]) - 1
                        face_vertices.append(v_index)
                    
                    # If the face is a triangle, add it directly
                    if len(face_vertices) == 3:
                        triangles.append(face_vertices)
                    # If the face is a quad, triangulate it (common practice)
                    elif len(face_vertices) == 4:
                        # First triangle
                        triangles.append([face_vertices[0], face_vertices[1], face_vertices[2]])
                        # Second triangle
                        triangles.append([face_vertices[0], face_vertices[2], face_vertices[3]])

    except FileNotFoundError:
        print(f"Error: The file '{obj_filepath}' was not found.")
        return
    except Exception as e:
        print(f"An error occurred while parsing the file: {e}")
        return

    # Assemble the final JSON structure
    # NOTE: The .obj format does not contain material properties like diffuse or specular color.
    # We are adding a default material here. You may need to adjust this manually.
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

    # Write the data to the output JSON file
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

