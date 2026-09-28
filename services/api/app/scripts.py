import webbrowser
import os

def open_docs():
    """Open the HTML documentation in the default web browser."""
    # Get the absolute path to the documentation directory
    docs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'docs', 'build'))
    # Check if the index.html file exists in the build directory
    index_file = os.path.join(docs_dir, 'index.html')
    webbrowser.open(index_file, new=2)
