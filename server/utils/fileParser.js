import fs from 'fs';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import path from 'path';

/**
 * Parse CSV file and return array of lead objects
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Array>} - Array of lead objects
 */
export const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Normalize the data according to new format
        // Date | name | email | phonenumber | Country | Product | Status
        
        // Parse date flexibly
        let parsedDate = new Date();
        const dateStr = data.date || data.Date || data.DATE;
        if (dateStr) {
          try {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
              parsedDate = parsed;
            }
          } catch (e) {
            // Use current date if parsing fails
          }
        }
        
        const lead = {
          date: parsedDate,
          name: data.name || data.Name || data.NAME || '',
          email: data.email || data.Email || data.EMAIL || '',
          phone: data.phonenum || data.phonenumber || data.phone || data.Phone || data.PhoneNumber || data.PHONENUMBER || '',
          country: data.country || data.Country || data.COUNTRY || '',
          product: data.product || data.Product || data.PRODUCT || '',
          source: data.source || data.Source || data.SOURCE || data.leadsource || data['lead source'] || data['Lead Source'] || '',
          status: (data.status || data.Status || data.STATUS || 'fresh').toLowerCase()
        };
        
        // Validate required fields: name, phone, country
        if (lead.name && lead.phone && lead.country) {
          // Ensure status is valid
          const validStatuses = ['fresh', 'follow-up', 'dead', 'registered', 'cancelled', 'rejected'];
          if (!validStatuses.includes(lead.status)) {
            lead.status = 'fresh';
          }
          results.push(lead);
        }
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

/**
 * Parse Excel file and return array of lead objects
 * @param {string} filePath - Path to Excel file
 * @returns {Array} - Array of lead objects
 */
export const parseExcel = (filePath) => {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    const leads = data.map(row => {
      // Parse date flexibly
      let parsedDate = new Date();
      const dateStr = row.date || row.Date || row.DATE;
      if (dateStr) {
        try {
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            parsedDate = parsed;
          }
        } catch (e) {
          // Use current date if parsing fails
        }
      }
      
      const lead = {
        date: parsedDate,
        name: row.name || row.Name || row.NAME || '',
        email: row.email || row.Email || row.EMAIL || '',
        phone: row.phonenum || row.phonenumber || row.phone || row.Phone || row.PhoneNumber || row.PHONENUMBER || '',
        country: row.country || row.Country || row.COUNTRY || '',
        product: row.product || row.Product || row.PRODUCT || '',
        source: row.source || row.Source || row.SOURCE || row.leadsource || row['Lead Source'] || row['lead source'] || '',
        status: (row.status || row.Status || row.STATUS || 'fresh').toLowerCase()
      };
      
      // Ensure status is valid
      const validStatuses = ['fresh', 'follow-up', 'dead', 'registered', 'cancelled', 'rejected'];
      if (!validStatuses.includes(lead.status)) {
        lead.status = 'fresh';
      }
      
      return lead;
    }).filter(lead => lead.name && lead.phone && lead.country);

    return leads;
  } catch (error) {
    throw error;
  }
};

/**
 * Parse file based on extension
 * @param {string} filePath - Path to file
 * @returns {Promise<Array>} - Array of lead objects
 */
export const parseFile = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  
  try {
    if (ext === '.csv') {
      return await parseCSV(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      return parseExcel(filePath);
    } else {
      throw new Error('Unsupported file format');
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Delete uploaded file
 * @param {string} filePath - Path to file
 */
export const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
};
