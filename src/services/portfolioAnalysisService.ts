import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface PACategory {
  id: string;
  category_id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PAAssessment {
  id: string;
  assessment_id: string;
  category_id: string;
  name: string;
  description: string;
  duration: string;
  complexity: 'Low' | 'Medium' | 'High';
  status: 'available' | 'in-progress' | 'completed' | 'disabled';
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PACategoryWithAssessments extends PACategory {
  assessments: PAAssessment[];
}

// Mock data for when Supabase is not configured
const mockCategories: PACategory[] = [
  {
    id: '1',
    category_id: 'strategy-enterprise-arch',
    title: 'Strategy and Enterprise Architecture',
    description: 'Enterprise architecture plays a key role in ensuring business outcomes from innovations and disruptions with risks mitigated',
    icon: 'Building',
    color: 'bg-blue-600',
    sort_order: 1,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    category_id: 'digital-ecosystem',
    title: 'Digital Ecosystem Readiness',
    description: 'Every business is now evolving into social ecosystem using digital means and connectedness',
    icon: 'Globe',
    color: 'bg-green-600',
    sort_order: 2,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '3',
    category_id: 'it-optimization',
    title: 'IT Optimization and Consolidation',
    description: 'Address technical debt and optimize IT operations to reduce support costs',
    icon: 'Settings',
    color: 'bg-purple-600',
    sort_order: 3,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '4',
    category_id: 'technology-architecture',
    title: 'Technology Architecture',
    description: 'Modernizing with new technology and platforms adoption is key to keep OPEX in control',
    icon: 'Cpu',
    color: 'bg-indigo-600',
    sort_order: 4,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '5',
    category_id: 'enterprise-governance',
    title: 'Enterprise Architecture Governance',
    description: 'Establish governance frameworks and processes for enterprise architecture',
    icon: 'Shield',
    color: 'bg-red-600',
    sort_order: 5,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '6',
    category_id: 'specialized-assessments',
    title: 'Specialized Assessments',
    description: 'Domain-specific assessments for comprehensive IT portfolio evaluation',
    icon: 'Target',
    color: 'bg-orange-600',
    sort_order: 6,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

const mockAssessments: PAAssessment[] = [
  // Strategy and Enterprise Architecture
  {
    id: '1',
    assessment_id: 'business-capability-modeling',
    category_id: 'strategy-enterprise-arch',
    name: 'Business Capability Modeling',
    description: 'Assess and model business capabilities to align IT investments with business strategy',
    duration: '2-3 weeks',
    complexity: 'Medium',
    status: 'available',
    sort_order: 1,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    assessment_id: 'business-it-alignment',
    category_id: 'strategy-enterprise-arch',
    name: 'Business and IT Strategy Alignment',
    description: 'Evaluate alignment between business objectives and IT strategy',
    duration: '1-2 weeks',
    complexity: 'High',
    status: 'available',
    sort_order: 2,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  // Digital Ecosystem
  {
    id: '3',
    assessment_id: 'cloud-readiness',
    category_id: 'digital-ecosystem',
    name: 'Cloud Readiness Assessment',
    description: 'Evaluate applications and infrastructure readiness for cloud migration',
    duration: '2-3 weeks',
    complexity: 'Medium',
    status: 'available',
    sort_order: 1,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  // Add more mock assessments as needed...
];

export class PortfolioAnalysisService {
  // Check if Supabase is available
  private static isSupabaseAvailable(): boolean {
    return isSupabaseConfigured();
  }

  // Fetch all categories
  static async getCategories(): Promise<PACategory[]> {
    if (!this.isSupabaseAvailable()) {
      console.log('Using mock data for PA categories - Supabase not configured');
      return Promise.resolve([...mockCategories]);
    }

    try {
      console.log('Fetching PA categories from Supabase...');
      const { data, error } = await supabase!
        .from('pa_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Supabase error fetching PA categories:', error);
        throw new Error(`Failed to fetch categories: ${error.message}`);
      }

      console.log('Successfully fetched PA categories from Supabase:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('Error in getCategories:', error);
      throw error;
    }
  }

  // Fetch assessments for a specific category
  static async getAssessmentsByCategory(categoryId: string): Promise<PAAssessment[]> {
    if (!this.isSupabaseAvailable()) {
      const filtered = mockAssessments.filter(a => a.category_id === categoryId);
      return Promise.resolve(filtered);
    }

    try {
      console.log('Fetching PA assessments for category:', categoryId);
      const { data, error } = await supabase!
        .from('pa_assessments')
        .select('*')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Supabase error fetching PA assessments:', error);
        throw new Error(`Failed to fetch assessments: ${error.message}`);
      }

      console.log('Successfully fetched PA assessments for category:', categoryId, ':', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('Error in getAssessmentsByCategory:', error);
      throw error;
    }
  }

  // Fetch all assessments
  static async getAllAssessments(): Promise<PAAssessment[]> {
    if (!this.isSupabaseAvailable()) {
      return Promise.resolve([...mockAssessments]);
    }

    try {
      console.log('Fetching all PA assessments from Supabase...');
      const { data, error } = await supabase!
        .from('pa_assessments')
        .select('*')
        .eq('is_active', true)
        .order('category_id, sort_order', { ascending: true });

      if (error) {
        console.error('Supabase error fetching all PA assessments:', error);
        throw new Error(`Failed to fetch assessments: ${error.message}`);
      }

      console.log('Successfully fetched all PA assessments from Supabase:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('Error in getAllAssessments:', error);
      throw error;
    }
  }

  // Fetch categories with their assessments
  static async getCategoriesWithAssessments(): Promise<PACategoryWithAssessments[]> {
    try {
      const [categories, assessments] = await Promise.all([
        this.getCategories(),
        this.getAllAssessments()
      ]);

      // Group assessments by category
      const categoriesWithAssessments: PACategoryWithAssessments[] = categories.map(category => ({
        ...category,
        assessments: assessments.filter(assessment => assessment.category_id === category.category_id)
      }));

      return categoriesWithAssessments;
    } catch (error) {
      console.error('Error in getCategoriesWithAssessments:', error);
      throw error;
    }
  }

  // Get a specific assessment by ID
  static async getAssessmentById(assessmentId: string): Promise<PAAssessment | null> {
    if (!this.isSupabaseAvailable()) {
      const found = mockAssessments.find(a => a.assessment_id === assessmentId);
      return Promise.resolve(found || null);
    }

    try {
      console.log('Fetching PA assessment by ID:', assessmentId);
      const { data, error } = await supabase!
        .from('pa_assessments')
        .select('*')
        .eq('assessment_id', assessmentId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No rows returned
        }
        console.error('Supabase error fetching PA assessment:', error);
        throw new Error(`Failed to fetch assessment: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in getAssessmentById:', error);
      throw error;
    }
  }

  // Admin functions for managing categories and assessments
  static async createCategory(categoryData: Omit<PACategory, 'id' | 'created_at' | 'updated_at'>): Promise<PACategory> {
    if (!this.isSupabaseAvailable()) {
      const newCategory: PACategory = {
        ...categoryData,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return Promise.resolve(newCategory);
    }

    try {
      const { data, error } = await supabase!
        .from('pa_categories')
        .insert([categoryData])
        .select()
        .single();

      if (error) {
        console.error('Error creating PA category:', error);
        throw new Error(`Failed to create category: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in createCategory:', error);
      throw error;
    }
  }

  static async createAssessment(assessmentData: Omit<PAAssessment, 'id' | 'created_at' | 'updated_at'>): Promise<PAAssessment> {
    if (!this.isSupabaseAvailable()) {
      const newAssessment: PAAssessment = {
        ...assessmentData,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return Promise.resolve(newAssessment);
    }

    try {
      const { data, error } = await supabase!
        .from('pa_assessments')
        .insert([assessmentData])
        .select()
        .single();

      if (error) {
        console.error('Error creating PA assessment:', error);
        throw new Error(`Failed to create assessment: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in createAssessment:', error);
      throw error;
    }
  }
}