import React, { useState, useEffect } from 'react';
import { useAssets } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { X, Plus, Trash2, ChevronRight, Lock } from 'lucide-react';

interface AssetFormProps {
  asset?: any;
  onClose: () => void;
}

interface MetadataEntry {
  key: string;
  value: string;
}

const AssetForm: React.FC<AssetFormProps> = ({ asset, onClose }) => {
  const { addAsset, updateAsset } = useAssets();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Core
    name: '',
    type: '',
    category: '',
    description: '',
    owner: '',
    owner_email: '',
    status: 'active',
    criticality: 'medium',
    tags: '',
    // Vendor & Sourcing
    asset_tag: '',
    vendor: '',
    sourcing_type: '',
    business_unit: '',
    environment: '',
    // Infrastructure Identity
    hostname: '',
    ip_address: '',
    serial_number: '',
    location: '',
    // Lifecycle
    purchase_date: '',
    warranty_end_date: '',
    end_of_life_date: '',
    end_of_support_date: '',
    last_reviewed_date: '',
    // Financial
    annual_cost: '',
    license_type: '',
    license_expiry_date: '',
    support_contract_id: '',
    // Compliance & Risk
    data_classification: '',
    compliance_tags: '',
    criticality_justification: '',
  });

  const [metadataEntries, setMetadataEntries] = useState<MetadataEntry[]>([{ key: '', value: '' }]);
  const [additionalSpecsEntries, setAdditionalSpecsEntries] = useState<MetadataEntry[]>([{ key: '', value: '' }]);
  const [relationshipEntries, setRelationshipEntries] = useState<MetadataEntry[]>([]);

  const assetCategories = {
    application: ['Web Application','Mobile Application','SaaS Product','Legacy Application','Mainframe Application','Desktop Application','API/Microservice','Enterprise Application'],
    database: ['RDBMS (MySQL/PostgreSQL)','RDBMS (SQL Server)','RDBMS (Oracle)','NoSQL (MongoDB)','NoSQL (Cassandra)','NoSQL (Redis)','Block Storage','S3 Block Storage','Data Warehouse','Time Series Database'],
    infrastructure: ['Physical Server','Virtual Machine','Container Platform','Load Balancer','Network Equipment','Storage System','Backup System','Security Appliance'],
    middleware: ['Application Server','Message Queue','API Gateway','Service Bus','Workflow Engine','Integration Platform','Cache Server','Proxy Server'],
    'cloud-service': ['AWS EC2','AWS RDS','AWS S3','AWS Lambda','Azure VM','Azure SQL','Azure Storage','Google Cloud Compute','Google Cloud Storage','Kubernetes Service'],
    'third-party-service': ['SaaS Platform','Payment Gateway','Authentication Service','Monitoring Service','Analytics Platform','Communication Service','Security Service','Backup Service'],
  };

  useEffect(() => {
    if (asset) {
      setFormData({
        name: asset.name || '',
        type: asset.type || '',
        category: asset.category || '',
        description: asset.description || '',
        owner: asset.owner || '',
        owner_email: asset.owner_email || '',
        status: asset.status || 'active',
        criticality: asset.criticality || 'medium',
        tags: (asset.tags || []).join(', '),
        asset_tag: asset.asset_tag || '',
        vendor: asset.vendor || '',
        sourcing_type: asset.sourcing_type || '',
        business_unit: asset.business_unit || '',
        environment: asset.environment || '',
        hostname: asset.hostname || '',
        ip_address: asset.ip_address || '',
        serial_number: asset.serial_number || '',
        location: asset.location || '',
        purchase_date: asset.purchase_date || '',
        warranty_end_date: asset.warranty_end_date || '',
        end_of_life_date: asset.end_of_life_date || '',
        end_of_support_date: asset.end_of_support_date || '',
        last_reviewed_date: asset.last_reviewed_date || '',
        annual_cost: asset.annual_cost != null ? String(asset.annual_cost) : '',
        license_type: asset.license_type || '',
        license_expiry_date: asset.license_expiry_date || '',
        support_contract_id: asset.support_contract_id || '',
        data_classification: asset.data_classification || '',
        compliance_tags: (asset.compliance_tags || []).join(', '),
        criticality_justification: asset.criticality_justification || '',
      });

      // Split metadata into top-level scalars, additional_specs, and relationships
      const meta = asset.metadata || {};
      const { additional_specs, relationships, ...topMeta } = meta;

      const topEntries = Object.entries(topMeta)
        .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
        .map(([key, value]) => ({ key, value: String(value) }));
      setMetadataEntries(topEntries.length > 0 ? topEntries : [{ key: '', value: '' }]);

      if (additional_specs && typeof additional_specs === 'object') {
        const addlEntries = Object.entries(additional_specs as Record<string, any>)
          .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
          .map(([key, value]) => ({ key, value: String(value) }));
        setAdditionalSpecsEntries(addlEntries.length > 0 ? addlEntries : [{ key: '', value: '' }]);
      } else {
        setAdditionalSpecsEntries([{ key: '', value: '' }]);
      }

      if (relationships && typeof relationships === 'object') {
        const relEntries = Object.entries(relationships as Record<string, any>)
          .filter(([, v]) => v)
          .map(([key, value]) => ({ key, value: String(value) }));
        setRelationshipEntries(relEntries);
      }

      setCurrentStep(2);
    }
  }, [asset]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const topMetadata = metadataEntries
      .filter(entry => entry.key.trim() !== '')
      .reduce((acc, entry) => { acc[entry.key.trim()] = entry.value.trim(); return acc; }, {} as Record<string, string>);

    const additionalSpecs = additionalSpecsEntries
      .filter(e => e.key.trim() !== '')
      .reduce((acc, e) => { acc[e.key.trim()] = e.value.trim(); return acc; }, {} as Record<string, string>);

    const relationships = relationshipEntries
      .filter(e => e.key.trim() !== '')
      .reduce((acc, e) => { acc[e.key.trim()] = e.value.trim(); return acc; }, {} as Record<string, string>);

    const metadata: Record<string, any> = { ...topMetadata };
    if (Object.keys(additionalSpecs).length > 0) metadata.additional_specs = additionalSpecs;
    if (Object.keys(relationships).length > 0) metadata.relationships = relationships;

    const assetData: any = {
      ...formData,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      compliance_tags: formData.compliance_tags ? formData.compliance_tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      annual_cost: formData.annual_cost ? parseFloat(formData.annual_cost) : undefined,
      sourcing_type: formData.sourcing_type || undefined,
      environment: formData.environment || undefined,
      data_classification: formData.data_classification || undefined,
      asset_tag: formData.asset_tag || undefined,
      vendor: formData.vendor || undefined,
      business_unit: formData.business_unit || undefined,
      hostname: formData.hostname || undefined,
      ip_address: formData.ip_address || undefined,
      serial_number: formData.serial_number || undefined,
      location: formData.location || undefined,
      purchase_date: formData.purchase_date || undefined,
      warranty_end_date: formData.warranty_end_date || undefined,
      end_of_life_date: formData.end_of_life_date || undefined,
      end_of_support_date: formData.end_of_support_date || undefined,
      last_reviewed_date: formData.last_reviewed_date || undefined,
      license_type: formData.license_type || undefined,
      license_expiry_date: formData.license_expiry_date || undefined,
      support_contract_id: formData.support_contract_id || undefined,
      criticality_justification: formData.criticality_justification || undefined,
      metadata,
      createdBy: user?.email || 'unknown',
    };

    if (asset) {
      updateAsset(asset.id, assetData);
    } else {
      addAsset(assetData);
    }
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTypeSelection = (type: string) => {
    setFormData({ ...formData, type, category: '' });
    setCurrentStep(2);
  };

  const handleCategorySelection = (category: string) => {
    setFormData({ ...formData, category });
    setCurrentStep(3);
  };

  const makeEntryHandlers = (
    entries: MetadataEntry[],
    setEntries: React.Dispatch<React.SetStateAction<MetadataEntry[]>>
  ) => ({
    onChange: (index: number, field: 'key' | 'value', value: string) => {
      const next = [...entries];
      next[index][field] = value;
      setEntries(next);
    },
    onAdd: () => setEntries([...entries, { key: '', value: '' }]),
    onRemove: (index: number) => {
      if (entries.length > 1) setEntries(entries.filter((_, i) => i !== index));
      else setEntries([{ key: '', value: '' }]);
    },
  });

  const metaHandlers = makeEntryHandlers(metadataEntries, setMetadataEntries);
  const addlHandlers = makeEntryHandlers(additionalSpecsEntries, setAdditionalSpecsEntries);
  const relHandlers  = makeEntryHandlers(relationshipEntries, setRelationshipEntries);

  const getAssetTypeIcon = (type: string) => {
    const icons: Record<string, string> = { application: '🌐', database: '🗄️', infrastructure: '🖥️', middleware: '⚙️', 'cloud-service': '☁️', 'third-party-service': '🔗' };
    return icons[type] || '📦';
  };

  const getAssetTypeLabel = (type: string) => {
    const labels: Record<string, string> = { application: 'Application', database: 'Database', infrastructure: 'Infrastructure', middleware: 'Middleware', 'cloud-service': 'Cloud Service', 'third-party-service': 'Third Party Service' };
    return labels[type] || type;
  };

  const EntryEditor = ({
    entries,
    handlers,
    keyPlaceholder,
    valuePlaceholder,
    allowEmpty = false,
  }: {
    entries: MetadataEntry[];
    handlers: ReturnType<typeof makeEntryHandlers>;
    keyPlaceholder: string;
    valuePlaceholder: string;
    allowEmpty?: boolean;
  }) => (
    <div className="space-y-2">
      {entries.map((entry, index) => (
        <div key={index} className="flex items-center space-x-2">
          <input
            type="text"
            placeholder={keyPlaceholder}
            value={entry.key}
            onChange={(e) => handlers.onChange(index, 'key', e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="text"
            placeholder={valuePlaceholder}
            value={entry.value}
            onChange={(e) => handlers.onChange(index, 'value', e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => handlers.onRemove(index)}
            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={handlers.onAdd}
        className="inline-flex items-center px-3 py-1 text-sm bg-gray-50 text-gray-600 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add row
      </button>
    </div>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 pt-2">{title}</h3>
  );

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  // Step 1: Asset Type Selection
  if (currentStep === 1 && !asset) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Select Asset Type</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="h-6 w-6" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.keys(assetCategories).map((type) => (
                <button key={type} onClick={() => handleTypeSelection(type)}
                  className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 text-left group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl">{getAssetTypeIcon(type)}</span>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{getAssetTypeLabel(type)}</h3>
                  <p className="text-sm text-gray-600">{assetCategories[type as keyof typeof assetCategories].length} categories available</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Category Selection
  if (currentStep === 2 && formData.type && !formData.category && !asset) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Select Category</h2>
                <p className="text-sm text-gray-600 mt-1">Choose a category for {getAssetTypeLabel(formData.type)}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="h-6 w-6" /></button>
            </div>
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2">
                <span className="text-xl">{getAssetTypeIcon(formData.type)}</span>
                <span className="font-medium text-blue-900">Selected Type: {getAssetTypeLabel(formData.type)}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {assetCategories[formData.type as keyof typeof assetCategories].map((category) => (
                <button key={category} onClick={() => handleCategorySelection(category)}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 text-left">
                  <h3 className="font-medium text-gray-900">{category}</h3>
                </button>
              ))}
            </div>
            <div className="flex justify-start mt-6">
              <button onClick={() => setCurrentStep(1)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors">
                ← Back to Type Selection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Asset Details Form
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">{asset ? 'Edit Asset' : 'Add New Asset'}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="h-6 w-6" /></button>
          </div>

          {/* Type and Category Display */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <span className="text-xl">{getAssetTypeIcon(formData.type)}</span>
                <div>
                  <p className="text-sm font-medium text-gray-700">Asset Type</p>
                  <p className="text-lg font-semibold text-gray-900">{getAssetTypeLabel(formData.type)}</p>
                </div>
                {asset && <Lock className="h-4 w-4 text-gray-400" title="Cannot be changed" />}
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">C</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Category</p>
                  <p className="text-lg font-semibold text-gray-900">{formData.category}</p>
                </div>
                {asset && <Lock className="h-4 w-4 text-gray-400" title="Cannot be changed" />}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── Core Info ─────────────────────────────────────────────── */}
            <div>
              <SectionHeader title="Core Info" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Asset Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Owner *</label>
                  <input type="text" name="owner" value={formData.owner} onChange={handleChange} required placeholder="e.g., IT Department" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Owner Email</label>
                  <input type="email" name="owner_email" value={formData.owner_email} onChange={handleChange} placeholder="e.g., owner@company.com" className={inputCls} />
                  <p className="text-xs text-gray-400 mt-1">Used when assigning assessment questionnaires</p>
                </div>
                <div>
                  <label className={labelCls}>Status *</label>
                  <select name="status" value={formData.status} onChange={handleChange} required className={inputCls}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="deprecated">Deprecated</option>
                    <option value="planned">Planned</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Criticality *</label>
                  <select name="criticality" value={formData.criticality} onChange={handleChange} required className={inputCls}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Description *</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} required rows={3} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Tags</label>
                  <input type="text" name="tags" value={formData.tags} onChange={handleChange} placeholder="Comma-separated (e.g., web, production)" className={inputCls} />
                </div>
              </div>
            </div>

            {/* ── Vendor & Sourcing ─────────────────────────────────────── */}
            <div>
              <SectionHeader title="Vendor & Sourcing" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Asset Tag</label>
                  <input type="text" name="asset_tag" value={formData.asset_tag} onChange={handleChange} placeholder="e.g., IT-00123" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Vendor</label>
                  <input type="text" name="vendor" value={formData.vendor} onChange={handleChange} placeholder="e.g., Microsoft, Oracle" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Sourcing Type</label>
                  <select name="sourcing_type" value={formData.sourcing_type} onChange={handleChange} className={inputCls}>
                    <option value="">— Select —</option>
                    <option value="cots">COTS</option>
                    <option value="custom_built">Custom Built</option>
                    <option value="open_source">Open Source</option>
                    <option value="saas">SaaS</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Business Unit</label>
                  <input type="text" name="business_unit" value={formData.business_unit} onChange={handleChange} placeholder="e.g., Finance, Operations" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Environment</label>
                  <select name="environment" value={formData.environment} onChange={handleChange} className={inputCls}>
                    <option value="">— Select —</option>
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                    <option value="test">Test</option>
                    <option value="dr">DR</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Location</label>
                  <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="e.g., DC East, AWS us-east-1" className={inputCls} />
                </div>
              </div>
            </div>

            {/* ── Infrastructure Identity ───────────────────────────────── */}
            <div>
              <SectionHeader title="Infrastructure Identity" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Hostname</label>
                  <input type="text" name="hostname" value={formData.hostname} onChange={handleChange} placeholder="e.g., srv-prod-01" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>IP Address</label>
                  <input type="text" name="ip_address" value={formData.ip_address} onChange={handleChange} placeholder="e.g., 10.0.1.100" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Serial Number</label>
                  <input type="text" name="serial_number" value={formData.serial_number} onChange={handleChange} placeholder="e.g., SN-ABC-12345" className={inputCls} />
                </div>
              </div>
            </div>

            {/* ── Lifecycle ─────────────────────────────────────────────── */}
            <div>
              <SectionHeader title="Lifecycle" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Purchase Date</label>
                  <input type="date" name="purchase_date" value={formData.purchase_date} onChange={handleChange} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Warranty End Date</label>
                  <input type="date" name="warranty_end_date" value={formData.warranty_end_date} onChange={handleChange} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>End of Life Date</label>
                  <input type="date" name="end_of_life_date" value={formData.end_of_life_date} onChange={handleChange} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>End of Support Date</label>
                  <input type="date" name="end_of_support_date" value={formData.end_of_support_date} onChange={handleChange} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Last Reviewed Date</label>
                  <input type="date" name="last_reviewed_date" value={formData.last_reviewed_date} onChange={handleChange} className={inputCls} />
                </div>
              </div>
            </div>

            {/* ── Financial ─────────────────────────────────────────────── */}
            <div>
              <SectionHeader title="Financial" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Annual Cost (USD)</label>
                  <input type="number" name="annual_cost" value={formData.annual_cost} onChange={handleChange} min="0" step="0.01" placeholder="e.g., 12000" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>License Type</label>
                  <input type="text" name="license_type" value={formData.license_type} onChange={handleChange} placeholder="e.g., Enterprise, Per-seat" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>License Expiry Date</label>
                  <input type="date" name="license_expiry_date" value={formData.license_expiry_date} onChange={handleChange} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Support Contract ID</label>
                  <input type="text" name="support_contract_id" value={formData.support_contract_id} onChange={handleChange} placeholder="e.g., SC-2024-007" className={inputCls} />
                </div>
              </div>
            </div>

            {/* ── Compliance & Risk ─────────────────────────────────────── */}
            <div>
              <SectionHeader title="Compliance & Risk" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Data Classification</label>
                  <select name="data_classification" value={formData.data_classification} onChange={handleChange} className={inputCls}>
                    <option value="">— Select —</option>
                    <option value="public">Public</option>
                    <option value="internal">Internal</option>
                    <option value="confidential">Confidential</option>
                    <option value="restricted">Restricted</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Compliance Frameworks</label>
                  <input type="text" name="compliance_tags" value={formData.compliance_tags} onChange={handleChange} placeholder="Comma-separated (e.g., SOC2, PCI-DSS)" className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Criticality Justification</label>
                  <textarea name="criticality_justification" value={formData.criticality_justification} onChange={handleChange} rows={2} placeholder="Why is this asset critical?" className={inputCls} />
                </div>
              </div>
            </div>

            {/* ── Technical Specs (metadata top-level) ──────────────────── */}
            <div>
              <SectionHeader title="Technical Specs" />
              <p className="text-xs text-gray-500 mb-3">Flat key-value pairs (e.g., version: 2.1.0, framework: React)</p>
              <EntryEditor
                entries={metadataEntries}
                handlers={metaHandlers}
                keyPlaceholder="Key (e.g., version)"
                valuePlaceholder="Value (e.g., 2.1.0)"
              />
            </div>

            {/* ── Additional Specs (metadata.additional_specs) ──────────── */}
            <div>
              <SectionHeader title="Additional Specs" />
              <p className="text-xs text-gray-500 mb-3">Extended specifications (stored under metadata.additional_specs)</p>
              <EntryEditor
                entries={additionalSpecsEntries}
                handlers={addlHandlers}
                keyPlaceholder="Key (e.g., cpu_cores)"
                valuePlaceholder="Value (e.g., 16)"
              />
            </div>

            {/* ── Dependencies / Relationships ──────────────────────────── */}
            <div>
              <SectionHeader title="Dependencies" />
              <p className="text-xs text-gray-500 mb-3">Relationships to other assets (e.g., runs_on, depends_on)</p>
              {relationshipEntries.length > 0 ? (
                <EntryEditor
                  entries={relationshipEntries}
                  handlers={relHandlers}
                  keyPlaceholder="Relationship (e.g., runs_on)"
                  valuePlaceholder="Target asset name"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setRelationshipEntries([{ key: '', value: '' }])}
                  className="inline-flex items-center px-3 py-1 text-sm bg-gray-50 text-gray-600 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add dependency
                </button>
              )}
            </div>

            {/* ── Form Actions ──────────────────────────────────────────── */}
            <div className="flex justify-between pt-4 border-t border-gray-200">
              {!asset && (
                <button type="button" onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors">
                  ← Change Category
                </button>
              )}
              <div className="flex space-x-3 ml-auto">
                <button type="button" onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                  {asset ? 'Update Asset' : 'Add Asset'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AssetForm;
