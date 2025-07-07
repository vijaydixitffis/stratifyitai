# StratifyIT.ai - IT Portfolio Analysis and Strategy Platform

A comprehensive platform for analyzing and strategizing IT portfolios, built with React, TypeScript, and Supabase.

## Features

- **Asset Inventory Management**: Track and manage IT assets across different categories
- **Organization-Based Authentication**: Secure login with organization code, email, and password validation
- **User Management**: Role-based access control with organization isolation
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

**Important**: After running migrations, execute the organization access fix in your Supabase SQL editor:

```sql
-- Add anonymous access policy for organization validation during login
CREATE POLICY "Allow anonymous access to organizations for login"
  ON organizations
  FOR SELECT
  TO anon
  USING (true);
```

This policy is required for the organization code validation to work during the login process.

**Note**: If you encounter issues with user-organization associations when creating new organizations, run the organization ID fix script (`fix_org_id_association.sql`) in your Supabase SQL editor to resolve any existing broken links.

### 5. Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Demo Mode

If you don't have Supabase configured, the application will run in demo mode with mock data. Use these demo credentials:

### Demo Accounts

| Organization Code | Email | Password | Role |
|------------------|-------|----------|------|
| `TECH1` | `john@company.com` | `demo123` | Client Manager |
| `TECH1` | `sarah@company.com` | `demo123` | Client Architect |
| `STRAT` | `mike@stratifyit.ai` | `demo123` | Admin Consultant |
| `STRAT` | `lisa@stratifyit.ai` | `demo123` | Admin Architect |

**Note**: Organization codes are exactly 5 characters and are case-insensitive (automatically converted to uppercase).

## Authentication Flow

The application uses a three-factor authentication system:

1. **Organization Code**: 5-character unique identifier for each organization
2. **Email**: User's email address
3. **Password**: User's password

### Authentication Process

1. User enters organization code, email, and password
2. System validates the organization code exists
3. System authenticates email and password with Supabase Auth
4. System verifies the user belongs to the specified organization
5. User is logged in and redirected to the dashboard

### Organization Isolation

Users can only access data and features within their organization. This ensures proper data segregation between different client organizations.

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
4. **Organization Association Issues**: If new users are not properly linked to organizations, run the `fix_org_id_association.sql` script in your Supabase SQL editor

### Recent Fixes

- Fixed infinite recursion in user_profiles RLS policies
- Simplified authentication flow
- Added proper error handling for missing environment variables
