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

type ClientManagementProps = {
  showOnboardOrgForm: boolean;
  setShowOnboardOrgForm: (show: boolean) => void;
  onOrgOnboarded: (org: any, user: any) => void;
  orgOnboarded: { org: any, user: any } | null;
  orgs: Organization[];
  reloadOrgs: () => Promise<void>;
};

const ClientManagement: React.FC<ClientManagementProps> = ({ showOnboardOrgForm, setShowOnboardOrgForm, onOrgOnboarded, orgOnboarded, orgs, reloadOrgs }) => {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientUser | null>(null);
  const { selectedOrg } = useSelectedOrg();
  const [submitting, setSubmitting] = useState(false);

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
      
      await reloadOrgs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
      console.error('Error loading organizations:', err);
    }
  };

  const handleCreateClient = async (formData: any) => {
    setSubmitting(true);
    setError(null);
    
    try {
      if (!selectedOrg) throw new Error('No organization selected');
      
      console.log('Creating client user for organization:', selectedOrg);
      
      const profile = await createClientUser({
        name: formData.name,
        email: formData.email,
        role: formData.role,
        password: formData.password,
        org_id: selectedOrg.org_id,
      });
      
      console.log('Client user created successfully:', profile);
      
      // Close modal and reset form immediately
      setShowCreateForm(false);
      resetForm();
      
      // Add the new user to the local state immediately
      const newUser: ClientUser = {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        organization: selectedOrg.org_name,
        orgCode: selectedOrg.org_code,
        org_id: selectedOrg.org_id,
        created_at: profile.created_at || new Date().toISOString(),
        updated_at: profile.updated_at || new Date().toISOString(),
        status: 'active'
      };
      
      setClients(prev => [newUser, ...prev]);
      
      console.log('Client user created and added to list successfully');
      
    } catch (err: any) {
      console.error('Error creating client user:', err);
      const errorMessage = err.message || err.toString();
      setError(`Failed to create client user: ${errorMessage}`);
    } finally {
      setSubmitting(false);
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
      organization: '',
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

  const filteredClients = selectedOrg
    ? clients.filter(client => client.org_id === selectedOrg.org_id)
    : [];

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

      setClients(prev => [newUser, ...prev]);
      setShowOnboardOrgForm(false);
      resetOrgForm();
      if (onOrgOnboarded) {
        onOrgOnboarded(newOrg, newUser);
      }
      await reloadOrgs();
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
      const orgToUpdate = orgs.find(org => org.org_code === editingOrg.code);
      if (!orgToUpdate) {
        throw new Error('Organization not found');
      }

      // Update the organization details
      const updatedOrg = await OrganizationService.updateOrganization(orgToUpdate.org_id, {
        org_code: editingOrg.code,
        org_name: editingOrg.name
      });

      // Update the organizations list
      await reloadOrgs();

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
      {/* Top Bar: Organization Dropdown, Title, Add New Client Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Organization Dropdown (assumed to be rendered here or in a parent) */}
          {/* Page Title */}
          <h1 className="text-2xl font-bold text-gray-900 ml-4">Client Management</h1>
        </div>
        {/* Add New Client Button on the right */}
        {!selectedOrg && (
          <div className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-200">
            Select an organization to manage users
          </div>
        )}
        <button
          onClick={() => setShowCreateForm(true)}
          disabled={submitting || !selectedOrg}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add New User</span>
        </button>
      </div>

      {/* User List for Selected Organization */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-800">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {selectedOrg ? (
          filteredClients.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No users found for {selectedOrg.org_name}
              </h3>
              <p className="text-gray-600 mb-4">
                This organization doesn't have any users yet. Add a new user to get started.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add First User
              </button>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Building className="h-5 w-5 text-gray-600" />
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {selectedOrg.org_name} Users
                      </h3>
                      <p className="text-sm text-gray-600">
                        {filteredClients.length} user{filteredClients.length !== 1 ? 's' : ''} • {selectedOrg.org_code}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedOrg.sector && `${selectedOrg.sector} Sector`}
                  </div>
                </div>
              </div>
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
                  {filteredClients.map((client) => (
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
            </>
          )
        ) : (
          <div className="p-8 text-center">
            <Building className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No organization selected</h3>
            <p className="text-gray-600 mb-4">
              Please select an organization from the dropdown in the header to manage its users.
            </p>
            <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
              💡 <strong>Tip:</strong> Use the dropdown in the top-right corner to select an organization
            </div>
          </div>
        )}
      </div>
      {showCreateForm && (
        <>
          {/* Before modal rendering */}
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">
                Add New User to {selectedOrg?.org_name}
              </h2>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                handleCreateClient(formData);
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter full name"
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
                    placeholder="Enter email address"
                    required
                    disabled={submitting}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={submitting}
                  >
                    {roleOptions.filter(role => role.value.startsWith('client')).map(role => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {roleOptions.find(r => r.value === formData.role)?.description}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter password"
                    required
                    minLength={6}
                    disabled={submitting}
                  />
                </div>
                
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Organization Details</h4>
                  <p className="text-sm text-gray-600">
                    <strong>Name:</strong> {selectedOrg?.org_name}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Code:</strong> {selectedOrg?.org_code}
                  </p>
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Create User'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setEditingClient(null);
                      resetForm();
                      setError(null);
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
        </>
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
    </div>
  );
};

export default ClientManagement;