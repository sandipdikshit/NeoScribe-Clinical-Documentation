import toml
import os

# Function to get the project version from pyproject.toml
def get_project_version():
    # Locate the pyproject.toml file in the current directory or parent directories
    current_dir = os.getcwd()
    while True:
        pyproject_path = os.path.join(current_dir, "pyproject.toml")
        if os.path.isfile(pyproject_path):
            break
        parent_dir = os.path.dirname(current_dir)
        if parent_dir == current_dir:  # Reached the root directory
            raise FileNotFoundError("pyproject.toml not found in the directory hierarchy.")
        current_dir = parent_dir

    # Load and return the version from pyproject.toml
    pyproject = toml.load(pyproject_path)
    return pyproject["tool"]["poetry"]["version"]