import os

# Configuration
exclude_dirs = {'.git', 'node_modules', 'dist', '.vscode', '__pycache__', 'public', '.vite'}
exclude_files = {'codebase_dump.txt', 'codebase_dump_utf8.txt', 'package-lock.json', 'eslint_output.txt', 'prism-face-and-edge-dragging.zip'}
text_extensions = {'.ts', '.tsx', '.css', '.html', '.json', '.txt', '.js', '.md'}

def generate_tree(startpath):
    tree_lines = ["=== PROJECT STRUCTURE ==="]
    for root, dirs, files in os.walk(startpath):
        # Filter directories in-place
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        level = os.path.relpath(root, startpath).count(os.sep)
        if level == 0 and os.path.relpath(root, startpath) == '.':
            indent = ''
            tree_lines.append(f"{indent}+---{os.path.basename(os.path.abspath(startpath))}/")
        else:
            indent = '|   ' * level
            tree_lines.append(f"{indent}+---{os.path.basename(root)}/")
        
        subindent = '|   ' * (level + 1)
        for f in sorted(files):
            if f not in exclude_files:
                tree_lines.append(f"{subindent}{f}")
    return "\n".join(tree_lines)

def main():
    root_dir = os.getcwd()
    files_to_dump = []
    
    # Dynamically find files
    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in sorted(files):
            if file in exclude_files:
                continue
            if any(file.endswith(ext) for ext in text_extensions):
                rel_path = os.path.relpath(os.path.join(root, file), root_dir)
                files_to_dump.append(rel_path)

    # 1. Generate codebase_dump.txt (Simple format)
    output_simple = "codebase_dump.txt"
    with open(output_simple, "w", encoding="utf-8") as out:
        for file_path in files_to_dump:
            out.write(f"--- FILE: {file_path} ---\n")
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    out.write(f.read())
            except Exception as e:
                out.write(f"ERROR READING FILE: {e}\n")
            out.write("\n\n")
    print(f"Simple dump completed to {output_simple}")

    # 2. Generate codebase_dump_utf8.txt (With tree and specific format)
    output_utf8 = "codebase_dump_utf8.txt"
    with open(output_utf8, "w", encoding="utf-8") as out:
        out.write(generate_tree(root_dir))
        out.write("\n\n")
        for file_path in files_to_dump:
            out.write(f"=== {file_path} ===\n")
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    out.write(f.read())
            except Exception as e:
                out.write(f"ERROR READING FILE: {e}\n")
            out.write("\n\n")
    print(f"UTF8 dump completed to {output_utf8}")

if __name__ == "__main__":
    main()
