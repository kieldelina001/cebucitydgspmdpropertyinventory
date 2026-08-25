# Real Estate Inventory Management System

A web-based **Real Estate Inventory Management System** for the **Property Management Division (PMD)**.

The system connects to **Google Sheets** and **Google Drive** to provide a simple way to view, search, manage, update, and document real estate properties.

## Features

* 🔐 **Google Account Login**

  * Users sign in using their Google account.
  * Unauthorized users can submit an access request.

* 📊 **Dashboard**

  * Displays total properties.
  * Shows property status counts.
  * Shows property type statistics.
  * Includes insurance-related information.

* 🔎 **Search and Filters**

  * Search properties by information.
  * Filter by remarks.
  * Filter by property type.
  * Filter by photos and documents.
  * Click dashboard cards to quickly filter the inventory.

* 🏠 **Property Inventory**

  * Article / TCT Number
  * Description
  * Notes
  * Unit Value
  * Remarks
  * Property Type
  * Photos
  * Map Coordinates
  * Tax Declaration
  * Transfer Certificate of Title documents

* ✏️ **Edit Property Information**

  * Authorized users can edit property details.
  * Changes are recorded with the user's email and update time.

* 📷 **Photo Upload**

  * Upload property photos.
  * Upload map coordinate photos.
  * Upload tax declaration photos.
  * Uploaded files are stored through Google Drive.
  * The corresponding Google Sheet record is updated with the file links.

* 📑 **Export**

  * Export searched inventory information.
  * Photos and documents can be embedded into the generated report.

* 📄 **Pagination**

  * Inventory records are displayed in pages for easier browsing.

* 🖼️ **Image Preview**

  * Hover over property images to view a larger preview.

* 🔄 **Live Google Sheets Data**

  * Inventory information is loaded directly from Google Sheets.

* 🚪 **Logout and Idle Timeout**

  * Users can manually log out.
  * The system automatically logs users out after inactivity.

## Technologies Used

* HTML5
* CSS3
* JavaScript
* Google Apps Script
* Google Sheets
* Google Drive
* Google Identity Services
* PapaParse

## Project Files

```text
/
├── index.html
├── script.js
├── code.gs
└── UploadForm.html
```

### `index.html`

Contains the main web application interface, including:

* Login screen
* Dashboard
* Search and filter controls
* Inventory table
* Property details modal
* Access request window
* Export controls

### `script.js`

Contains the main application logic, including:

* Google authentication
* Google Sheets data loading
* Search and filtering
* Dashboard functions
* Property editing
* Photo handling
* Export functions
* Logout and idle timeout
* Access request handling

### `code.gs`

Google Apps Script backend used to connect the web application with Google services.

It handles server-side operations such as Google Sheets and Google Drive processing.

### `UploadForm.html`

Separate upload interface used for uploading property-related photos and documents.

Supported uploads include:

* Structure Photo 1
* Structure Photo 2
* Map Coordinates Photo
* Tax Declaration Photo

The upload form requires at least one photo before submitting.

## Google Services

This project uses:

**Google Sheets**

Stores the property inventory data and related information.

**Google Drive**

Stores uploaded property photos and documents.

**Google Identity Services**

Provides Google account authentication for users.

## Access Control

Users first authenticate using their Google account.

If the authenticated account does not have permission to access the inventory, the application displays an **Access Denied** window.

The user can provide an optional reason and submit an access request.

## Data Updates

Authorized users can edit property information through the **Property Details** window.

Changes can be recorded with:

* Updated By
* Last Update

The system then sends the changes to the Google Apps Script backend.

## Photo Management

Property photos are handled through Google Drive.

The application can securely retrieve authorized Drive images and display them in the inventory interface.

The upload form can upload up to four types of property images and send them to the Apps Script backend for processing.

## How the System Works

```text
User
  │
  ▼
Google Login
  │
  ├── Authorized ──► Inventory Dashboard
  │                      │
  │                      ├── Search / Filter
  │                      ├── View Property
  │                      ├── Edit Property
  │                      ├── Upload Photos
  │                      └── Export Report
  │
  └── Unauthorized
          │
          ▼
     Request Access
          │
          ▼
     Administrator
```

## Setup

1. Create a Google Spreadsheet containing the property inventory.
2. Create a Google Apps Script project.
3. Add the backend code from `code.gs`.
4. Add the upload interface from `UploadForm.html`.
5. Configure the Google Spreadsheet and Google Drive permissions.
6. Configure Google Identity Services.
7. Update the required Google Apps Script URL and Spreadsheet ID in `script.js`.
8. Deploy the Google Apps Script as a Web App.
9. Host or deploy the frontend files.
10. Test Google login, spreadsheet access, editing, uploads, and exports.

## Important

This application depends on Google services. Make sure the following are correctly configured before deployment:

* Google Spreadsheet permissions
* Google Drive permissions
* Google Apps Script Web App deployment
* Google OAuth / Identity Services configuration
* Authorized users
* Correct Spreadsheet ID
* Correct Apps Script Web App URL

## Author

**Noel Rie N. Deliña**

Property Management Division

© 2026
