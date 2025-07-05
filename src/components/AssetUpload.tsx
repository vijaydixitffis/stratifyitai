import React, { useState } from 'react';
import { useAssets } from '../contexts/AssetContext';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';

interface AssetUploadProps {
  onClose: () => void;
}

const AssetUpload: React.FC<AssetUploadProps> = ({ onClose }) => {
  const { uploadAssets, uploads } = useAssets();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    const excelFile = files.find(file => 
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')
    );

    if (!excelFile) {
      alert('Please select a valid Excel file (.xlsx or .xls)');
      return;
    }

    setUploading(true);
    try {
      await uploadAssets(excelFile);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    // Create a sample CSV content
    const csvContent = `Asset Name,Asset Type,Category,Description,Owner,Status,Criticality,Tags
Customer Portal,application,Web Application,Main customer-facing portal,IT Department,active,high,"web,customer,portal"
Production Database,database,PostgreSQL,Primary production database,Database Team,active,high,"database,production,postgresql"
AWS EC2 Instances,infrastructure,Compute,Production web servers,DevOps Team,active,high,"aws,ec2,compute"`;

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
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Upload Asset Inventory</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
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
                Download our pre-formatted spreadsheet template to ensure your data is properly structured.
              </p>
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Download Template
              </button>
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
                Drop your Excel file here
              </h3>
              <p className="text-gray-600 mb-4">
                Or click to select file (.xlsx, .xls formats supported)
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
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
                      <span className="text-red-700">Upload failed. Please try again.</span>
                    </>
                  ) : (
                    <span className="text-blue-700">Processing...</span>
                  )}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Upload Instructions
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Use the provided template to ensure proper data formatting</li>
                <li>• Supported file formats: .xlsx, .xls</li>
                <li>• Maximum file size: 10MB</li>
                <li>• Required columns: Asset Name, Asset Type, Category, Description, Owner, Status, Criticality</li>
                <li>• Optional columns: Tags (comma-separated)</li>
              </ul>
            </div>
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