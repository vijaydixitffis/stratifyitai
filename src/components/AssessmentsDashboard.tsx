import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Shield, 
  Target, 
  Layers, 
  Cloud, 
  Database, 
  Network, 
  Cpu, 
  GitBranch,
  Users,
  BarChart3,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  Play,
  FileText,
  Settings,
  Zap,
  Globe,
  Lock,
  Smartphone,
  Server,
  Code,
  TrendingUp,
  Building,
  X,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Briefcase,
  Activity,
  Cog,
  Lightbulb,
  Workflow
} from 'lucide-react';
import { PortfolioAnalysisService, PACategoryWithAssessments, PAAssessment } from '../services/portfolioAnalysisService';

const AssessmentsDashboard: React.FC = () => {
  const { user, isClient, isAdmin } = useAuth();
  const [categories, setCategories] = useState<PACategoryWithAssessments[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<PAAssessment | null>(null);

  // Icon mapping for dynamic icon rendering
  const iconMap: { [key: string]: React.ComponentType<any> } = {
    Building,
    Globe,
    Settings,
    Cpu,
    Shield,
    Target,
    Database,
    Server,
    Cloud,
    Network,
    Zap,
    Code,
    Users,
    Lock,
    Smartphone,
    GitBranch,
    Briefcase,
    Activity,
    Cog,
    Lightbulb,
    Workflow
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Loading portfolio analysis categories and assessments...');
      const data = await PortfolioAnalysisService.getCategoriesWithAssessments();
      console.log('Loaded categories with assessments:', data.length);
      setCategories(data);
    } catch (err) {
      console.error('Error loading portfolio analysis data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load portfolio analysis data';
      console.error('Portfolio analysis error details:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    console.log('Refreshing portfolio analysis data...');
    loadCategories();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in-progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'Low':
        return 'bg-green-100 text-green-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'High':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  const handleAssessmentClick = (assessment: PAAssessment) => {
    setSelectedAssessment(assessment);
  };

  const handleStartAssessment = (assessment: PAAssessment) => {
    // TODO: Implement assessment start logic
    console.log('Starting assessment:', assessment.name);
    setSelectedAssessment(null);
    setSelectedCategory(null);
  };

  const selectedCategoryData = categories.find(cat => cat.category_id === selectedCategory);

  // Calculate total assessments
  const totalAssessments = categories.reduce((total, cat) => total + cat.assessments.length, 0);
  const availableAssessments = categories.reduce((total, cat) => 
    total + cat.assessments.filter(a => a.status === 'available').length, 0
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading portfolio analysis...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="text-red-800">{error}</span>
            <button
              onClick={handleRefresh}
              className="ml-auto text-red-600 hover:text-red-800 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Portfolio Analysis</h1>
            <p className="mt-2 text-gray-600">
              Comprehensive assessment framework for enterprise architecture transformation and IT strategy implementation
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Assessment Framework Overview */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-8">
        <div className="flex items-center mb-4">
          <Target className="h-8 w-8 text-blue-600 mr-3" />
          <h2 className="text-xl font-bold text-blue-900">Assessment Framework</h2>
        </div>
        <p className="text-blue-800 mb-4">
          Our comprehensive assessment framework evaluates your IT portfolio across {categories.length} key dimensions: 
          {categories.map((cat, index) => (
            <span key={cat.id}>
              {index > 0 && (index === categories.length - 1 ? ', and ' : ', ')}
              {cat.title}
            </span>
          ))}.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white p-3 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-1">Current State Analysis</h3>
            <p className="text-blue-700">Comprehensive evaluation of existing IT landscape</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-1">Future State Design</h3>
            <p className="text-blue-700">Target architecture and transformation roadmap</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-1">Gap Analysis</h3>
            <p className="text-blue-700">Identify gaps and prioritize transformation initiatives</p>
          </div>
        </div>
      </div>

      {/* Assessment Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {categories.map((category) => {
          const IconComponent = iconMap[category.icon] || Target;
          return (
            <div
              key={category.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all duration-200 cursor-pointer group"
              onClick={() => handleCategoryClick(category.category_id)}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${category.color} group-hover:scale-110 transition-transform duration-200`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-900 transition-colors">
                  {category.title}
                </h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-3">{category.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{category.assessments.length} assessments</span>
                  <span className="text-blue-600 font-medium group-hover:text-blue-800 transition-colors">
                    View Assessments
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Assessments</p>
              <p className="text-2xl font-bold text-gray-900">{totalAssessments}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Available</p>
              <p className="text-2xl font-bold text-green-600">{availableAssessments}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Categories</p>
              <p className="text-2xl font-bold text-purple-600">{categories.length}</p>
            </div>
            <Layers className="h-8 w-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Duration</p>
              <p className="text-2xl font-bold text-orange-600">2-3 weeks</p>
            </div>
            <Clock className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Assessment Process */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Assessment Process</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">1. Assessment Selection</h4>
            <p className="text-sm text-gray-600">Choose relevant assessments based on your transformation goals</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <BarChart3 className="h-6 w-6 text-green-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">2. Data Collection</h4>
            <p className="text-sm text-gray-600">Gather information through questionnaires and asset analysis</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">3. Analysis & Insights</h4>
            <p className="text-sm text-gray-600">AI-powered analysis generates insights and recommendations</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Target className="h-6 w-6 text-orange-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">4. Roadmap Creation</h4>
            <p className="text-sm text-gray-600">Receive detailed transformation roadmap and action plans</p>
          </div>
        </div>
      </div>

      {/* Category Assessments Modal */}
      {selectedCategory && selectedCategoryData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                  </button>
                  <div className={`p-3 rounded-lg ${selectedCategoryData.color}`}>
                    {React.createElement(iconMap[selectedCategoryData.icon] || Target, { className: "h-6 w-6 text-white" })}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedCategoryData.title}</h2>
                    <p className="text-sm text-gray-600">{selectedCategoryData.assessments.length} assessments available</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-700">{selectedCategoryData.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedCategoryData.assessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer group"
                    onClick={() => handleAssessmentClick(assessment)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium text-gray-900 group-hover:text-blue-900 transition-colors">
                        {assessment.name}
                      </h4>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(assessment.status)}
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{assessment.description}</p>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        <span className="text-gray-500 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {assessment.duration}
                        </span>
                        <span className={`px-2 py-1 rounded-full ${getComplexityColor(assessment.complexity)}`}>
                          {assessment.complexity}
                        </span>
                      </div>
                      <span className="text-blue-600 font-medium group-hover:text-blue-800 transition-colors">
                        View Details
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assessment Details Modal */}
      {selectedAssessment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedAssessment(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedAssessment.name}</h2>
                    <p className="text-sm text-gray-600">Assessment Details</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAssessment(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                  <p className="text-gray-900">{selectedAssessment.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Duration</h3>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-900">{selectedAssessment.duration}</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Complexity</h3>
                    <span className={`px-2 py-1 rounded-full text-sm ${getComplexityColor(selectedAssessment.complexity)}`}>
                      {selectedAssessment.complexity}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Status</h3>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(selectedAssessment.status)}
                    <span className="text-gray-900 capitalize">{selectedAssessment.status}</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-900 mb-2">What's Included</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Comprehensive assessment questionnaire</li>
                    <li>• Current state analysis and documentation</li>
                    <li>• Gap analysis and recommendations</li>
                    <li>• Detailed report with actionable insights</li>
                    <li>• Implementation roadmap and timeline</li>
                  </ul>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => handleStartAssessment(selectedAssessment)}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Play className="h-4 w-4" />
                    <span>Start Assessment</span>
                  </button>
                  <button
                    onClick={() => setSelectedAssessment(null)}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentsDashboard;