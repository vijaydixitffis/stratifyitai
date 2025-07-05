import React, { useState } from 'react';
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
  Building
} from 'lucide-react';

const AssessmentsDashboard: React.FC = () => {
  const { user, isClient, isAdmin } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const assessmentCategories = [
    {
      id: 'strategy-enterprise-arch',
      title: 'Strategy and Enterprise Architecture',
      description: 'Enterprise architecture plays a key role in ensuring business outcomes from innovations and disruptions with risks mitigated',
      icon: Building,
      color: 'bg-blue-600',
      assessments: [
        {
          id: 'business-capability-modeling',
          name: 'Business Capability Modeling',
          description: 'Assess and model business capabilities to align IT investments with business strategy',
          duration: '2-3 weeks',
          complexity: 'Medium',
          status: 'available'
        },
        {
          id: 'business-it-alignment',
          name: 'Business and IT Strategy Alignment',
          description: 'Evaluate alignment between business objectives and IT strategy',
          duration: '1-2 weeks',
          complexity: 'High',
          status: 'available'
        },
        {
          id: 'digital-strategy',
          name: 'Digital Strategy Assessment',
          description: 'Comprehensive evaluation of digital transformation readiness and strategy',
          duration: '3-4 weeks',
          complexity: 'High',
          status: 'available'
        },
        {
          id: 'fsa-gap-analysis',
          name: 'FSA and Gap Analysis',
          description: 'Future State Architecture planning with current state gap analysis',
          duration: '2-3 weeks',
          complexity: 'High',
          status: 'available'
        },
        {
          id: 'ea-maturity',
          name: 'EA Maturity Assessment',
          description: 'Evaluate enterprise architecture maturity and governance capabilities',
          duration: '1-2 weeks',
          complexity: 'Medium',
          status: 'available'
        }
      ]
    },
    {
      id: 'digital-ecosystem',
      title: 'Digital Ecosystem Readiness',
      description: 'Every business is now evolving into social ecosystem using digital means and connectedness',
      icon: Globe,
      color: 'bg-green-600',
      assessments: [
        {
          id: 'cloud-readiness',
          name: 'Cloud Readiness Assessment',
          description: 'Evaluate applications and infrastructure readiness for cloud migration',
          duration: '2-3 weeks',
          complexity: 'Medium',
          status: 'available'
        },
        {
          id: 'api-hybrid-integration',
          name: 'APIs and Hybrid Integration',
          description: 'Assess API strategy and hybrid integration capabilities',
          duration: '1-2 weeks',
          complexity: 'Medium',
          status: 'available'
        },
        {
          id: 'microservices-adoption',
          name: 'Microservices Adoption',
          description: 'Evaluate readiness for microservices architecture adoption',
          duration: '2-3 weeks',
          complexity: 'High',
          status: 'available'
        },
        {
          id: 'mobile-omni-channel',
          name: 'Mobile and Omni-Channel Readiness',
          description: 'Assess mobile and omnichannel customer experience capabilities',
          duration: '1-2 weeks',
          complexity: 'Medium',
          status: 'available'
        },
        {
          id: 'analytics-readiness',
          name: 'Analytics and Data Readiness',
          description: 'Evaluate data analytics and business intelligence capabilities',
          duration: '2-3 weeks',
          complexity: 'Medium',
          status: 'available'
        }
      ]
    },
    {
      id: 'it-optimization',
      title: 'IT Optimization and Consolidation',
      description: 'Address technical debt and optimize IT operations to reduce support costs',
      icon: Settings,
      color: 'bg-purple-600',
      assessments: [
        {
          id: 'application-portfolio-rationalization',
          name: 'Applications Portfolio Rationalization',
          description: 'Analyze and optimize application portfolio for efficiency and cost reduction',
          duration: '3-4 weeks',
          complexity: 'High',
          status: 'available'
        },
        {
          id: 'solution-architecture',
          name: 'Solution Architecture Assessment',
          description: 'Evaluate solution architecture patterns and design principles',
          duration: '2-3 weeks',
          complexity: 'High',
          status: 'available'
        },
        {
          id: 'enterprise-integration-soa',
          name: 'Enterprise Integration and SOA',
          description: 'Assess enterprise integration patterns and service-oriented architecture',
          duration: '2-3 weeks',
          complexity: 'High',
          status: 'available'
        }
      ]
    },
    {
      id: 'technology-architecture',
      title: 'Technology Architecture',
      description: 'Modernizing with new technology and platforms adoption is key to keep OPEX in control',
      icon: Cpu,
      color: 'bg-indigo-600',
      assessments: [
        {
          id: 'infrastructure-rationalization',
          name: 'Infrastructure Rationalization',
          description: 'Optimize infrastructure components and reduce operational complexity',
          duration: '2-3 weeks',
          complexity: 'Medium',
          status: 'available'
        },
        {
          id: 'legacy-modernization',
          name: 'Legacy Modernization Assessment',
          description: 'Evaluate legacy systems and create modernization roadmap',
          duration: '3-4 weeks',
          complexity: 'High',
          status: 'available'
        },
        {
          id: 'platform-architecture-upgrades',
          name: 'Platform Architecture Upgrades',
          description: 'Assess platform architecture and identify upgrade opportunities',
          duration: '2-3 weeks',
          complexity: 'Medium',
          status: 'available'
        }
      ]
    },
    {
      id: 'enterprise-governance',
      title: 'Enterprise Architecture Governance',
      description: 'Establish governance frameworks and processes for enterprise architecture',
      icon: Shield,
      color: 'bg-red-600',
      assessments: [
        {
          id: 'ea-governance-framework',
          name: 'EA Governance Framework',
          description: 'Establish enterprise architecture governance processes and standards',
          duration: '2-3 weeks',
          complexity: 'High',
          status: 'available'
        },
        {
          id: 'architecture-compliance',
          name: 'Architecture Compliance Assessment',
          description: 'Evaluate compliance with enterprise architecture standards',
          duration: '1-2 weeks',
          complexity: 'Medium',
          status: 'available'
        },
        {
          id: 'technology-standards',
          name: 'Technology Standards Assessment',
          description: 'Review and optimize technology standards and guidelines',
          duration: '1-2 weeks',
          complexity: 'Medium',
          status: 'available'
        }
      ]
    },
    {
      id: 'specialized-assessments',
      title: 'Specialized Assessments',
      description: 'Domain-specific assessments for comprehensive IT portfolio evaluation',
      icon: Target,
      color: 'bg-orange-600',
      assessments: [
        {
          id: 'ai-readiness',
          name: 'AI Readiness Assessment',
          description: 'Evaluate organizational readiness for artificial intelligence adoption',
          duration: '2-3 weeks',
          complexity: 'High',
          status: 'available'
        },
        {
          id: 'application-modernity',
          name: 'Application Modernity Assessment',
          description: 'Assess application architecture and technology stack modernity',
          duration: '2-3 weeks',
          complexity: 'Medium',
          status: 'available'
        },
        {
          id: 'database-architecture',
          name: 'Database Architecture Assessment',
          description: 'Comprehensive evaluation of database architecture and performance',
          duration: '1-2 weeks',
          complexity: 'Medium',
          status: 'available'
        },
        {
          id: 'network-infrastructure',
          name: 'Network/Infrastructure Assessment',
          description: 'Assess network architecture and infrastructure capabilities',
          duration: '2-3 weeks',
          complexity: 'Medium',
          status: 'available'
        },
        {
          id: 'devsecops',
          name: 'DevSecOps Assessment',
          description: 'Evaluate development, security, and operations integration maturity',
          duration: '1-2 weeks',
          complexity: 'Medium',
          status: 'available'
        },
        {
          id: 'scaled-agile',
          name: 'Scaled Agile Assessment',
          description: 'Assess agile transformation and scaled agile framework adoption',
          duration: '1-2 weeks',
          complexity: 'Medium',
          status: 'available'
        },
        {
          id: 'operational-support',
          name: 'Operational Support Assessment',
          description: 'Evaluate IT operations and support model effectiveness',
          duration: '1-2 weeks',
          complexity: 'Medium',
          status: 'available'
        },
        {
          id: 'target-operating-model',
          name: 'Target Operating Model Assessment',
          description: 'Design and assess target operating model for IT organization',
          duration: '3-4 weeks',
          complexity: 'High',
          status: 'available'
        }
      ]
    }
  ];

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Assessment Framework Overview */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-8">
        <div className="flex items-center mb-4">
          <Target className="h-8 w-8 text-blue-600 mr-3" />
          <h2 className="text-xl font-bold text-blue-900">Assessment Framework</h2>
        </div>
        <p className="text-blue-800 mb-4">
          Our comprehensive assessment framework evaluates your IT portfolio across five key dimensions: 
          Strategy & Enterprise Architecture, Digital Ecosystem Readiness, IT Optimization & Consolidation, 
          Technology Architecture, and Enterprise Architecture Governance.
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

      {/* Assessment Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {assessmentCategories.map((category) => {
          const Icon = category.icon;
          return (
            <div
              key={category.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${category.color}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <ChevronRight 
                    className={`h-5 w-5 text-gray-400 transition-transform ${
                      selectedCategory === category.id ? 'rotate-90' : ''
                    }`} 
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{category.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{category.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{category.assessments.length} assessments</span>
                  <span className="text-blue-600 font-medium">
                    {selectedCategory === category.id ? 'Hide Details' : 'View Details'}
                  </span>
                </div>
              </div>

              {/* Expanded Assessment List */}
              {selectedCategory === category.id && (
                <div className="border-t border-gray-200 bg-gray-50">
                  <div className="p-4 space-y-3">
                    {category.assessments.map((assessment) => (
                      <div
                        key={assessment.id}
                        className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{assessment.name}</h4>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(assessment.status)}
                            <button className="text-blue-600 hover:text-blue-800 transition-colors">
                              <Play className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{assessment.description}</p>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-3">
                            <span className="text-gray-500">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {assessment.duration}
                            </span>
                            <span className={`px-2 py-1 rounded-full ${getComplexityColor(assessment.complexity)}`}>
                              {assessment.complexity}
                            </span>
                          </div>
                          <button className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
                            Start Assessment
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              <p className="text-2xl font-bold text-gray-900">
                {assessmentCategories.reduce((total, cat) => total + cat.assessments.length, 0)}
              </p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Available</p>
              <p className="text-2xl font-bold text-green-600">
                {assessmentCategories.reduce((total, cat) => 
                  total + cat.assessments.filter(a => a.status === 'available').length, 0
                )}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Categories</p>
              <p className="text-2xl font-bold text-purple-600">{assessmentCategories.length}</p>
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
    </div>
  );
};

export default AssessmentsDashboard;