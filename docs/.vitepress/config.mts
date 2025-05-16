import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Kioskmanager",
  description: "Digital Signage Content Management",
  base: '/kioskmanager/',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' }, // Links to docs/index.md
      {
        text: 'Guides',
        items: [
          { text: 'Admin Guide', link: '/admin-guide/' }, // links to admin-guide/index.md
          { text: 'Content Manager Guide', link: '/content-manager-guide/' } // links to content-manager-guide/index.md
        ]
      },
    ],

    sidebar: [
      {
        text: 'Introduction',
        collapsed: false, // Optional: Set to true to collapse by default
        items: [
          { text: 'Getting Started', link: '/getting-started' } // Corresponds to docs/getting-started.md
        ]
      },
      {
        text: 'Content Manager Guide',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/content-manager-guide/' }, // content-manager-guide/index.md
            { text: 'Managing Content Items', link: '/content-manager-guide/managing-content-items' },
            { text: 'Creating Playlists & Groups', link: '/content-manager-guide/creating-playlists' }
          ]
      },
      {
        text: 'Admin Guide',
        collapsed: false,
        items: [
            { text: 'Overview', link: '/admin-guide/' }, // admin-guide/index.md
            { text: 'Installation (Helm)', link: '/admin-guide/installation' },
            { text: 'Authentication', link: '/admin-guide/authentication' },
            { text: 'Connecting & Managing Displays', link: '/admin-guide/connecting-displays' },
            { text: 'User Management', link: '/admin-guide/user-management' },
            { text: 'Setting Up a Kiosk Device', link: '/admin-guide/kiosk-device-example.md' },
            { text: 'Backup and Restore', link: '/admin-guide/backup-restore.md' }
        ]
      }
      // Add more sections/items as needed
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/mbcom/kioskmanager' }
    ],
    footer: {
      message: 'Kioskmanager Documentation',
      copyright: `Copyright © 2025-present MBcom`
    },
    editLink: {
      pattern: 'https://github.com/mbcom/kioskmanager/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },
    search: {
      provider: 'local'
    }
  }
})
