#!/bin/bash

# Database setup script for Lens Workshop

echo "Setting up Lens Workshop database..."

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "MySQL is not installed. Please install MySQL first."
    exit 1
fi

# Database credentials (update these as needed)
DB_HOST="localhost"
DB_USER="root"
DB_PASSWORD=""
DB_NAME="lens_workshop"

echo "Creating database and tables..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD < database_schema.sql

if [ $? -eq 0 ]; then
    echo "Database setup completed successfully!"
    echo "Database: $DB_NAME"
    echo "You can now run the application with: bun run dev"
else
    echo "Database setup failed. Please check your MySQL credentials and try again."
    exit 1
fi