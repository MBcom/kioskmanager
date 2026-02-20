# Use the official Python image as the base image
FROM python:3.14-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV DJANGO_DEBUG False

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY src/requirements.txt /app/

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire project into the container
COPY src/ /app/

# Expose the port the app runs on
EXPOSE 8000

USER 1000

# Run the Django development server
CMD ["gunicorn", "--bind", ":8000", "--workers", "1", "kioskmanager.wsgi"]