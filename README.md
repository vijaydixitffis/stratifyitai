# StratifyIT.ai - IT Portfolio Analysis and Strategy Platform

A comprehensive platform for analyzing and strategizing IT portfolios, built with React, TypeScript, and Supabase.

## Features

- **Asset Inventory Management**: Track and manage IT assets across different categories
- **User Authentication**: Secure login and user management with role-based access
- **Dashboard Analytics**: Visual insights into your IT portfolio
- **File Upload**: Bulk import assets via CSV/Excel files
- **Real-time Updates**: Live data synchronization with Supabase

## Setup Instructions

### 1. Clone the Repository
```bash
git clone <repository-url>
cd stratifyitai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory with your Supabase credentials:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**To get your Supabase credentials:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project or select an existing one
3. Navigate to Settings > API
4. Copy the Project URL and anon/public key
5. Paste them in your `.env` file

### 4. Database Setup

Run the database migrations to set up the required tables:

```bash
# If you have Supabase CLI installed
supabase db push

# Or manually run the SQL files in the supabase/migrations/ directory
```

### 5. Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Demo Mode

If you don't have Supabase configured, the application will run in demo mode with mock data. Use these demo credentials:

- **Email**: `john@company.com` | **Password**: `demo123`
- **Email**: `sarah@company.com` | **Password**: `demo123`
- **Email**: `mike@stratifyit.ai` | **Password**: `demo123`
- **Email**: `lisa@stratifyit.ai` | **Password**: `demo123`

## Project Structure

```
src/
├── components/          # React components
├── contexts/           # React contexts (Auth, Asset)
├── lib/               # Utility libraries (Supabase client)
├── services/          # API services
└── types/             # TypeScript type definitions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Troubleshooting

### Common Issues

1. **Supabase Connection Errors**: Ensure your environment variables are correctly set
2. **Database Policy Errors**: The RLS policies have been simplified to avoid infinite recursion
3. **Import Errors**: Run `npm install` to ensure all dependencies are installed

### Recent Fixes

- Fixed infinite recursion in user_profiles RLS policies
- Simplified authentication flow
- Added proper error handling for missing environment variables
