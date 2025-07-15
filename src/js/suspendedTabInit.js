// Initialize the suspended tab
initializeBackgroundPageGlobals(window);

// Self-initialize the suspended tab for Manifest V3
if (window.gsSuspendedTab) {
  // We need to extract tab info from the URL
  const url = window.location.href;
  const title = gsUtils.getSuspendedTitle(url) || 'Suspended Tab';
  const originalUrl = gsUtils.getOriginalUrl(url);
  
  // Create a mock tab object
  const mockTab = {
    id: 'suspended',
    url: url,
    title: title
  };
  
  // Create a mock tabView object
  const mockTabView = {
    document: document,
    window: window
  };
  
  // Initialize the suspended tab
  document.addEventListener('DOMContentLoaded', function() {
    try {
      // Set basic properties
      document.title = title;
      document.getElementById('gsTitle').innerHTML = title;
      document.getElementById('gsTopBarTitle').innerHTML = title;
      document.getElementById('gsTopBarUrl').innerHTML = originalUrl;
      document.getElementById('gsTopBarUrl').setAttribute('href', originalUrl);
      
      // Set default favicon
      document.getElementById('gsTopBarImg').setAttribute('src', 'img/ic_suspendy_16x16.png');
      
      // Apply theme
      const theme = gsStorage.getOption('gsTheme') || 'light';
      console.log('Suspended tab theme:', theme);
      if (theme === 'dark') {
        document.body.classList.add('dark');
        console.log('Applied dark theme class');
      }
      
      // Show contents
      document.body.classList.remove('hide-initially');
      
      // Add click handler to restore tab
      document.body.addEventListener('click', function(e) {
        if (e.target.closest('#gsTopBarUrl')) {
          return; // Let the link work normally
        }
        e.preventDefault();
        window.location.href = originalUrl;
      });
      
      // Localize the page
      gsUtils.documentReadyAndLocalisedAsPromsied(document);
      
    } catch (error) {
      console.error('Failed to initialize suspended tab:', error);
    }
  });
}
