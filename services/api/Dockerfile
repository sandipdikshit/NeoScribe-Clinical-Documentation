# Use an official Python runtime as a parent image
FROM python:3.12-slim-bookworm AS builder

# Set the working directory in the container
WORKDIR /app

# Copy the rest of the application code to the container
COPY . .

# Install Poetry
RUN pip install poetry

# Add Poetry to PATH
ENV PATH="/root/.local/bin:$PATH"

# Copy the pyproject.toml and poetry.lock files to the container
COPY pyproject.toml poetry.lock ./

# Install the dependencies
RUN poetry config virtualenvs.create false && poetry install --only main --no-interaction --no-ansi


# Ensure Poetry's bin directory is in PATH
ENV PATH="/root/.local/bin:$PATH"

#TODO Improve this 
WORKDIR /app/app

#TODO change to multi-stage build

# Create a non-root user
# RUN useradd -m appuser
# USER appuser
