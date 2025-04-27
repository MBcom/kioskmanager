
    // Ensure the script runs after the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', function() {
        $ = django.jQuery; // Use jQuery from Django admin
        const contentTypeSelect = $('#id_content_type');
        const allSections = $('.content-type-section'); // Select all sections by class
        const videoSection = $('.content-type-video');
        const websiteSection = $('.content-type-website');

        function toggleSections() {
            const selectedType = contentTypeSelect.val();
            console.log("Selected type:", selectedType); // Debugging

            // Hide all sections initially
            allSections.hide();

            if (selectedType === 'video') {
                videoSection.show();
            } else if (selectedType === 'website') {
                websiteSection.show();
            }
        }

        // Run on initial page load
        toggleSections();

        // Run when the content type selection changes
        contentTypeSelect.on('change', toggleSections);

        // Optional: Clear fields when type changes to prevent saving invalid data
        contentTypeSelect.on('change', function() {
            const selectedType = $(this).val();
            if (selectedType === 'video') {
                websiteSection.find('input[type="url"], input[type="number"]').val(''); // Clear URL and duration
            } else if (selectedType === 'website') {
                // Clearing file inputs is tricky and often not necessary if model clean() handles it
                // videoSection.find('input[type="file"]').val('');
                // videoSection.find('.file-upload a').remove(); // Remove link to current file
                // videoSection.find('.file-upload .clear-widget').prop('checked', true); // Check the clear checkbox if exists
            }
        });
    });
