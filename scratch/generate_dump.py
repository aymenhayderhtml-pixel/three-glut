import os

files_to_dump = [
    "package.json",
    "vite.config.ts",
    "tsconfig.json",
    "index.html",
    "src/App.css",
    "src/App.tsx",
    "src/exportGlut.ts",
    "src/exportGlutExtended.ts",
    "src/index.css",
    "src/main.tsx",
    "src/scene.ts",
    "src/Viewport.tsx",
    "src/Viewport3D.tsx",
    "src/commands/prismCommands.ts",
    "src/components/ContextMenu.tsx",
    "src/components/PrismEditGizmo.tsx",
    "src/components/PrismEditor.tsx",
    "src/geometry/prismGeometry.ts",
    "src/store/prismStore.ts",
    "src/types/prism.types.ts",
    "src/ui/PrismProperties.tsx",
    "src/ui/PrismToolbar.tsx"
]

output_file = "codebase_dump.txt"

with open(output_file, "w", encoding="utf-8") as out:
    for file_path in files_to_dump:
        if os.path.exists(file_path):
            out.write(f"--- FILE: {file_path} ---\n")
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    out.write(f.read())
            except Exception as e:
                out.write(f"ERROR READING FILE: {e}\n")
            out.write("\n\n")
        else:
            out.write(f"--- FILE NOT FOUND: {file_path} ---\n\n")

print(f"Dump completed to {output_file}")
