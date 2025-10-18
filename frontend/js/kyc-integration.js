// KYC Integration for Frontend
class KYCManager {
  constructor() {
    this.apiBase = '/api/kyc';
  }

  async getKYCStatus() {
    try {
      const response = await fetch(`${this.apiBase}/status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch KYC status:', error);
      throw error;
    }
  }

  async submitKYCInfo(kycData) {
    try {
      const response = await fetch(`${this.apiBase}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(kycData)
      });
      return await response.json();
    } catch (error) {
      console.error('KYC submission failed:', error);
      throw error;
    }
  }

  async uploadDocument(documentType, file) {
    try {
      // In production: upload to S3/CloudFlare and get URL
      const documentUrl = await this.mockUploadFile(file);
      
      const response = await fetch(`${this.apiBase}/upload-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          documentType,
          documentUrl
        })
      });
      return await response.json();
    } catch (error) {
      console.error('Document upload failed:', error);
      throw error;
    }
  }

  async getLimits() {
    try {
      const response = await fetch(`${this.apiBase}/limits`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch limits:', error);
      throw error;
    }
  }

  // Mock file upload for development
  async mockUploadFile(file) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`https://mock-storage.com/documents/${Date.now()}-${file.name}`);
      }, 1000);
    });
  }

  // UI Helper methods
  renderKYCStatus(status) {
    const statusConfig = {
      not_started: { color: 'gray', text: 'Not Started', action: 'Start Verification' },
      pending: { color: 'orange', text: 'Under Review', action: 'View Status' },
      approved: { color: 'green', text: 'Verified', action: 'View Details' },
      rejected: { color: 'red', text: 'Rejected', action: 'Resubmit' }
    };

    return statusConfig[status] || statusConfig.not_started;
  }

  showKYCModal(currentStatus) {
    const modal = document.createElement('div');
    modal.className = 'kyc-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Identity Verification</h3>
        <form id="kyc-form">
          <input type="text" name="firstName" placeholder="First Name" required>
          <input type="text" name="lastName" placeholder="Last Name" required>
          <input type="date" name="dateOfBirth" required>
          <input type="text" name="nationality" placeholder="Nationality" required>
          <input type="text" name="street" placeholder="Street Address" required>
          <input type="text" name="city" placeholder="City" required>
          <input type="text" name="zipCode" placeholder="ZIP Code" required>
          <input type="text" name="country" placeholder="Country" required>
          <button type="submit">Submit KYC</button>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('kyc-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const kycData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        dateOfBirth: formData.get('dateOfBirth'),
        nationality: formData.get('nationality'),
        address: {
          street: formData.get('street'),
          city: formData.get('city'),
          zipCode: formData.get('zipCode'),
          country: formData.get('country')
        }
      };

      try {
        await this.submitKYCInfo(kycData);
        modal.remove();
        alert('KYC information submitted successfully!');
      } catch (error) {
        alert('KYC submission failed. Please try again.');
      }
    });
  }
}

// Initialize KYC manager
window.kycManager = new KYCManager();