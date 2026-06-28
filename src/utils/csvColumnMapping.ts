// Aliases for variant / shorthand column names → canonical template column name
export const COLUMN_ALIASES: Record<string, string> = {
  'EOL Date':              'End of Life Date',
  'EOS Date':             'End of Support Date',
  'End-of-Life Date':     'End of Life Date',
  'End-of-Support Date':  'End of Support Date',
  'EoL Date':             'End of Life Date',
  'EoS Date':             'End of Support Date',
  'Technical Specs':      'Technical Specs (JSON)',
  'Tech Specs (JSON)':    'Technical Specs (JSON)',
};

export function normalizeColumnName(col: string): string {
  const trimmed = col.trim();
  return COLUMN_ALIASES[trimmed] ?? trimmed;
}

// Columns that are rendered as JSON keys inside the metadata blob
export const TECHNICAL_SPEC_MAPPING: Record<string, string> = {
  'Architecture Layer':      'architecture_layer',
  'Lifecycle Status':        'lifecycle_status',
  'TIME Disposition':        'time_disposition',
  'Architecture Type':       'architecture_type',
  'Technology Stack':        'technology_stack',
  'Database Engine':         'database_engine',
  'Data Model':              'data_model',
  'Compute / Virtualization':'compute_virtualization',
  'CI ID':                   'ci_id',
};

// Standard columns that map to first-class DB fields — must NOT fall through to additionalSpecs
export const STANDARD_TEMPLATE_COLUMNS = [
  'Asset Name',
  'Asset Type',
  'Category',
  'Description',
  'Owner',
  'Owner Email',
  'Status',
  'Criticality',
  'Asset Tag',
  'Vendor',
  'Sourcing Type',
  'Environment',
  'Business Unit',
  'Purchase Date',
  'Warranty End Date',
  'End of Life Date',
  'End of Support Date',
  'Last Reviewed Date',
  'Annual Cost',
  'License Type',
  'License Expiry Date',
  'Support Contract ID',
  'Data Classification',
  'Compliance Tags',
  'Criticality Justification',
  'Hostname',
  'IP Address',
  'Serial Number',
  'Location',
  'Depends On',
  'Runs On',
  'Connects To',
  'Part Of',
  'Backs Up',
  'Tags',
  'Technical Specs (JSON)',  // parsed separately — must land in standardColumns
];

export function processCSVRow(row: Record<string, string>): {
  standardColumns: Record<string, string>;
  technicalSpecs: Record<string, any>;
  additionalSpecs: Record<string, any>;
} {
  const standardColumns: Record<string, string> = {};
  const technicalSpecs: Record<string, any> = {};
  const additionalSpecs: Record<string, any> = {};

  Object.keys(row).forEach(columnName => {
    const value = row[columnName]?.trim();
    if (!value) return;

    const normalizedColumn = normalizeColumnName(columnName.trim());

    if (STANDARD_TEMPLATE_COLUMNS.includes(normalizedColumn)) {
      standardColumns[normalizedColumn] = value;
    } else if (TECHNICAL_SPEC_MAPPING[normalizedColumn]) {
      technicalSpecs[TECHNICAL_SPEC_MAPPING[normalizedColumn]] = value;
    } else {
      additionalSpecs[normalizedColumn] = value;
    }
  });

  return { standardColumns, technicalSpecs, additionalSpecs };
}

export function buildTechnicalSpecsJSON(
  technicalSpecs: Record<string, any>,
  additionalSpecs: Record<string, any>
): string {
  const combinedSpecs = {
    ...technicalSpecs,
    ...(Object.keys(additionalSpecs).length > 0 ? { additional_specs: additionalSpecs } : {}),
  };
  return JSON.stringify(combinedSpecs);
}
