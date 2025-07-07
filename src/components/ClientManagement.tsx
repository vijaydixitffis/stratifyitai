import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  Shield,
  Building,
  Mail,
  User,
  AlertCircle,
  CheckCircle,
  XCircle,
  Plus,
  Settings,
  X,
  Loader2
} from 'lucide-react';
import { UserService, UserProfile, createClientUser } from '../services/userService';
import { OrganizationService, Organization } from '../services/organizationService';
import { AssetService } from '../services/assetService';
import { useSelectedOrg } from '../contexts/SelectedOrgContext';

// Use the UserProfile interface from the service
type ClientUser = UserProfile;

const ClientManagement: React.FC = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [organizationsList, setOrganizationsList] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedOrganization, setSelectedOrganization] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientUser | null>(null);
  const [showOnboardOrgForm, setShowOnboardOrgForm] = useState(false);
  const [selectedOrgForUsers, setSelectedOrgForUsers] = useState<Organization | null>(null);
  const [viewMode, setViewMode] = useState<'organizations' | 'users'>('organizations');
  const [submitting, setSubmitting] = useState(false);
  const { selectedOrg } = useSelectedOrg();

  // Form state for creating/editing clients
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'client-manager' as 'client-manager' | 'client-architect' | 'client-cxo' | 'admin-consultant' | 'admin-architect' | 'admin-super',
    organization: '',
    password: ''
  });

  // Form state for onboarding organizations
  const [orgFormData, setOrgFormData] = useState({
    organizationName: '',
    orgCode: '',
    description: '',
    sector: '',
    remarks: '',
    cxoName: '',
    cxoEmail: '',
    cxoPassword: ''
  });

  // Form state for editing organizations
  const [editingOrg, setEditingOrg] = useState<{
    name: string;
    code: string;
    cxoName: string;
    cxoId: string;
  } | null>(null);

  const roleOptions = [
    { value: 'client-manager', label: 'Client Manager', description: 'Manages client projects and communications' },
    { value: 'client-architect', label: 'Client Architect', description: 'Technical architect for client solutions' },
    { value: 'client-cxo', label: 'Client CXO', description: 'Executive level client contact' },
    { value: 'admin-consultant', label: 'Admin Consultant', description: 'Internal consultant with admin access' },
    { value: 'admin-architect', label: 'Admin Architect', description: 'Technical architect with admin access' },
    { value: 'admin-super', label: 'Super Admin', description: 'Full system administration access' }
  ];

  // Check if current user is Super Admin
  const isSuperAdmin = user?.role === 'admin-super';

  // Only allow access if logged-in user is ADMIN org admin
  const canAccessClientManagement = user?.orgCode === 'ADMIN' && user?.role?.startsWith('admin-');

  useEffect(() => {
    if (isSuperAdmin) {
      loadData();
    }
  }, [isSuperAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadClients(), loadOrganizations()]);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      setError(null);
      
      const users = await UserService.getUsers();
      setClients(users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
      console.error('Error loading clients:', err);
    }
  };

  const loadOrganizations = async () => {
    try {
      setError(null);
      
      const orgs = await OrganizationService.getOrganizations();
      setOrganizationsList(orgs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
      console.error('Error loading organizations:', err);
    }
  };

  const handleCreateClient = async (formData: any) => {
    try {
      if (!selectedOrg) throw new Error('No organization selected');
      const profile = await createClientUser({
        ...formData,
        org_id: selectedOrg.org_id,
      });
      alert('Client user created successfully!');
      // Optionally refresh client list here
    } catch (err: any) {
      alert('Failed to create client user: ' + (err.message || err));
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    if (!editingClient) return;

    try {
      setError(null);
      
      const updatedUser = await UserService.updateUser(editingClient.id, {
        name: formData.name,
        role: formData.role,
        organization: formData.organization
      });

      setClients(prev => prev.map(client => 
        client.id === editingClient.id ? updatedUser : client
      ));
      setEditingClient(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update client');
      console.error('Error updating client:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
      return;
    }

    try {
      setError(null);
      
      await UserService.deleteUser(clientId);
      setClients(prev => prev.filter(client => client.id !== clientId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete client');
      console.error('Error deleting client:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'client-manager',
      organization: selectedOrgForUsers ? selectedOrgForUsers.org_name : '',
      password: ''
    });
  };

  const openEditForm = (client: ClientUser) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      role: client.role,
      organization: client.organization,
      password: ''
    });
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.organization.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'all' || client.role === selectedRole;
    const matchesOrg = selectedOrganization === 'all' || client.organization === selectedOrganization;
    
    return matchesSearch && matchesRole && matchesOrg;
  });

  const handleOnboardOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Validate org code length
    if (orgFormData.orgCode.length !== 5) {
      setError('Organization code must be exactly 5 characters');
      setSubmitting(false);
      return;
    }

    try {
      setError(null);
      
      // First, create the organization
      const newOrg = await OrganizationService.createOrganization({
        org_code: orgFormData.orgCode,
        org_name: orgFormData.organizationName,
        description: orgFormData.description || `Organization for ${orgFormData.organizationName}`,
        sector: orgFormData.sector || 'Technology',
        remarks: orgFormData.remarks || 'Newly onboarded organization'
      });

      // Then create the Client CXO user for the organization
      const newUser = await UserService.createUser({
        email: orgFormData.cxoEmail,
        password: orgFormData.cxoPassword,
        name: orgFormData.cxoName,
        role: 'client-cxo', // Client CXO role
        organization: orgFormData.organizationName,
        orgCode: orgFormData.orgCode,
        org_id: newOrg.org_id
      });

      setOrganizationsList(prev => [newOrg, ...prev]);
      setClients(prev => [newUser, ...prev]);
      setShowOnboardOrgForm(false);
      resetOrgForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to onboard organization');
      console.error('Error onboarding organization:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    if (!editingOrg) return;

    // Validate org code length
    if (editingOrg.code.length !== 5) {
      setError('Organization code must be exactly 5 characters');
      setSubmitting(false);
      return;
    }

    try {
      setError(null);
      
      // Find the organization to update
      const orgToUpdate = organizationsList.find(org => org.org_code === editingOrg.code);
      if (!orgToUpdate) {
        throw new Error('Organization not found');
      }

      // Update the organization details
      const updatedOrg = await OrganizationService.updateOrganization(orgToUpdate.org_id, {
        org_code: editingOrg.code,
        org_name: editingOrg.name
      });

      // Update the organizations list
      setOrganizationsList(prev => prev.map(org => 
        org.org_id === orgToUpdate.org_id ? updatedOrg : org
      ));

      setEditingOrg(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization');
      console.error('Error updating organization:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditOrganization = (org: Organization) => {
    setEditingOrg({
      name: org.org_name,
      code: org.org_code,
      cxoName: '', // We'll need to find the CXO user for this org
      cxoId: ''
    });
  };

  const resetOrgForm = () => {
    setOrgFormData({
      organizationName: '',
      orgCode: '',
      description: '',
      sector: '',
      remarks: '',
      cxoName: '',
      cxoEmail: '',
      cxoPassword: ''
    });
  };

  const handleManageUsers = (organization: Organization) => {
    setSelectedOrgForUsers(organization);
    setViewMode('users');
  };

  const handleBackToOrganizations = () => {
    setViewMode('organizations');
    setSelectedOrgForUsers(null);
  };

  const getUsersForOrganization = (organization: Organization) => {
    return clients.filter(client => client.org_id === organization.org_id);
  };

  if (!canAccessClientManagement) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
          <p className="text-gray-600">Only StratifyIT.AI Admins can access Client Management.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-600">Loading client management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Management</h1>
          <p className="text-gray-600">Manage organizations and their users</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowOnboardOrgForm(true)}
            disabled={submitting}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>Onboard Organization</span>
          </button>
        </div>
      </div>

      {/* View Toggle */}
      {viewMode === 'users' && selectedOrgForUsers && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBackToOrganizations}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors"
            >
              <span>← Back to Organizations</span>
            </button>
            <h2 className="text-xl font-semibold text-gray-900">
              Users in {selectedOrgForUsers?.org_name}
            </h2>
          </div>
          <button
            onClick={() => {
              setShowCreateForm(true);
              // Initialize form with selected organization
              setFormData({
                name: '',
                email: '',
                role: 'client-manager',
                organization: selectedOrgForUsers ? selectedOrgForUsers.org_name : '',
                password: ''
              });
            }}
            disabled={submitting}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add New User</span>
          </button>
        </div>
      )}

      {/* Filters - Only show in users view */}
      {viewMode === 'users' && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Users</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="pl-10 w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Roles</option>
                {roleOptions.map(role => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedRole('all');
                }}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <span className="text-sm text-red-800">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {(showCreateForm || editingClient) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">
              {editingClient ? 'Edit Client' : 'Add New User'}
            </h2>
            
            {/* Show selected organization when creating new user */}
            {showCreateForm && selectedOrgForUsers && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center space-x-2">
                  <Building className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    Organization: {selectedOrgForUsers.org_name} ({selectedOrgForUsers.org_code})
                  </span>
                </div>
              </div>
            )}
            
            <form onSubmit={editingClient ? handleUpdateClient : handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={submitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={!!editingClient || submitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  disabled={submitting}
                >
                  {(
                    selectedOrgForUsers?.org_code === 'ADMIN'
                      ? roleOptions.filter(r => r.value.startsWith('admin-'))
                      : roleOptions.filter(r => r.value.startsWith('client-'))
                  ).map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization
                  {showCreateForm && (
                    <span className="text-xs text-gray-500 ml-1">(pre-filled)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={showCreateForm && selectedOrgForUsers ? selectedOrgForUsers.org_name : formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className={`w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                    showCreateForm ? 'bg-gray-50 text-gray-600' : ''
                  }`}
                  required
                  disabled={showCreateForm || submitting}
                  readOnly={showCreateForm}
                />
              </div>
              
              {!editingClient && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                    minLength={6}
                    disabled={submitting}
                  />
                </div>
              )}
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    editingClient ? 'Update Client' : 'Create Client'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingClient(null);
                    resetForm();
                  }}
                  disabled={submitting}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Onboard Organization Modal */}
      {showOnboardOrgForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Onboard an Organization</h2>
            
            <form onSubmit={handleOnboardOrganization} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  value={orgFormData.organizationName}
                  onChange={(e) => setOrgFormData({ ...orgFormData, organizationName: e.target.value })}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter organization name"
                  required
                  disabled={submitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Org Code</label>
                <input
                  type="text"
                  value={orgFormData.orgCode}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().slice(0, 5); // Ensure max 5 characters
                    setOrgFormData({ ...orgFormData, orgCode: value });
                  }}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter 5-character code"
                  required
                  maxLength={5}
                  minLength={5}
                  disabled={submitting}
                />
                {orgFormData.orgCode.length > 0 && orgFormData.orgCode.length < 5 && (
                  <p className="text-sm text-red-600 mt-1">Org code must be exactly 5 characters</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={orgFormData.description}
                  onChange={(e) => setOrgFormData({ ...orgFormData, description: e.target.value })}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter organization description"
                  rows={3}
                  disabled={submitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
                <input
                  type="text"
                  value={orgFormData.sector}
                  onChange={(e) => setOrgFormData({ ...orgFormData, sector: e.target.value })}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter sector (e.g., Technology, Finance)"
                  disabled={submitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={orgFormData.remarks}
                  onChange={(e) => setOrgFormData({ ...orgFormData, remarks: e.target.value })}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter any additional remarks"
                  rows={2}
                  disabled={submitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client CXO Name</label>
                <input
                  type="text"
                  value={orgFormData.cxoName}
                  onChange={(e) => setOrgFormData({ ...orgFormData, cxoName: e.target.value })}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter Client CXO full name"
                  required
                  disabled={submitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client CXO Email</label>
                <input
                  type="email"
                  value={orgFormData.cxoEmail}
                  onChange={(e) => setOrgFormData({ ...orgFormData, cxoEmail: e.target.value })}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter Client CXO email"
                  required
                  disabled={submitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client CXO Password</label>
                <input
                  type="password"
                  value={orgFormData.cxoPassword}
                  onChange={(e) => setOrgFormData({ ...orgFormData, cxoPassword: e.target.value })}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter Client CXO password"
                  required
                  minLength={6}
                  disabled={submitting}
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Onboard Organization'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOnboardOrgForm(false);
                    resetOrgForm();
                  }}
                  disabled={submitting}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content */}
      {viewMode === 'organizations' ? (
        /* Organizations List */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {organizationsList.length === 0 ? (
            <div className="p-8 text-center">
              <Building className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No organizations found</h3>
              <p className="text-gray-600">Onboard your first organization to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Org Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sector
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Users Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Active Users
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {organizationsList.map((org) => {
                    const orgUsers = getUsersForOrganization(org);
                    const activeUsers = orgUsers.filter(user => user.status === 'active');
                    const firstUser = orgUsers[0]; // For creation date
                    
                    return (
                      <tr key={org.org_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                                <Building className="h-5 w-5 text-green-600" />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{org.org_name}</div>
                              <div className="text-sm text-gray-500">{orgUsers.length} total users</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {org.org_code}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{org.sector || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{orgUsers.length}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{activeUsers.length}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {firstUser ? new Date(firstUser.created_at).toLocaleDateString() : new Date(org.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openEditOrganization(org)}
                              className="text-gray-600 hover:text-gray-900 transition-colors"
                              disabled={submitting}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleManageUsers(org)}
                              className="flex items-center space-x-2 text-blue-600 hover:text-blue-900 transition-colors"
                              disabled={submitting}
                            >
                              <Settings className="h-4 w-4" />
                              <span>Manage Users</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Users List for Selected Organization */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {(() => {
            const orgUsers = getUsersForOrganization(selectedOrgForUsers!);
            const filteredOrgUsers = orgUsers.filter(client => {
              const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                   client.email.toLowerCase().includes(searchQuery.toLowerCase());
              const matchesRole = selectedRole === 'all' || client.role === selectedRole;
              
              return matchesSearch && matchesRole;
            });

            return filteredOrgUsers.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                <p className="text-gray-600">Try adjusting your search criteria or add a new user.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrgUsers.map((client) => (
                      <tr key={client.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <User className="h-5 w-5 text-blue-600" />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{client.name}</div>
                              <div className="text-sm text-gray-500">{client.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Shield className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">
                              {roleOptions.find(r => r.value === client.role)?.label || client.role}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            client.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {client.status === 'active' ? (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            ) : (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            {client.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(client.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openEditForm(client)}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                              disabled={submitting}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClient(client.id)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                              disabled={submitting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* Edit Organization Modal */}
      {editingOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Edit Organization</h2>
              <button
                onClick={() => setEditingOrg(null)}
                className="text-gray-400 hover:text-gray-600"
                disabled={submitting}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleEditOrganization} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  value={editingOrg.name}
                  onChange={(e) => setEditingOrg({ ...editingOrg, name: e.target.value })}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter organization name"
                  required
                  disabled={submitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Org Code</label>
                <input
                  type="text"
                  value={editingOrg.code}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().slice(0, 5); // Ensure max 5 characters
                    setEditingOrg({ ...editingOrg, code: value });
                  }}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter 5-character code"
                  required
                  maxLength={5}
                  minLength={5}
                  disabled={submitting}
                />
                {editingOrg.code.length > 0 && editingOrg.code.length < 5 && (
                  <p className="text-sm text-red-600 mt-1">Org code must be exactly 5 characters</p>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingOrg(null)}
                  disabled={submitting}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Update Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientManagement;