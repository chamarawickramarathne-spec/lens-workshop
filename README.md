# Lens Workshop Manager

A workshop management application for photography instructors to manage their workshops, collect payments, and track attendees.

## Features

- User authentication and profiles
- Create and manage workshops/events
- Public join links for students
- Payment slip upload and management
- Attendee tracking and payment status
- Join request approval system

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **UI**: Shadcn/ui + Tailwind CSS
- **Backend**: MySQL database
- **Authentication**: Custom session-based auth

## Setup

1. **Database Setup**:

   ```bash
   # Create MySQL database
   mysql -u root -p < database_schema.sql
   ```

2. **Environment Variables**:

   ```bash
   cp .env.example .env
   # Edit .env with your MySQL credentials
   ```

3. **Install Dependencies**:

   ```bash
   bun install
   ```

4. **Run Development Server**:
   ```bash
   bun run dev
   ```

## Database Schema

The application uses MySQL with the following main tables:

- `users` - User accounts
- `profiles` - User profiles
- `events` - Workshop events
- `attendees` - Event attendees
- `join_requests` - Student join requests
- `sessions` - User sessions

## Migration from Supabase

This application was originally built with Supabase but has been migrated to use MySQL. The main changes include:

- Replaced Supabase client with MySQL connection
- Custom session-based authentication
- Local file storage for payment slips
- Direct SQL queries instead of Supabase's query builder
