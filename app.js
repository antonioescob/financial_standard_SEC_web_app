const express = require('express');
const path = require('path');
const { pool, testConnection } = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>SEC Financial Data Viewer</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fa; }
                .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                .search-container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 30px; }
                .form-group { margin-bottom: 20px; }
                .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #333; }
                .form-control { width: 100%; padding: 12px; border: 2px solid #e1e8ed; border-radius: 8px; font-size: 16px; transition: border-color 0.3s; }
                .form-control:focus { outline: none; border-color: #667eea; }
                .btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s; }
                .btn:hover { transform: translateY(-2px); }
                .grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px; align-items: end; }
                @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
                .results { background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 20px; display: none; }
                .loading { text-align: center; padding: 40px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📊 SEC Financial Data Viewer</h1>
                    <p>Explore financial information from SEC filings with calculated ratios and metrics</p>
                </div>
                
                <div class="search-container">
                    <h2 style="margin-bottom: 20px; color: #333;">🔍 Search Company Financial Data</h2>
                    <form id="searchForm">
                        <div class="grid">
                            <div class="form-group">
                                <label for="company">Company Name</label>
                                <input type="text" id="company" name="company" class="form-control" placeholder="Search by company name or CIK..." required>
                                <div id="companySuggestions" style="position: absolute; background: white; border: 1px solid #ddd; border-radius: 4px; max-height: 200px; overflow-y: auto; width: calc(100% - 24px); z-index: 1000; display: none;"></div>
                            </div>
                            <div class="form-group">
                                <label for="year">Fiscal Year</label>
                                <select id="year" name="year" class="form-control" required disabled>
                                    <option value="">Select company first</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="period">Period</label>
                                <select id="period" name="period" class="form-control" required disabled>
                                    <option value="">Select year first</option>
                                </select>
                            </div>
                        </div>
                        <div style="margin-top: 20px; text-align: center;">
                            <button type="submit" class="btn">📈 View Financial Data</button>
                        </div>
                    </form>
                </div>
                
                <div id="results" class="results">
                    <div class="loading">
                        <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
                        <p>Loading financial data...</p>
                    </div>
                </div>
            </div>

            <script>
                let companyId = null;
                let debounceTimer = null;

                // Company search with autocomplete
                document.getElementById('company').addEventListener('input', function(e) {
                    const query = e.target.value.trim();
                    
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        if (query.length >= 2) {
                            searchCompanies(query);
                        } else {
                            hideSuggestions();
                        }
                    }, 300);
                });

                function searchCompanies(query) {
                    fetch(\`/api/companies/search?q=\${encodeURIComponent(query)}\`)
                        .then(response => response.json())
                        .then(companies => showSuggestions(companies))
                        .catch(error => console.error('Error:', error));
                }

                function showSuggestions(companies) {
                    const suggestions = document.getElementById('companySuggestions');
                    if (companies.length === 0) {
                        hideSuggestions();
                        return;
                    }

                    suggestions.innerHTML = companies.map(company => 
                        \`<div style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;" 
                             onclick="selectCompany(\${company.id}, '\${company.name.replace(/'/g, "\\\\'")}')">
                            <strong>\${company.name}</strong>
                            <small style="color: #666; display: block;">CIK: \${String(company.cik).padStart(10, '0')}</small>
                        </div>\`
                    ).join('');
                    
                    suggestions.style.display = 'block';
                }

                function selectCompany(id, name) {
                    companyId = id;
                    document.getElementById('company').value = name;
                    hideSuggestions();
                    loadYears(id);
                }

                function hideSuggestions() {
                    document.getElementById('companySuggestions').style.display = 'none';
                }

                function loadYears(companyId) {
                    fetch(\`/api/companies/\${companyId}/years\`)
                        .then(response => response.json())
                        .then(years => {
                            const yearSelect = document.getElementById('year');
                            yearSelect.innerHTML = '<option value="">Select year</option>' + 
                                years.map(year => \`<option value="\${year}">\${year}</option>\`).join('');
                            yearSelect.disabled = false;
                            
                            document.getElementById('period').innerHTML = '<option value="">Select year first</option>';
                            document.getElementById('period').disabled = true;
                        })
                        .catch(error => console.error('Error:', error));
                }

                document.getElementById('year').addEventListener('change', function(e) {
                    const year = e.target.value;
                    if (year && companyId) {
                        loadPeriods(companyId, year);
                    }
                });

                function loadPeriods(companyId, year) {
                    fetch(\`/api/companies/\${companyId}/periods?year=\${year}\`)
                        .then(response => response.json())
                        .then(periods => {
                            const periodSelect = document.getElementById('period');
                            periodSelect.innerHTML = '<option value="">Select period</option>' + 
                                periods.map(period => \`<option value="\${period}">\${period}</option>\`).join('');
                            periodSelect.disabled = false;
                        })
                        .catch(error => console.error('Error:', error));
                }

                document.getElementById('searchForm').addEventListener('submit', function(e) {
                    e.preventDefault();
                    
                    const year = document.getElementById('year').value;
                    const period = document.getElementById('period').value;
                    
                    if (!companyId || !year || !period) {
                        alert('Please select company, year and period');
                        return;
                    }
                    
                    showResults(companyId, year, period);
                });

                function showResults(companyId, year, period) {
                    const results = document.getElementById('results');
                    results.style.display = 'block';
                    results.scrollIntoView({ behavior: 'smooth' });
                    
                    fetch(\`/api/financial-data/\${companyId}?year=\${year}&period=\${period}\`)
                        .then(response => response.json())
                        .then(data => displayFinancialData(data))
                        .catch(error => {
                            results.innerHTML = '<div style="color: red; text-align: center;">Error loading financial data</div>';
                        });
                }

                function displayFinancialData(data) {
                    const results = document.getElementById('results');
                    
                    if (!data || (!data.val_filtered_data && !data.statement_data && !data.dataset_standard_data)) {
                        results.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">No financial data available for the selected period.</div>';
                        return;
                    }

                    const html = \`
                        <div style="margin-bottom: 30px;">
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                                <h2 style="margin: 0;">📈 \${data.company.name}</h2>
                                <p style="margin: 10px 0 0 0; opacity: 0.9;">CIK: \${String(data.company.cik).padStart(10, '0')} | Period: \${data.period} \${data.year}</p>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                            <!-- Val Filtered Column -->
                            <div style="background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden;">
                                <div style="background: #e3f2fd; padding: 15px; border-bottom: 1px solid #90caf9;">
                                    <h3 style="margin: 0; color: #1565c0;">📊 Val Filtered Data</h3>
                                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #1976d2;">Raw data from val_filtered table</p>
                                </div>
                                <div style="max-height: 600px; overflow-y: auto;">
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <thead style="position: sticky; top: 0; background: #f5f5f5; z-index: 1;">
                                            <tr>
                                                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e0e0e0; font-size: 12px; font-weight: 600;">Tag</th>
                                                <th style="padding: 8px; text-align: right; border-bottom: 1px solid #e0e0e0; font-size: 12px; font-weight: 600;">Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            \${(data.val_filtered_data || []).map(item => \`
                                                <tr style="border-bottom: 1px solid #f0f0f0;">
                                                    <td style="padding: 8px; font-size: 11px;">
                                                        <div style="font-weight: 600; margin-bottom: 2px;">\${item.tag_name}</div>
                                                        \${item.label && item.label !== item.tag_name ? \`<div style="font-size: 10px; color: #666;">\${item.label}</div>\` : ''}
                                                        \${item.unit ? \`<div style="font-size: 9px; color: #999;">Unit: \${item.unit}</div>\` : ''}
                                                    </td>
                                                    <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 11px; color: #1565c0;">
                                                        \${formatNumber(item.value)}
                                                    </td>
                                                </tr>
                                            \`).join('')}
                                        </tbody>
                                    </table>
                                    \${!data.val_filtered_data || data.val_filtered_data.length === 0 ? '<div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">No data available</div>' : ''}
                                </div>
                            </div>

                            <!-- Statement Data Column -->
                            <div style="background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden;">
                                <div style="background: #fff3e0; padding: 15px; border-bottom: 1px solid #ffb74d;">
                                    <h3 style="margin: 0; color: #e65100;">📋 Statement Data</h3>
                                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #f57c00;">Filtered data from statement_* tables</p>
                                </div>
                                <div style="max-height: 600px; overflow-y: auto;">
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <thead style="position: sticky; top: 0; background: #f5f5f5; z-index: 1;">
                                            <tr>
                                                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e0e0e0; font-size: 12px; font-weight: 600;">Tag</th>
                                                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e0e0e0; font-size: 12px; font-weight: 600;">Table</th>
                                                <th style="padding: 8px; text-align: right; border-bottom: 1px solid #e0e0e0; font-size: 12px; font-weight: 600;">Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            \${(data.statement_data || []).map(item => \`
                                                <tr style="border-bottom: 1px solid #f0f0f0;">
                                                    <td style="padding: 8px; font-size: 11px; font-weight: 600;">
                                                        \${item.tag_name}
                                                    </td>
                                                    <td style="padding: 8px; font-size: 10px; color: #666;">
                                                        \${item.statement_table.replace('statement_', '')}
                                                    </td>
                                                    <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 11px; color: #e65100;">
                                                        \${formatNumber(item.value)}
                                                    </td>
                                                </tr>
                                            \`).join('')}
                                        </tbody>
                                    </table>
                                    \${!data.statement_data || data.statement_data.length === 0 ? '<div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">No data available</div>' : ''}
                                </div>
                            </div>

                            <!-- Dataset Standard Column -->
                            <div style="background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden;">
                                <div style="background: #e8f5e8; padding: 15px; border-bottom: 1px solid #81c784;">
                                    <h3 style="margin: 0; color: #2e7d32;">💎 Dataset Standard</h3>
                                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #388e3c;">Calculated data from dataset_standard_statements</p>
                                </div>
                                <div style="max-height: 600px; overflow-y: auto;">
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <thead style="position: sticky; top: 0; background: #f5f5f5; z-index: 1;">
                                            <tr>
                                                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e0e0e0; font-size: 12px; font-weight: 600;">Field</th>
                                                <th style="padding: 8px; text-align: right; border-bottom: 1px solid #e0e0e0; font-size: 12px; font-weight: 600;">Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            \${(data.dataset_standard_data || []).map(item => \`
                                                <tr style="border-bottom: 1px solid #f0f0f0;">
                                                    <td style="padding: 8px; font-size: 11px;">
                                                        <div style="font-weight: 600; margin-bottom: 2px;">\${item.tag_name}</div>
                                                        <div style="font-size: 9px; color: #666;">\${item.field_name}</div>
                                                    </td>
                                                    <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 11px; color: #2e7d32;">
                                                        \${formatNumber(item.value)}
                                                    </td>
                                                </tr>
                                            \`).join('')}
                                        </tbody>
                                    </table>
                                    \${!data.dataset_standard_data || data.dataset_standard_data.length === 0 ? '<div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">No data available</div>' : ''}
                                </div>
                            </div>
                        </div>
                        
                        <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                            <div style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap; margin-bottom: 10px;">
                                <div>
                                    <strong>Val Filtered:</strong> \${data.val_filtered_data ? data.val_filtered_data.length : 0} items
                                </div>
                                <div>
                                    <strong>Statement Data:</strong> \${data.statement_data ? data.statement_data.length : 0} items
                                </div>
                                <div>
                                    <strong>Dataset Standard:</strong> \${data.dataset_standard_data ? data.dataset_standard_data.length : 0} items
                                </div>
                            </div>
                        </div>

                        <style>
                            @media (max-width: 768px) {
                                .results > div:first-child + div {
                                    grid-template-columns: 1fr !important;
                                }
                            }
                        </style>
                    \`;
                    
                    results.innerHTML = html;
                }
                
                
                function formatTagName(tag) {
                    if (!tag) return 'N/A';
                    // Convert camelCase or snake_case to readable format
                    return tag
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/_/g, ' ')
                        .replace(/^./, str => str.toUpperCase())
                        .trim();
                }
                
                function formatNumber(value) {
                    if (value === null || value === undefined) return 'N/A';
                    if (typeof value !== 'number') return value;
                    
                    // Format large numbers with appropriate units
                    if (Math.abs(value) >= 1e12) {
                        return (value / 1e12).toFixed(2) + 'T';
                    } else if (Math.abs(value) >= 1e9) {
                        return (value / 1e9).toFixed(2) + 'B';
                    } else if (Math.abs(value) >= 1e6) {
                        return (value / 1e6).toFixed(2) + 'M';
                    } else if (Math.abs(value) >= 1e3) {
                        return (value / 1e3).toFixed(2) + 'K';
                    } else {
                        return value.toLocaleString();
                    }
                }

                // Hide suggestions when clicking outside
                document.addEventListener('click', function(e) {
                    if (!e.target.closest('.form-group')) {
                        hideSuggestions();
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// API Routes
app.get('/api/companies/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.length < 2) {
            return res.json([]);
        }

        const [rows] = await pool.execute(
            'SELECT id, cik, name FROM companies WHERE (name LIKE ? OR cik LIKE ?) AND active = 1 ORDER BY name LIMIT 10',
            [`%${query}%`, `%${query}%`]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error searching companies:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/companies/:id/years', async (req, res) => {
    try {
        const companyId = req.params.id;
        
        // First get the CIK from companies table
        const [companyRows] = await pool.execute(
            'SELECT cik FROM companies WHERE id = ?',
            [companyId]
        );
        
        if (companyRows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }
        
        const cik = companyRows[0].cik;
        
        const [rows] = await pool.execute(
            'SELECT DISTINCT fy FROM dataset_standard_statements WHERE cik = ? ORDER BY fy DESC',
            [cik]
        );

        res.json(rows.map(row => row.fy));
    } catch (error) {
        console.error('Error getting years:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/companies/:id/periods', async (req, res) => {
    try {
        const companyId = req.params.id;
        const year = req.query.year;
        
        // First get the CIK from companies table
        const [companyRows] = await pool.execute(
            'SELECT cik FROM companies WHERE id = ?',
            [companyId]
        );
        
        if (companyRows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }
        
        const cik = companyRows[0].cik;
        
        const [rows] = await pool.execute(
            'SELECT DISTINCT fp FROM dataset_standard_statements WHERE cik = ? AND fy = ? ORDER BY CASE fp WHEN "Q1" THEN 1 WHEN "Q2" THEN 2 WHEN "Q3" THEN 3 WHEN "Q4" THEN 4 WHEN "FY" THEN 5 END',
            [cik, year]
        );

        res.json(rows.map(row => row.fp));
    } catch (error) {
        console.error('Error getting periods:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/financial-data/:id', async (req, res) => {
    try {
        const companyId = req.params.id;
        const year = req.query.year;
        const period = req.query.period;
        
        // Get company info
        const [companyRows] = await pool.execute(
            'SELECT name, cik FROM companies WHERE id = ?',
            [companyId]
        );

        if (companyRows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        const cik = companyRows[0].cik;
        
        // Get data from val_filtered with tag names
        const [valFilteredRows] = await pool.execute(
            `SELECT v.val as val_filtered, t.name as tag_name, t.label, t.description, v.unit
             FROM val_filtered v 
             JOIN tag t ON v.fk_id_tag = t.id 
             WHERE v.fk_id_company = ? AND v.fy = ? AND v.fp = ?
             ORDER BY t.name`,
            [companyId, year, period]
        );

        // Create a map of tag_name to val_filtered data
        const valFilteredMap = {};
        valFilteredRows.forEach(row => {
            valFilteredMap[row.tag_name] = {
                value: row.val_filtered,
                label: row.label,
                description: row.description,
                unit: row.unit
            };
        });

        // Get data from different statement tables
        // We'll check all statement tables for the data
        const statementTables = ['104000', '124000', '148600', '152200', '220000', '310000', '510000', '610000'];
        const statementData = {};
        
        for (const tableNum of statementTables) {
            try {
                const [stmtRows] = await pool.execute(
                    `SELECT s.val, t.name as tag_name
                     FROM statement_${tableNum} s 
                     JOIN tag t ON s.fk_id_tag = t.id 
                     WHERE s.fk_id_company = ? AND s.fy = ? AND s.fp = ?
                     ORDER BY t.name`,
                    [companyId, year, period]
                );
                
                stmtRows.forEach(row => {
                    if (!statementData[row.tag_name]) {
                        statementData[row.tag_name] = {};
                    }
                    statementData[row.tag_name][`statement_${tableNum}`] = row.val;
                });
            } catch (err) {
                // If table doesn't exist or has no data, continue
                console.log(`No data in statement_${tableNum} for company ${companyId}`);
            }
        }

        // Get data from dataset_standard_statements
        const [datasetRows] = await pool.execute(
            'SELECT * FROM dataset_standard_statements WHERE cik = ? AND fy = ? AND fp = ?',
            [cik, year, period]
        );

        const datasetData = datasetRows[0] || {};

        // Prepare data for each source separately
        const valFilteredData = valFilteredRows.map(row => ({
            tag_name: row.tag_name,
            label: row.label,
            description: row.description,
            unit: row.unit,
            value: row.val_filtered
        }));

        // Convert statement data to array format
        const statementDataArray = [];
        Object.entries(statementData).forEach(([tagName, statements]) => {
            Object.entries(statements).forEach(([statementTable, value]) => {
                statementDataArray.push({
                    tag_name: tagName,
                    statement_table: statementTable,
                    value: value
                });
            });
        });

        // Convert dataset_standard_statements to array format
        const datasetStandardArray = [];
        if (datasetData) {
            // Get all non-null fields from dataset_standard_statements
            Object.entries(datasetData).forEach(([fieldName, value]) => {
                if (value !== null && value !== undefined && 
                    !['cik', 'fk_id_company', 'company_name', 'fy', 'fp', 'sic_sector', 'sic_industry', 'sic_sub_sector', 'sic_sub_industriy'].includes(fieldName)) {
                    datasetStandardArray.push({
                        field_name: fieldName,
                        tag_name: formatFieldNameToTag(fieldName),
                        value: value
                    });
                }
            });
        }

        res.json({
            company: companyRows[0],
            year: year,
            period: period,
            val_filtered_data: valFilteredData,
            statement_data: statementDataArray,
            dataset_standard_data: datasetStandardArray
        });
    } catch (error) {
        console.error('Error getting financial data:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Helper function to format field names to readable tag names
function formatFieldNameToTag(fieldName) {
    return fieldName
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

app.get('/test-db', async (req, res) => {
    const isConnected = await testConnection();
    
    if (isConnected) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Database Test</title></head>
            <body style="font-family:Arial;max-width:800px;margin:0 auto;padding:20px">
                <h1>✅ Database Connection Successful</h1>
                <p>Connected to: ${process.env.DB_NAME}</p>
                <a href="/">← Back to Home</a>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Database Test</title></head>
            <body style="font-family:Arial;max-width:800px;margin:0 auto;padding:20px">
                <h1>❌ Database Connection Failed</h1>
                <p>Could not connect to: ${process.env.DB_NAME}</p>
                <a href="/">← Back to Home</a>
            </body>
            </html>
        `);
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: ${process.env.DB_NAME}`);
    testConnection();
});