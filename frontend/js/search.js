// Search and Filter Manager
class SearchManager {
  constructor() {
    this.searchIndex = [];
    this.filters = {};
    this.init();
  }

  init() {
    this.setupSearchBox();
    this.setupFilters();
    this.buildSearchIndex();
  }

  setupSearchBox() {
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
      searchBox.addEventListener('input', this.debounce((e) => {
        this.performSearch(e.target.value);
      }, 300));
    }
  }

  setupFilters() {
    document.querySelectorAll('[data-filter]').forEach(filter => {
      filter.addEventListener('change', () => {
        this.applyFilters();
      });
    });
  }

  buildSearchIndex() {
    // Build search index for gift cards, transactions, etc.
    const searchableElements = document.querySelectorAll('[data-searchable]');
    
    searchableElements.forEach(element => {
      const searchData = {
        element: element,
        text: element.textContent.toLowerCase(),
        category: element.dataset.category || 'general',
        tags: element.dataset.tags ? element.dataset.tags.split(',') : []
      };
      
      this.searchIndex.push(searchData);
    });
  }

  performSearch(query) {
    if (!query || query.length < 2) {
      this.showAllResults();
      return;
    }

    const results = this.searchIndex.filter(item => {
      return item.text.includes(query.toLowerCase()) ||
             item.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));
    });

    this.displayResults(results);
    
    // Track search
    if (window.analytics) {
      analytics.trackSearch(query, results.length);
    }
  }

  displayResults(results) {
    // Hide all searchable elements
    this.searchIndex.forEach(item => {
      item.element.style.display = 'none';
    });

    // Show matching results
    results.forEach(item => {
      item.element.style.display = '';
    });

    // Show no results message
    this.toggleNoResultsMessage(results.length === 0);
  }

  showAllResults() {
    this.searchIndex.forEach(item => {
      item.element.style.display = '';
    });
    this.toggleNoResultsMessage(false);
  }

  toggleNoResultsMessage(show) {
    let noResultsMsg = document.getElementById('noResultsMessage');
    
    if (show && !noResultsMsg) {
      noResultsMsg = document.createElement('div');
      noResultsMsg.id = 'noResultsMessage';
      noResultsMsg.className = 'no-results';
      noResultsMsg.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <h3>No results found</h3>
          <p>Try adjusting your search terms or filters</p>
        </div>
      `;
      
      const container = document.querySelector('.search-results') || document.querySelector('.container');
      if (container) container.appendChild(noResultsMsg);
    }
    
    if (noResultsMsg) {
      noResultsMsg.style.display = show ? 'block' : 'none';
    }
  }

  applyFilters() {
    const activeFilters = {};
    
    document.querySelectorAll('[data-filter]').forEach(filter => {
      const filterType = filter.dataset.filter;
      const value = filter.value;
      
      if (value && value !== 'all') {
        activeFilters[filterType] = value;
      }
    });

    this.filters = activeFilters;
    this.filterResults();
  }

  filterResults() {
    this.searchIndex.forEach(item => {
      let shouldShow = true;
      
      Object.keys(this.filters).forEach(filterType => {
        const filterValue = this.filters[filterType];
        const itemValue = item.element.dataset[filterType];
        
        if (itemValue && itemValue !== filterValue) {
          shouldShow = false;
        }
      });
      
      item.element.style.display = shouldShow ? '' : 'none';
    });
  }

  // Advanced search with suggestions
  getSuggestions(query) {
    if (!query || query.length < 2) return [];
    
    const suggestions = new Set();
    
    this.searchIndex.forEach(item => {
      // Add matching words
      const words = item.text.split(' ');
      words.forEach(word => {
        if (word.toLowerCase().startsWith(query.toLowerCase()) && word.length > 2) {
          suggestions.add(word);
        }
      });
      
      // Add matching tags
      item.tags.forEach(tag => {
        if (tag.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(tag);
        }
      });
    });
    
    return Array.from(suggestions).slice(0, 5);
  }

  setupAutoComplete() {
    const searchBox = document.getElementById('searchBox');
    if (!searchBox) return;
    
    const suggestionsList = document.createElement('div');
    suggestionsList.className = 'search-suggestions';
    suggestionsList.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 var(--radius) var(--radius);
      box-shadow: var(--shadow);
      z-index: 1000;
      display: none;
    `;
    
    searchBox.parentElement.style.position = 'relative';
    searchBox.parentElement.appendChild(suggestionsList);
    
    searchBox.addEventListener('input', (e) => {
      const suggestions = this.getSuggestions(e.target.value);
      
      if (suggestions.length > 0) {
        suggestionsList.innerHTML = suggestions.map(suggestion => 
          `<div class="suggestion-item" style="padding: 12px; cursor: pointer; border-bottom: 1px solid var(--border);">${suggestion}</div>`
        ).join('');
        
        suggestionsList.style.display = 'block';
        
        // Handle suggestion clicks
        suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
          item.addEventListener('click', () => {
            searchBox.value = item.textContent;
            this.performSearch(item.textContent);
            suggestionsList.style.display = 'none';
          });
        });
      } else {
        suggestionsList.style.display = 'none';
      }
    });
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchBox.contains(e.target) && !suggestionsList.contains(e.target)) {
        suggestionsList.style.display = 'none';
      }
    });
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// Initialize search manager
const searchManager = new SearchManager();