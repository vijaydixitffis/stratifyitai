import React, { useState } from 'react';
import { useAssets } from '../contexts/AssetContext';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface AssetUploadProps {
  onClose: () => void;
}

interface ValidationError {
  row: number;
  field: string;
  value: string;
  message: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  validRows: number;
  totalRows: number;
}

const AssetUpload: React.FC<AssetUploadProps> = ({ onClose }) => {
  const { uploadAssets, uploads } = useAssets();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  // Asset type categories mapping (same as in AssetForm)
  const assetCategories = {
    application: [
      'Web Application',
      'Mobile Application',
      'SaaS Product',
      'Legacy Application',
      'Mainframe Application',
      'Desktop Application',
      'API/Microservice',
      'Enterprise Application'
    ],
    database: [
      'RDBMS (MySQL/PostgreSQL)',
      'RDBMS (SQL Server)',
      'RDBMS (Oracle)',
      'NoSQL (MongoDB)',
      'NoSQL (Cassandra)',
      'NoSQL (Redis)',
      'Block Storage',
      'S3 Block Storage',
      'Data Warehouse',
      'Time Series Database'
    ],
    infrastructure: [
      'Physical Server',
      'Virtual Machine',
      'Container Platform',
      'Load Balancer',
      'Network Equipment',
      'Storage System',
      'Backup System',
      'Security Appliance'
    ],
    middleware: [
      'Application Server',
      'Message Queue',
      'API Gateway',
      'Service Bus',
      'Workflow Engine',
      'Integration Platform',
      'Cache Server',
      'Proxy Server'
    ],
    'cloud-service': [
      'AWS EC2',
      'AWS RDS',
      'AWS S3',
      'AWS Lambda',
      'Azure VM',
      'Azure SQL',
      'Azure Storage',
      'Google Cloud Compute',
      'Google Cloud Storage',
      'Kubernetes Service'
    ],
    'third-party-service': [
      'SaaS Platform',
      'Payment Gateway',
      'Authentication Service',
      'Monitoring Service',
      'Analytics Platform',
      'Communication Service',
      'Security Service',
      'Backup Service'
    ]
  };

  const validAssetTypes = Object.keys(assetCategories);
  const validStatuses = ['active', 'inactive', 'deprecated', 'planned'];
  const validCriticalities = ['high', 'medium', 'low'];

  const validateSpreadsheetData = (data: any[]): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    let validRows = 0;

    data.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because index starts at 0 and we skip header row
      let rowIsValid = true;

      // Required fields validation
      const requiredFields = [
        { field: 'Asset Name', key: 'name' },
        { field: 'Asset Type', key: 'type' },
        { field: 'Category', key: 'category' },
        { field: 'Description', key: 'description' },
        { field: 'Owner', key: 'owner' },
        { field: 'Status', key: 'status' },
        { field: 'Criticality', key: 'criticality' }
      ];

      requiredFields.forEach(({ field, key }) => {
        const value = row[field] || row[key] || '';
        if (!value || value.toString().trim() === '') {
          errors.push({
            row: rowNumber,
            field,
            value: '',
            message: `${field} is required`
          });
          rowIsValid = false;
        }
      });

      // Asset Type validation
      const assetType = (row['Asset Type'] || row['type'] || '').toString().toLowerCase().trim();
      if (assetType && !validAssetTypes.includes(assetType)) {
        errors.push({
          row: rowNumber,
          field: 'Asset Type',
          value: assetType,
          message: `Invalid asset type. Must be one of: ${validAssetTypes.join(', ')}`
        });
        rowIsValid = false;
      }

      // Category validation (only if asset type is valid)
      const category = (row['Category'] || row['category'] || '').toString().trim();
      if (assetType && validAssetTypes.includes(assetType) && category) {
        const validCategories = assetCategories[assetType as keyof typeof assetCategories];
        if (!validCategories.includes(category)) {
          errors.push({
            row: rowNumber,
            field: 'Category',
            value: category,
            message: `Invalid category for ${assetType}. Must be one of: ${validCategories.join(', ')}`
          });
          rowIsValid = false;
        }
      }

      // Status validation
      const status = (row['Status'] || row['status'] || '').toString().toLowerCase().trim();
      if (status && !validStatuses.includes(status)) {
        errors.push({
          row: rowNumber,
          field: 'Status',
          value: status,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
        rowIsValid = false;
      }

      // Criticality validation
      const criticality = (row['Criticality'] || row['criticality'] || '').toString().toLowerCase().trim();
      if (criticality && !validCriticalities.includes(criticality)) {
        errors.push({
          row: rowNumber,
          field: 'Criticality',
          value: criticality,
          message: `Invalid criticality. Must be one of: ${validCriticalities.join(', ')}`
        });
        rowIsValid = false;
      }

      // Warnings for optional fields
      const tags = (row['Tags'] || row['tags'] || '').toString().trim();
      if (!tags) {
        warnings.push({
          row: rowNumber,
          field: 'Tags',
          value: '',
          message: 'No tags specified. Consider adding relevant tags for better categorization.'
        });
      }

      if (rowIsValid) {
        validRows++;
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validRows,
      totalRows: data.length
    };
  };

  const parseCSVData = (csvText: string): any[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      data.push(row);
    }

    return data;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    const file = files.find(file => 
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'text/csv' ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls') ||
      file.name.endsWith('.csv')
    );

    if (!file) {
      alert('Please select a valid Excel file (.xlsx, .xls) or CSV file (.csv)');
      return;
    }

    setUploading(true);
    setValidationResult(null);

    try {
      // For demo purposes, we'll simulate reading the file and validating
      // In a real implementation, you'd use a library like xlsx or papaparse
      
      // Simulate file reading delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock CSV data for validation demo
      const mockCSVData = `Asset Name,Asset Type,Category,Description,Owner,Status,Criticality,Tags
Customer Portal,application,Web Application,Main customer-facing portal,IT Department,active,high,"web,customer,portal"
Production Database,database,RDBMS (PostgreSQL),Primary production database,Database Team,active,high,"database,production,postgresql"
Invalid Asset,invalid-type,Unknown Category,Test asset with invalid type,Test Team,active,high,"test"
Legacy System,application,Legacy Application,Old mainframe system,Legacy Team,deprecated,medium,"legacy,mainframe"
Missing Data,,,,,,,"incomplete"`;

      const parsedData = parseCSVData(mockCSVData);
      const validation = validateSpreadsheetData(parsedData);
      
      setValidationResult(validation);

      if (validation.isValid) {
        // Proceed with upload if validation passes
        await uploadAssets(file);
      }
    } catch (error) {
      console.error('File processing failed:', error);
      alert('File processing failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    // Create a comprehensive CSV template with all valid options
    const csvContent = `Asset Name,Asset Type,Category,Description,Owner,Status,Criticality,Tags
Customer Portal,application,Web Application,Main customer-facing portal,IT Department,active,high,"web,customer,portal"
Production Database,database,RDBMS (PostgreSQL),Primary production database,Database Team,active,high,"database,production,postgresql"
AWS EC2 Instances,infrastructure,Virtual Machine,Production web servers,DevOps Team,active,high,"aws,ec2,compute"
API Gateway,middleware,API Gateway,Central API management,Platform Team,active,medium,"api,gateway,middleware"
Monitoring Service,third-party-service,Monitoring Service,Application monitoring platform,SRE Team,active,low,"monitoring,observability"`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'asset-inventory-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const latestUpload = uploads[uploads.length - 1];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Upload Asset Inventory</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Template Download */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-blue-900 mb-2">
                Download Template
              </h3>
              <p className="text-blue-800 mb-4">
                Download our pre-formatted spreadsheet template with valid asset types and categories.
              </p>
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Download Template
              </button>
            </div>

            {/* Validation Requirements */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-amber-900 mb-3">
                <Info className="h-5 w-5 inline mr-2" />
                Validation Requirements
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-amber-800">
                <div>
                  <h4 className="font-medium mb-2">Valid Asset Types:</h4>
                  <ul className="space-y-1">
                    {validAssetTypes.map(type => (
                      <li key={type} className="text-xs">• {type}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Required Fields:</h4>
                  <ul className="space-y-1 text-xs">
                    <li>• Asset Name</li>
                    <li>• Asset Type</li>
                    <li>• Category (must match asset type)</li>
                    <li>• Description</li>
                    <li>• Owner</li>
                    <li>• Status (active, inactive, deprecated, planned)</li>
                    <li>• Criticality (high, medium, low)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Drop your file here
              </h3>
              <p className="text-gray-600 mb-4">
                Supports Excel (.xlsx, .xls) and CSV (.csv) formats
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                Select File
              </label>
            </div>

            {/* Validation Results */}
            {validationResult && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Validation Results</h3>
                  <button
                    onClick={() => setShowValidationDetails(!showValidationDetails)}
                    className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {showValidationDetails ? 'Hide Details' : 'Show Details'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{validationResult.totalRows}</p>
                    <p className="text-sm text-gray-600">Total Rows</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{validationResult.validRows}</p>
                    <p className="text-sm text-green-600">Valid Rows</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{validationResult.errors.length}</p>
                    <p className="text-sm text-red-600">Errors</p>
                  </div>
                </div>

                {!validationResult.isValid && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <span className="font-medium text-red-800">
                        Validation Failed - Please fix the following errors:
                      </span>
                    </div>
                  </div>
                )}

                {validationResult.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      <span className="font-medium text-yellow-800">
                        {validationResult.warnings.length} Warning(s) Found
                      </span>
                    </div>
                  </div>
                )}

                {showValidationDetails && (
                  <div className="space-y-4">
                    {validationResult.errors.length > 0 && (
                      <div>
                        <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {validationResult.errors.map((error, index) => (
                            <div key={index} className="text-sm bg-red-50 p-2 rounded border border-red-200">
                              <span className="font-medium">Row {error.row}:</span> {error.message}
                              {error.value && <span className="text-red-600"> (Value: "{error.value}")</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {validationResult.warnings.length > 0 && (
                      <div>
                        <h4 className="font-medium text-yellow-800 mb-2">Warnings:</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {validationResult.warnings.map((warning, index) => (
                            <div key={index} className="text-sm bg-yellow-50 p-2 rounded border border-yellow-200">
                              <span className="font-medium">Row {warning.row}:</span> {warning.message}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {validationResult.isValid && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-green-800">
                        Validation Passed! All {validationResult.validRows} rows are valid and ready for import.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Upload Progress */}
            {latestUpload && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {latestUpload.file.name}
                  </span>
                  <span className="text-sm text-gray-500">
                    {latestUpload.status === 'completed' ? '100%' : `${latestUpload.progress}%`}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      latestUpload.status === 'completed'
                        ? 'bg-green-500'
                        : latestUpload.status === 'failed'
                        ? 'bg-red-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${latestUpload.progress}%` }}
                  />
                </div>
                
                <div className="flex items-center space-x-2 text-sm">
                  {latestUpload.status === 'completed' ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-green-700">
                        Upload completed successfully! {latestUpload.results?.processed} assets processed.
                      </span>
                    </>
                  ) : latestUpload.status === 'failed' ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-red-700">Upload failed. Please fix validation errors and try again.</span>
                    </>
                  ) : (
                    <span className="text-blue-700">Processing...</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetUpload;