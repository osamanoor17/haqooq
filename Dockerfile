FROM python:3.13-slim AS base

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the whole project into the image
COPY . /app

# Expose Gradio UI port (default 7862)
EXPOSE 7862

# Entrypoint runs Gradio UI
CMD ["python", "ui/app.py", "--share=False"]
